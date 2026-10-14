import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, isActive, qk, roleLabel } from '@tasknet/shared';
import { Avatar, Card, Empty, ErrorView, Field, Loading, Pill, Row, T } from '@/components/ui';
import { colors } from '@/theme';

const PAGE = 30;

export default function PersonnelScreen() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const list = useInfiniteQuery({
    queryKey: qk.personnel({ search: query, paged: true }),
    queryFn: ({ pageParam }) => api.personnel.page({ search: query, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.items.length : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <Field placeholder="Search by name, role or grade" value={search} onChangeText={setSearch} returnKeyType="search"
          onSubmitEditing={() => setQuery(search.trim())} onEndEditing={() => setQuery(search.trim())} />
      </View>
      {list.isPending ? <Loading /> : list.isError ? <ErrorView error={list.error} onRetry={() => list.refetch()} /> : (
        <FlatList data={items} keyExtractor={(u) => String(u.id)} contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          onRefresh={() => void list.refetch()} refreshing={list.isRefetching && !list.isFetchingNextPage}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : null}
          ListEmptyComponent={<Empty title="No personnel found" icon="people-outline" />}
          renderItem={({ item: u }) => (
            <Card onPress={() => router.push({ pathname: '/personnel/[id]', params: { id: String(u.id) } })} style={{ marginBottom: 8, padding: 12 }}>
              <Row gap={12}>
                <Avatar name={u.full_name} size={40} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }} numberOfLines={1}>{u.full_name}</T>
                  <T v="small" numberOfLines={1}>{[roleLabel(u.role), u.grade_level, u.department].filter(Boolean).join(' · ')}</T>
                </View>
                {!isActive(u) && <Pill label="Inactive" tone="red" />}
              </Row>
            </Card>
          )} />
      )}
    </View>
  );
}
