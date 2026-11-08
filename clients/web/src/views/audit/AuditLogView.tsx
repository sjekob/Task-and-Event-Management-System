import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { AUDIT_FILTERS, AuditLogController } from '@shared/controllers/AuditControllers';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { AuditEntryTile } from '../../ui/Audit';
import { Banner, Button, Spinner } from '../../ui/kit';

export default function AuditLogView() {
  const services = useServices();
  const [c, s] = useScreenController(() => new AuditLogController(services), []);
  useEffect(() => { void c.load(); }, [c]);
  return (
    <div className="col gap-16">
      <Banner title="Audit Log" subtitle="Every change to accounts, roles and delegations, certificate reviews, school years, event approvals and task assignments, with who made it and when. Entries cannot be edited or deleted." />
      <div className="row wrap gap-12">
        <div className="input-icon" style={{ width: 340, maxWidth: '100%' }}>
          <Search size={18} />
          <input className="input" style={{ border: 0 }} placeholder="Search by person or description…" value={s.query} onChange={(e) => c.setQuery(e.target.value)} />
        </div>
        {AUDIT_FILTERS.map((f) => (
          <button key={f.value} className={`chip selectable ${s.filter === f.value ? 'on' : ''}`}
            style={s.filter === f.value ? { background: 'var(--dark)', borderColor: 'var(--dark)' } : undefined}
            onClick={() => c.setFilter(f.value)}>{f.label}</button>
        ))}
      </div>
      {s.error ? <div className="body-md" style={{ color: 'var(--red)' }}>{s.error}</div>
        : s.loading && !s.items.length ? <div className="center-fill"><Spinner /></div>
        : !s.items.length ? <div className="empty">No matching activity.</div>
        : (
          <div>
            <div className="caption mb-8">{s.total} {s.total === 1 ? 'entry' : 'entries'}</div>
            {s.items.map((e) => <AuditEntryTile key={e.id} entry={e} />)}
            {c.hasMore && (
              <div className="center-fill" style={{ padding: 8 }}>
                <Button variant="ghost" disabled={s.loadingMore} onClick={() => void c.loadMore()}>{s.loadingMore ? 'Loading…' : 'Load more'}</Button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
