import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, formatDateTime, parseTimestamp, qk, roleLabel } from '@tasknet/shared';
import { Card, Empty, ErrorView, Field, Loading, Pill, Row, T } from '@/components/ui';
import { colors } from '@/theme';

const PAGE = 40;
const ACTION_TONE: Record<string, string> = { create: 'green', update: 'blue', delete: 'red', login: 'violet' };

export default function AuditLogScreen() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const list = useInfiniteQuery({
    queryKey: qk.audit({ q: query, mobile: true }),
    queryFn: ({ pageParam }) => api.audit.list({ q: query || undefined, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((a, p) => a + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <Field placeholder="Search the audit log" value={search} onChangeText={setSearch} returnKeyType="search"
          onSubmitEditing={() => setQuery(search.trim())} onEndEditing={() => setQuery(search.trim())} />
      </View>
      {list.isPending ? <Loading /> : list.isError ? <ErrorView error={list.error} onRetry={() => list.refetch()} /> : (
        <FlatList data={items} keyExtractor={(e) => String(e.id)} contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          onRefresh={() => void list.refetch()} refreshing={list.isRefetching && !list.isFetchingNextPage}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : null}
          ListEmptyComponent={<Empty title="No audit entries" icon="time-outline" />}
          renderItem={({ item: e }) => (
            <Card style={{ marginBottom: 8, padding: 12, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Pill label={e.action} tone={ACTION_TONE[e.action] ?? 'gray'} />
                <T v="small">{formatDateTime(parseTimestamp(e.created_at))}</T>
              </Row>
              <T style={{ fontSize: 14.5 }}>{e.summary}</T>
              <T v="small">
                {[e.actor_name, e.actor_role ? roleLabel(e.actor_role) : null].filter(Boolean).join(' · ') || 'System'}
                {e.entity_label ? ` · ${e.entity_type}: ${e.entity_label}` : ''}
              </T>
            </Card>
          )} />
      )}
    </View>
  );
}
