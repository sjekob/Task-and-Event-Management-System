import { X } from 'lucide-react';
import { CatalogEntry } from '@shared/services';

/**
 * Multi-select over a fixed catalog: entries listed under their category,
 * each pick added as a removable chip; picked entries leave the list.
 */
export function CatalogMultiSelect({ label, selected, options, onChange }: {
  label: string; selected: string[]; options: CatalogEntry[]; onChange: (v: string[]) => void;
}) {
  const taken = new Set(selected.map((s) => s.toLowerCase()));
  const groups = new Map<string, CatalogEntry[]>();
  for (const o of options) {
    if (taken.has(o.name.toLowerCase())) continue;
    const g = o.category ?? 'Other';
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  const remaining = [...groups.values()].reduce((n, l) => n + l.length, 0);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <select className="select" value="" disabled={!remaining}
        onChange={(e) => e.target.value && onChange([...selected, e.target.value])}>
        <option value="">{!options.length ? 'Loading list...' : !remaining ? `All ${label.toLowerCase()} added` : 'Select to add'}</option>
        {[...groups.entries()].map(([g, items]) => (
          <optgroup key={g} label={g.toUpperCase()}>
            {items.map((o) => <option key={o.id} value={o.name}>{o.name}{o.issuer ? ` — ${o.issuer}` : ''}</option>)}
          </optgroup>
        ))}
      </select>
      {selected.length > 0 && (
        <div className="row wrap gap-6 mt-4">
          {selected.map((s) => (
            <span key={s} className="chip removable" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-3)', color: 'var(--text)', fontSize: 12 }}>
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(selected.filter((x) => x !== s))}><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
