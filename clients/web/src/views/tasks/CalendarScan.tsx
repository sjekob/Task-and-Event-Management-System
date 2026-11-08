import { CalendarDays, CalendarSearch, Plus, X } from 'lucide-react';
import type { CalendarTaskProposal } from '@shared/models';
import { CALENDAR_KIND, CalendarScanController } from '@shared/controllers/CalendarScanController';
import { useControllerState } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Badge, Button, IconButton, Modal, Select, TextArea, TextInput, pickFiles } from '../../ui/kit';

const DATE_INPUT = { width: 140, padding: '4px 8px', fontSize: 12.5 };
const NOWRAP = { whiteSpace: 'nowrap' as const };
const ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain';

/** Principal/admin: read a school calendar and post the tasks it lists (Task Manager). */
export function CalendarScanButton({ c, onPosted }: { c: CalendarScanController; onPosted: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(c);
  const pick = async () => {
    const [file] = await pickFiles(ACCEPT);
    if (!file) return;
    const err = await c.scan({ name: file.name, type: file.type, blob: file });
    if (err) fb.toast(err, 'error');
  };
  return (
    <>
      <Button variant="outline" size="sm" icon={<CalendarSearch size={16} />} loading={s.scanning} onClick={() => void pick()}
        title="Read a school calendar (PDF, Word or photo) and post the tasks it lists">
        {s.scanning ? 'Reading calendar…' : 'Scan school calendar'}
      </Button>
      {s.rows && <CalendarTasksDialog c={c} onPosted={onPosted} />}
    </>
  );
}

function CalendarTasksDialog({ c, onPosted }: { c: CalendarScanController; onPosted: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(c);
  const rows = s.rows ?? [];
  const post = async () => {
    const r = await c.post();
    fb.toast(r.message, r.error ? 'error' : 'success');
    if (r.posted > 0) onPosted();
  };
  return (
    <Modal title="Tasks from the school calendar" subtitle={`Read from ${s.fileName}`} icon={<CalendarSearch size={20} />} size="wide"
      locked={s.posting} onClose={() => c.close()}
      footer={<>
        <span className="caption grow">{c.summary}</span>
        <Button variant="ghost" disabled={s.posting} onClick={() => c.close()}>Cancel</Button>
        <Button loading={s.posting} disabled={!c.chosen.length} onClick={() => void post()}>
          Post {c.chosen.length} task{c.chosen.length === 1 ? '' : 's'}
        </Button>
      </>}>
      <div className="caption mb-12">
        These are the reports the calendar calls for; they are grouped under the calendar entry they come from. "End of Term 1", for
        example, means teachers submit their Term 1 grades. "Teachers → their dean" assigns every teacher, and each one submits
        to the dean of their grade level. Narrative reports and training outputs are optional and start unticked.
      </div>
      <div className="row gap-12 mb-12">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Send all ticked to</span>
        <Select style={{ width: 240 }} value="" disabled={s.posting} onChange={(e) => e.target.value && c.setAllRoutes(e.target.value)}>
          <option value="">Keep each row's choice</option>
          {c.routeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div className="col" style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 420, overflowY: 'auto' }}>
        {c.groups.map((g) => (
          <div key={`${g.source}-${g.date}`}>
            <div className="row gap-8" style={{ padding: '8px 12px', background: 'var(--surface-2, var(--bg))', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
              <CalendarDays size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{g.source}</span>
              {g.date && <span className="caption">· {g.date}</span>}
            </div>
            {g.items.map(({ row: r, index: i }) => <CalendarTaskRow key={i} c={c} r={r} i={i} posting={s.posting} />)}
            <div style={{ padding: '4px 12px 6px 32px', borderBottom: '1px solid var(--border)' }}>
              <Button variant="ghost" size="sm" icon={<Plus size={15} />} disabled={s.posting}
                onClick={() => c.addTask(g.items[g.items.length - 1].index)}>Add a task</Button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="caption" style={{ padding: 16 }}>None of the calendar's entries call for a report.</div>}
      </div>
    </Modal>
  );
}

function CalendarTaskRow({ c, r, i, posting }: { c: CalendarScanController; r: CalendarTaskProposal; i: number; posting: boolean }) {
  const k = CALENDAR_KIND[r.kind] ?? CALENDAR_KIND.other;
  const manual = r.kind === 'manual';
  return (
    <div className="col gap-8" style={{ padding: '10px 12px 10px 36px', borderBottom: '1px solid var(--border)', opacity: r.selected ? 1 : 0.65 }}>
      <div className="row gap-12">
        <input type="checkbox" checked={r.selected} disabled={posting} aria-label={`Post ${r.title}`}
          onChange={(e) => c.update(i, { selected: e.target.checked })} />
        <input className="input grow" value={r.title} disabled={posting} aria-label="Task title" autoFocus={manual && !r.title}
          placeholder="Task title, e.g. Submission of Lesson Plans" onChange={(e) => c.update(i, { title: e.target.value })}
          style={{ minWidth: 0, fontWeight: 600, fontSize: 13, padding: '6px 10px' }} />
        <Select style={{ width: 236, flexShrink: 0 }} value={r.route} disabled={posting || !r.selected} aria-label="Assign to"
          onChange={(e) => c.update(i, { route: e.target.value })}>
          {c.routeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        {manual
          ? <IconButton small title="Remove this task" disabled={posting} onClick={() => c.remove(i)}><X size={16} /></IconButton>
          : <Badge color={k.tone}>{k.label}</Badge>}
      </div>
      <div className="row gap-8" style={{ paddingLeft: 25, flexWrap: 'wrap' }}>
        <span className="caption" style={NOWRAP}>Start</span>
        <TextInput type="date" value={r.startDate} disabled={posting} aria-label="Start date"
          onChange={(e) => c.setDate(i, 'startDate', e.target.value)} style={DATE_INPUT} />
        <span className="caption" style={NOWRAP}>Due</span>
        <TextInput type="date" value={r.endDate} disabled={posting} aria-label="Due date"
          onChange={(e) => c.setDate(i, 'endDate', e.target.value)} style={DATE_INPUT} />
        <span className="caption" style={NOWRAP}>at 5:00 PM</span>
        {r.past && <span className="caption" style={{ ...NOWRAP, color: 'var(--warning, #b45309)' }}>· already past</span>}
      </div>
      {r.selected && (
        <div className="col gap-4" style={{ paddingLeft: 25 }}>
          <TextArea rows={2} value={r.instructions} disabled={posting} aria-label="Description"
            placeholder="Description — written for you once the title is filled in"
            onChange={(e) => c.setDescription(i, e.target.value)} style={{ fontSize: 12.5, resize: 'vertical' }} />
          {r.autoDescribe && r.instructions && <span className="caption">Written from the title, route and due date. Edit it to make it your own.</span>}
        </div>
      )}
    </div>
  );
}
