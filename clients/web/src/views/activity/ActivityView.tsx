import { useEffect } from 'react';
import { AlertCircle, CalendarDays, CalendarX, ChevronRight, MapPin, NotebookText, RefreshCw, User as UserIcon, X } from 'lucide-react';
import { ActivityController } from '@shared/controllers/ActivityController';
import { EventItem } from '@shared/models';
import { EventFormat } from '@shared/utils/eventFormat';
import { Format } from '@shared/utils/format';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Banner, Bone, Button, IconButton } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';

const TONE = { green: ['#15803d', 'var(--green-bg)'], gray: ['var(--muted)', 'var(--border)'], amber: ['#92400e', 'var(--amber-bg)'] } as const;

export function EventStatusChip({ status }: { status: string }) {
  const [fg, bg] = TONE[ActivityController.statusTone(status)];
  return <span className="badge" style={{ color: fg, background: bg }}>{ActivityController.statusLabel(status)}</span>;
}

export default function ActivityView() {
  const services = useServices();
  const [c, s] = useScreenController(() => new ActivityController(services), []);
  useEffect(() => { void c.load(); }, [c]);

  return (
    <div className="col gap-16">
      <Banner title="Activity Calendar" subtitle="View all scheduled events and activities." />
      <div className="card" style={{ padding: 18 }}>
        <div className="row wrap gap-8 mb-12">
          <span className="h3 grow">{c.heading}</span>
          <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
          <IconButton title="Refresh" onClick={() => void c.load()}><RefreshCw size={18} /></IconButton>
        </div>
        {s.loading ? (
          <div className="col gap-8">{[0, 1, 2, 3, 4].map((i) => <Bone key={i} h={52} />)}</div>
        ) : s.error ? (
          <div className="empty">
            <AlertCircle size={36} color="var(--red)" />
            <div className="label">Failed to load events</div>
            <div className="body-md">{s.error}</div>
            <Button variant="ghost" onClick={() => void c.load()}>Retry</Button>
          </div>
        ) : s.events.length === 0 ? (
          <div className="empty"><CalendarX size={40} /><div>No events yet</div></div>
        ) : s.events.map((e) => (
          <button key={e.id} className="row-btn" style={{ padding: '12px 4px' }} onClick={() => c.open(e)}>
            <NotebookText size={16} color="var(--light)" />
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="label ellipsis" style={{ display: 'block' }}>{e.title || 'Untitled'}</span>
              <span className="row gap-4 body-sm" style={{ marginTop: 2 }}>
                {e.targetDate && <><CalendarDays size={11} />{Format.date(e.targetDate, e.targetDate)}</>}
                {e.venue && <><MapPin size={11} style={{ marginLeft: 8 }} /><span className="ellipsis">{e.venue}</span></>}
              </span>
            </span>
            <span className="col" style={{ alignItems: 'flex-end', gap: 3 }}>
              <EventStatusChip status={e.status} />
              <span className="row gap-4 caption"><ChevronRight size={14} />View details</span>
            </span>
          </button>
        ))}
      </div>
      {s.open && <EventDetailDialog event={s.open} onClose={() => c.open(null)} />}
    </div>
  );
}

/** Read-only proposal details (dark header, sections). */
export function EventDetailDialog({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const sec = EventFormat.sections(event.raw);
  const r = event.raw;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" style={{ maxWidth: 640, overflow: 'hidden' }}>
        <div className="row gap-8" style={{ background: 'var(--dark)', color: '#fff', padding: '16px 12px 16px 20px' }}>
          <CalendarDays size={18} color="rgba(255,255,255,0.7)" />
          <span className="grow ellipsis" style={{ fontWeight: 600, fontSize: 15 }}>{event.title || 'Event Details'}</span>
          <EventStatusChip status={event.status} />
          <button className="icon-btn-plain" onClick={onClose} aria-label="Close" style={{ color: 'rgba(255,255,255,0.7)' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20 }}>
          <Label>Event Information</Label>
          <InfoGrid items={sec.info} />
          {sec.focal.length > 0 && <><Label top>Focal Person</Label><InfoGrid items={sec.focal} /></>}
          {sec.blocks.map((b) => (
            <div key={b.title}>
              <Label top>{b.title}</Label>
              {b.phases ? b.phases.map((p) => (
                <div key={p.title} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{p.title}</div>
                  <Block text={p.text} />
                </div>
              )) : <Block text={b.text} />}
            </div>
          ))}
          {EventFormat.has(r.creator_name) && (
            <div className="row gap-6 caption" style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
              <UserIcon size={14} color="var(--light)" />
              <span>Created by <b style={{ fontWeight: 500, color: 'var(--text-2)' }}>{r.creator_name}{EventFormat.has(r.creator_role) ? ` (${r.creator_role})` : ''}</b></span>
              {EventFormat.has(r.created_at) && <span>· {Format.date(String(r.created_at))}</span>}
            </div>
          )}
        </div>
        <div className="modal-foot"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

function Label({ children, top }: { children: React.ReactNode; top?: boolean }) {
  return <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500, margin: `${top ? 16 : 0}px 0 8px` }}>{children}</div>;
}

function InfoGrid({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="row wrap" style={{ gap: '8px 12px', alignItems: 'flex-start' }}>
      {items.map((i) => (
        <div key={i.label} style={{ width: 200 }}>
          <div className="caption">{i.label}</div>
          <div className="label">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function Block({ text }: { text: string }) {
  return <div className="body-md pre-wrap" style={{ background: 'var(--bg)', borderRadius: 6, padding: 10 }}>{text}</div>;
}
