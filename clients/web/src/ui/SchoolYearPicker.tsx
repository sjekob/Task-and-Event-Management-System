import { useMemo } from 'react';
import { Archive, CalendarRange } from 'lucide-react';
import { SchoolYearPickerController } from '@shared/controllers/SchoolYearPickerController';
import { SchoolYearFilter } from '@shared/models';
import { useServices } from '../app/AppContext';
import { useScreenController } from '../app/hooks';

/** Chooses the school year (optionally a term) a list shows; hidden until years exist. */
export function SchoolYearPicker({ value, onChange, includeTerms }: {
  value: SchoolYearFilter; onChange: (f: SchoolYearFilter) => void; includeTerms?: boolean;
}) {
  const services = useServices();
  const [c, s] = useScreenController(() => new SchoolYearPickerController(services, includeTerms), [includeTerms]);
  const options = useMemo(() => c.options(), [c, s.years]);
  if (!options.length) return null;
  const selected = c.selected(value)!;
  const archived = selected.note === 'Archived';
  return (
    <label className="row gap-8" style={{
      padding: '0 10px', height: 38, borderRadius: 10, background: archived ? 'var(--amber-bg)' : '#fff',
      border: `1px solid ${archived ? 'var(--amber)' : 'var(--border-strong)'}`,
    }}>
      {archived ? <Archive size={16} color="#92400e" /> : <CalendarRange size={16} color="var(--muted)" />}
      <select
        value={selected.key}
        onChange={(e) => onChange(options.find((o) => o.key === e.target.value)!.filter)}
        style={{ border: 0, background: 'transparent', fontWeight: 600, fontSize: 13, outline: 'none', cursor: 'pointer', paddingRight: 4 }}
        aria-label="School year"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.indent ? '   ' : ''}{o.label}{o.note ? ` · ${o.note}` : ''}</option>
        ))}
      </select>
    </label>
  );
}
