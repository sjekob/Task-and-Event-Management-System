import { Select } from '@mantine/core';
import { IconArchive, IconCalendarStats } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, CURRENT_YEAR, qk, type SchoolYearFilter } from '@tasknet/shared';
import { colors } from '../theme';

const keyOf = (f: SchoolYearFilter) => `${f.schoolYear}|${f.termId ?? ''}`;

/**
 * Which school year (optionally a term) a list shows. Lists default to the
 * current year; ended years are "archived". Hidden until a school year exists.
 */
export function SchoolYearPicker({ value, onChange, includeTerms = false }: {
  value: SchoolYearFilter; onChange: (f: SchoolYearFilter) => void; includeTerms?: boolean;
}) {
  const years = useQuery({ queryKey: qk.schoolYears, queryFn: api.schoolYears.list });
  if (!years.data?.length) return null;

  const current = years.data.find((y) => y.is_selected_default);
  const options = new Map<string, { filter: SchoolYearFilter; label: string; note?: string }>();
  const add = (filter: SchoolYearFilter, label: string, note?: string) => options.set(keyOf(filter), { filter, label, note });

  add(CURRENT_YEAR, current ? `S.Y. ${current.name}` : 'Current school year', current ? 'Current' : undefined);
  for (const y of years.data) {
    if (y.id !== current?.id) {
      add({ schoolYear: String(y.id) }, `S.Y. ${y.name}`,
        y.status === 'archived' ? 'Archived' : y.status === 'upcoming' ? 'Upcoming' : undefined);
    }
    if (includeTerms) {
      for (const t of y.terms) {
        add({ schoolYear: String(y.id), termId: t.id }, `${t.name} · ${y.name}`, t.status === 'current' ? 'Now' : undefined);
      }
    }
  }
  add({ schoolYear: 'all' }, 'All school years');

  const selected = options.has(keyOf(value)) ? keyOf(value) : keyOf(CURRENT_YEAR);
  const archived = options.get(selected)?.note === 'Archived';

  return (
    <Select
      w={260}
      allowDeselect={false}
      value={selected}
      onChange={(k) => k && onChange(options.get(k)!.filter)}
      data={[...options.entries()].map(([k, o]) => ({ value: k, label: o.note ? `${o.label} · ${o.note}` : o.label }))}
      leftSection={archived ? <IconArchive size={16} color="#92400E" /> : <IconCalendarStats size={16} />}
      styles={archived ? { input: { background: colors.amberBg, borderColor: colors.amber } } : undefined}
      aria-label="School year"
    />
  );
}
