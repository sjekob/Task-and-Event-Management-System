import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, isReturnedEvent, parseEventDate, qk, startOfDay, useSession, type EventRecord } from '@tasknet/shared';
import { EventCard } from '@/components/cards';
import { Empty, ErrorView, Loading, Segmented } from '@/components/ui';
import { colors } from '@/theme';

type Filter = 'upcoming' | 'pending' | 'returned' | 'past' | 'mine';
const time = (e: EventRecord) => parseEventDate(e.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;

export default function EventsScreen() {
  const { can, user } = useSession();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const events = useQuery({ queryKey: qk.events(), queryFn: () => api.events.list() });

  const today = startOfDay(new Date()).getTime();
  const all = events.data ?? [];
  const pending = all.filter((e) => e.status === 'pending_approval');
  // Sent back by the approver: the proponent's to revise (approvers see them all).
  const returned = all.filter((e) => isReturnedEvent(e.status) && (can('approve_events') || e.created_by === user?.id));
  const lists: Record<Filter, EventRecord[]> = {
    upcoming: all.filter((e) => e.status === 'approved' && time(e) >= today).sort((a, b) => time(a) - time(b)),
    pending,
    returned,
    // Completed (set by the server after the last session) or approved with a past date.
    past: all.filter((e) => e.status === 'completed' || (e.status === 'approved' && time(e) < today)).sort((a, b) => time(b) - time(a)),
    mine: all.filter((e) => e.created_by === user?.id).sort((a, b) => time(b) - time(a)),
  };
  const options: { value: Filter; label: string; count?: number }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    ...(can('approve_events') ? [{ value: 'pending' as const, label: 'Pending', count: pending.length }] : []),
    ...(returned.length ? [{ value: 'returned' as const, label: 'Returned', count: returned.length }] : []),
    { value: 'past', label: 'Past' },
    ...(can('manage_events') ? [{ value: 'mine' as const, label: 'Mine' }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <Segmented value={filter} onChange={setFilter} options={options} />
      </View>
      {events.isPending ? <Loading />
        : events.isError ? <ErrorView error={events.error} onRetry={() => events.refetch()} />
          : (
            <FlatList data={lists[filter]} keyExtractor={(e) => String(e.id)} contentContainerStyle={{ padding: 16, paddingTop: 8 }}
              renderItem={({ item }) => <EventCard event={item} />}
              onRefresh={() => void events.refetch()} refreshing={events.isRefetching}
              ListEmptyComponent={<Empty title="No events" icon="calendar-outline"
                message={filter === 'pending' ? 'No proposals are waiting for approval.'
                  : filter === 'returned' ? 'No proposals were sent back for revision.' : undefined} />} />
          )}
    </View>
  );
}
