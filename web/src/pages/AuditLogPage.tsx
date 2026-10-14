import { useState } from 'react';
import { Button, Center, Chip, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, qk } from '@tasknet/shared';
import { AuditEntryTile } from '../components/AuditHistory';
import { ErrorState, PageBanner } from '../components/ui';

const CATEGORIES: [string, string | null][] = [
  ['All activity', null], ['Accounts', 'account'], ['Roles & delegation', 'personnel'], ['Certificates', 'certificate'],
  ['School years', 'school_year'], ['Events', 'event'], ['Task assignments', 'task'],
];
const PAGE = 50;

/**
 * Principal/admin: the audit trail of account, delegation, certificate,
 * school-year, event and task-assignment changes. Entries can't be edited or
 * deleted (enforced by the database).
 */
export function AuditLogPage() {
  const [category, setCategory] = useState('All activity');
  const [search, setSearch] = useState('');
  const [query] = useDebouncedValue(search.trim(), 350);
  const action = CATEGORIES.find(([c]) => c === category)?.[1] ?? undefined;

  const pages = useInfiniteQuery({
    queryKey: qk.audit({ action, query }),
    queryFn: ({ pageParam }) => api.audit.list({ action, q: query, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = pages.data?.pages.flatMap((p) => p.items) ?? [];
  const total = pages.data?.pages[0]?.total ?? 0;

  return (
    <Stack gap="md">
      <PageBanner title="Audit Log"
        subtitle="Every change to accounts, roles and delegations, certificate reviews, school years, event approvals and task assignments, with who made it and when. Entries cannot be edited or deleted." />
      <Group gap={12}>
        <TextInput w={{ base: '100%', sm: 340 }} placeholder="Search by person or description…" leftSection={<IconSearch size={18} />}
          value={search} onChange={(e) => setSearch(e.currentTarget.value)} aria-label="Search audit log" />
        <Chip.Group value={category} onChange={(v) => setCategory(v as string)}>
          <Group gap={8}>{CATEGORIES.map(([c]) => <Chip key={c} value={c} color="ink.8">{c}</Chip>)}</Group>
        </Chip.Group>
      </Group>
      {pages.isError ? <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
        : pages.isPending ? <Center p={40}><Loader /></Center>
          : !items.length ? <Text ta="center" c="dimmed" p={32}>No matching activity.</Text> : (
            <div>
              <Text size="xs" c="dimmed" mb={8}>{total} {total === 1 ? 'entry' : 'entries'}</Text>
              {items.map((e) => <AuditEntryTile key={e.id} entry={e} />)}
              {pages.hasNextPage && (
                <Center><Button variant="subtle" loading={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>Load more</Button></Center>
              )}
            </div>
          )}
    </Stack>
  );
}
