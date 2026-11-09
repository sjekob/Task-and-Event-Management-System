import { useEffect } from 'react';
import { AlertCircle, CalendarDays, CalendarX, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Crown, Landmark, ListOrdered, MapPin, NotebookText,
  PackageCheck, PenLine, RefreshCw, Tag, Target, User as UserIcon, Users, UsersRound, Wallet, X } from 'lucide-react';
import { ActivityController } from '@shared/controllers/ActivityController';
import { EventItem } from '@shared/models';
import { EventFormat } from '@shared/utils/eventFormat';
import { Format } from '@shared/utils/format';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Banner, Bone, Button, IconButton } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';
import './eventDetail.css';

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

/** Read-only proposal details: header, overview tiles, then each part of the proposal laid out for its kind of data. */
export function EventDetailDialog({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const d = EventFormat.details(event.raw);
  const r = event.raw;
  const date = d.facts.find((f) => f.key === 'date')?.value;
  const venue = d.facts.find((f) => f.key === 'venue')?.value;
  const focal = [d.focal.role, d.focal.contact].filter(Boolean).join(' · ');
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide ed" style={{ maxWidth: 720, overflow: 'hidden' }}>
        <div className="ed-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap-8">
              <span className="ed-title ellipsis">{event.title || 'Event Details'}</span>
              <EventStatusChip status={event.status} />
            </div>
            {(date || venue) && (
              <div className="ed-sub">
                {date && <span className="row gap-4"><CalendarDays size={14} />{date}</span>}
                {venue && <span className="row gap-4"><MapPin size={14} />{venue}</span>}
              </div>
            )}
          </div>
          <button className="icon-btn-plain ed-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="modal-body ed-body">
          <div className="ed-facts">
            {d.facts.filter((f) => f.key !== 'date' && f.key !== 'venue').map((f) => (
              <Fact key={f.key} icon={FACT_ICONS[f.key]} label={f.label} value={f.value} />
            ))}
            {d.focal.name && <Fact icon={<UserIcon size={16} />} label="Focal Person" value={d.focal.name} sub={focal} />}
          </div>

          {d.participants.length > 0 && (
            <Section icon={<Users size={16} />} title="Participants">
              <table className="ed-table">
                <thead><tr><th>Group</th><th>Male</th><th>Female</th><th>Total</th></tr></thead>
                <tbody>
                  {d.participants.map((p) => <tr key={p.category}><td>{p.category}</td><td>{p.male}</td><td>{p.female}</td><td>{p.total}</td></tr>)}
                  {d.totals && <tr className="ed-total"><td>Total</td><td>{d.totals.male}</td><td>{d.totals.female}</td><td>{d.totals.total}</td></tr>}
                </tbody>
              </table>
            </Section>
          )}

          {d.rationale && <Section icon={<NotebookText size={16} />} title="Rationale"><p className="ed-text">{d.rationale}</p></Section>}
          {d.objectives.length > 0 && <Section icon={<Target size={16} />} title="Objectives"><Bullets items={d.objectives} /></Section>}
          {d.outputs.length > 0 && <Section icon={<PackageCheck size={16} />} title="Expected Outputs"><Bullets items={d.outputs} check /></Section>}

          {d.phases.length > 0 && (
            <Section icon={<ListOrdered size={16} />} title="Implementation Phases">
              <ol className="ed-steps">
                {d.phases.map((p, i) => (
                  <li key={i}>
                    <span className="ed-step-no">{i + 1}</span>
                    <div>
                      <div className="ed-step-title">{p.stage}</div>
                      {p.activities.length > 0 && <ul className="ed-step-list">{p.activities.map((a) => <li key={a}>{a}</li>)}</ul>}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {d.schedule.length > 0 && (
            <Section icon={<Clock size={16} />} title="Activity Matrix">
              {d.schedule.map((g) => (
                <div key={g.day} className="ed-day">
                  {g.day && <div className="ed-day-label">{g.day}</div>}
                  <table className="ed-table">
                    <thead><tr><th style={{ width: 170 }}>Time</th><th>Activity</th><th>Speaker / In charge</th></tr></thead>
                    <tbody>{g.items.map((it, i) => <tr key={i}><td className="ed-nowrap">{it.time}</td><td>{it.activity}</td><td>{it.speaker}</td></tr>)}</tbody>
                  </table>
                </div>
              ))}
            </Section>
          )}

          {d.executives.length > 0 && (
            <Section icon={<Crown size={16} />} title="Executive Committee">
              <div className="ed-people">{d.executives.map((m) => <Person key={m.name + m.role} name={m.name} role={m.role} />)}</div>
            </Section>
          )}

          {d.groups.length > 0 && (
            <Section icon={<UsersRound size={16} />} title="Technical Working Groups">
              <div className="ed-groups">
                {d.groups.map((g) => (
                  <div key={g.title} className="ed-group">
                    <div className="ed-group-title">{g.title || 'Group'}</div>
                    <div className="ed-people">{g.members.map((m) => <Person key={m.name + m.role} name={m.name} role={m.role} />)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(d.monitoring || d.indicators.length > 0) && (
            <Section icon={<ClipboardCheck size={16} />} title="Monitoring and Evaluation">
              {d.monitoring && <p className="ed-text">{d.monitoring}</p>}
              {d.indicators.length > 0 && (
                <>
                  <div className="ed-minor">Evaluation indicators</div>
                  <ol className="ed-numbered">{d.indicators.map((x) => <li key={x}>{x}</li>)}</ol>
                </>
              )}
            </Section>
          )}

          {d.signatories.length > 0 && (
            <Section icon={<PenLine size={16} />} title="Signatories">
              <div className="ed-signs">
                {d.signatories.map((x) => (
                  <div key={x.name + x.role} className="ed-sign">
                    <div className="ed-sign-role">{x.role}</div>
                    <div className="ed-sign-name">{x.name}</div>
                    {x.title && <div className="ed-sign-title">{x.title}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {EventFormat.has(r.creator_name) && (
            <div className="ed-meta">
              <UserIcon size={14} />
              <span>Proposed by <b>{String(r.creator_name)}</b>{EventFormat.has(r.creator_role) ? ` (${r.creator_role})` : ''}</span>
              {EventFormat.has(r.created_at) && <span>· {Format.date(String(r.created_at))}</span>}
            </div>
          )}
        </div>
        <div className="modal-foot"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

const FACT_ICONS: Record<string, React.ReactNode> = {
  nature: <Tag size={16} />, fund: <Landmark size={16} />, budget: <Wallet size={16} />,
};

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="ed-fact">
      <span className="ed-fact-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="ed-fact-label">{label}</div>
        <div className="ed-fact-value">{value}</div>
        {sub && <div className="ed-fact-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="ed-section">
      <h3 className="ed-section-title"><span className="ed-section-icon">{icon}</span>{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items, check }: { items: string[]; check?: boolean }) {
  return (
    <ul className="ed-bullets">
      {items.map((x) => <li key={x}>{check ? <CheckCircle2 size={15} className="ed-check" /> : <span className="ed-dot" />}<span>{x}</span></li>)}
    </ul>
  );
}

function Person({ name, role }: { name: string; role: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="ed-person">
      <span className="ed-avatar">{initials}</span>
      <div style={{ minWidth: 0 }}>
        <div className="ed-person-name ellipsis">{name}</div>
        {role && <div className="ed-person-role ellipsis">{role}</div>}
      </div>
    </div>
  );
}
