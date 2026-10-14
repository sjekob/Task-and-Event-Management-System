import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, qk, useSession, type TaskCategory } from '@tasknet/shared';
import { TaskCard } from '@/components/cards';
import { Empty, ErrorView, Field, Loading, Segmented } from '@/components/ui';
import { colors } from '@/theme';

const PAGE = 20;

export default function TasksScreen() {
  const { can } = useSession();
  const receives = can('receive_tasks');
  const manages = can('create_tasks') || can('view_all_tasks');
  const [view, setView] = useState<'mine' | 'managed'>(receives ? 'mine' : 'managed');
  const [category, setCategory] = useState<TaskCategory>('common');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const mine = view === 'mine';
  // Supervisors who may see every task browse school-wide; others see the ones they manage.
  const scope = !mine && can('view_all_tasks') ? 'all' : undefined;
  const params = { assigned: mine, category, search: query || undefined, scope };
  const list = useInfiniteQuery({
    queryKey: qk.tasks({ mobile: true, ...params }),
    queryFn: ({ pageParam }) => api.tasks.page({ ...params, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.items.length : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 6, gap: 10 }}>
        {receives && manages && (
          <Segmented value={view} onChange={setView}
            options={[{ value: 'mine', label: 'Assigned to me' }, { value: 'managed', label: scope ? 'All tasks' : 'I manage' }]} />
        )}
        <Segmented value={category} onChange={setCategory}
          options={[{ value: 'common', label: 'Common' }, { value: 'special', label: 'Special' }]} />
        <Field placeholder="Search tasks" value={search} onChangeText={setSearch} returnKeyType="search"
          onSubmitEditing={() => setQuery(search.trim())} clearButtonMode="while-editing"
          onEndEditing={() => setQuery(search.trim())} />
      </View>
      {list.isPending ? <Loading />
        : list.isError ? <ErrorView error={list.error} onRetry={() => list.refetch()} />
          : (
            <FlatList data={items} keyExtractor={(t) => String(t.id)} contentContainerStyle={{ padding: 16, paddingTop: 8 }}
              renderItem={({ item }) => <TaskCard task={item} mine={mine} />}
              onRefresh={() => void list.refetch()} refreshing={list.isRefetching && !list.isFetchingNextPage}
              onEndReachedThreshold={0.4}
              onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
              ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : null}
              ListEmptyComponent={<Empty title="No tasks" message={query ? 'Nothing matches your search.' : mine
                ? 'Tasks assigned to you appear here.' : 'Tasks you create appear here.'} />} />
          )}
    </View>
  );
}
