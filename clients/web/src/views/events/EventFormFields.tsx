import { ReactNode } from 'react';
import { MinusCircle, Plus } from 'lucide-react';
import { ProposalFormController, RowListKey } from '@shared/controllers/EventControllers';
import { Button } from '../../ui/kit';

// Inputs and row grids used by the proposal form steps.
export function L({ t, children }: { t: string; children: ReactNode }) {
  return <div><span className="pf-lbl">{t}</span>{children}</div>;
}

export function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <div className="mt-8"><Button variant="ghost" size="sm" className="pf-add" icon={<Plus size={16} />} onClick={onClick}>{label}</Button></div>;
}

export function Rm({ onClick }: { onClick: () => void }) {
  return <button className="pf-rm" title="Remove" onClick={onClick}><MinusCircle size={20} /></button>;
}

export function Grid({ head, children }: { head: [string, number][]; children: ReactNode }) {
  return (
    <div className="pf-grid">
      <div className="pf-grid-head">{head.map(([h, f]) => <span key={h} style={{ flex: f }}>{h}</span>)}<span style={{ width: 28 }} /></div>
      {children}
    </div>
  );
}

export function RowGrid({ list, c, rows, cols }: { list: RowListKey; c: ProposalFormController; rows: object[]; cols: [string, string, number, string][] }) {
  return (
    <Grid head={cols.map(([, h, f]) => [h, f])}>
      {rows.map((r, i) => (
        <div key={i} className="pf-grid-row">
          {cols.map(([k, , f, hint]) => (
            <input key={k} className="pf-in" style={{ flex: f, minWidth: 0 }} placeholder={hint} value={(r as Record<string, string>)[k] ?? ''} onChange={(e) => c.setRow(list, i, k, e.target.value)} />
          ))}
          <Rm onClick={() => c.removeRow(list, i)} />
        </div>
      ))}
    </Grid>
  );
}
