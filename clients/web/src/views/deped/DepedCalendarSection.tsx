import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DepedCalendarController } from '@shared/controllers/DepedControllers';
import { DepedEntry } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, IconButton, Spinner } from '../../ui/kit';
import { DepedEntryDialog, DepedTag } from './DepedDialogs';

/** The official DepEd school-calendar dates shown on every calendar (School Year page). */
export function DepedCalendarSection() {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new DepedCalendarController(services, user), [user]);
  const [editing, setEditing] = useState<DepedEntry | 'new' | null>(null);
  useEffect(() => { void c.load(); }, [c]);

  const remove = async (e: DepedEntry) => {
    if (!await fb.confirm({ title: 'Remove DepEd date', message: `Remove "${e.title}"?`, confirmLabel: 'Remove', danger: true })) return;
    try { await c.remove(e); fb.toast('DepEd date removed'); } catch (err) { fb.error(err); }
  };

  return (
    <div className="col gap-12 mt-16">
      <div className="row gap-8">
        <span style={{ fontSize: 18, fontWeight: 700 }}>DepEd school calendar</span><DepedTag />
        <span className="grow" />
        {c.canManage && <Button icon={<Plus size={18} />} onClick={() => setEditing('new')}>Add DepEd date</Button>}
      </div>
      <div className="caption">
        Official memorandum dates shown on every calendar. Mandatory entries warn proponents who pick an overlapping
        event date. Confirm the dates against the DepEd Order for the school year.
      </div>
      <div className="card flat" style={{ padding: 0, borderColor: '#e3e9f3' }}>
        {s.loading ? <div className="center-fill" style={{ height: 90 }}><Spinner /></div>
          : s.error ? <div className="field-error" style={{ padding: 16 }}>{s.error}</div>
          : !s.entries.length ? <div className="caption" style={{ padding: 16 }}>No DepEd dates yet.</div>
          : c.ordered.map((e) => (
            <div key={e.id} className="row gap-12" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 36, borderRadius: 3, background: 'var(--deped)', flexShrink: 0 }} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                <div className="caption">{e.range} · {e.category}{e.isMandatory ? ' · Mandatory' : ''}</div>
              </div>
              {c.canManage && <>
                <IconButton small title="Edit" onClick={() => setEditing(e)}><Pencil size={17} /></IconButton>
                <IconButton small title="Remove" onClick={() => void remove(e)}><Trash2 size={17} color="var(--red)" /></IconButton>
              </>}
            </div>
          ))}
      </div>
      {editing && (
        <DepedEntryDialog existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void c.load(); }} />
      )}
    </div>
  );
}
