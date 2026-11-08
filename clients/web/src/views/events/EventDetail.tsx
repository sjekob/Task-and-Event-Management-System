import { ReactNode, useState } from 'react';
import { ArrowLeft, CalendarDays, ClipboardCheck, Flag, GitBranch, IdCard, Lightbulb, ListChecks, MapPin, PenLine, Printer, QrCode, Route, Tag, User as UserIcon, Users, Wallet, PiggyBank } from 'lucide-react';
import { ProposalView } from '@shared/controllers/EventControllers';
import { EventItem } from '@shared/models';
import { Button, IconButton } from '../../ui/kit';
import { AttendanceQrDialog } from './AttendanceQrDialog';
import { Bullets, Card, Field, Meta, StatusBadge, Table } from './EventDetailParts';

// Full-page proposal view with approve / disable / print.
export const FACT_ICON = { category: <Tag size={19} />, place: <MapPin size={19} />, wallet: <Wallet size={19} />, savings: <PiggyBank size={19} /> };

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Full-page proposal view; [actions] are the buttons under the title, [top] / [bottom] extra panels. */
export function EventDetail({ event, onBack, onPrint, actions, attendance, top, bottom }: {
  event: EventItem; onBack: () => void; onPrint: () => void; actions?: ReactNode;
  /** Show the attendance QR codes (approved event; proponent or approver). */
  attendance?: boolean;
  /** Above the proposal (the returned-proposal banner). */
  top?: ReactNode;
  /** After it (venue map, attendance list, review history). */
  bottom?: ReactNode;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const p = new ProposalView(event.raw);
  const r = event.raw;
  const sec = p.sections;
  const sections: { title: string; icon: ReactNode; body: ReactNode }[] = [];
  if (sec.rationale) sections.push({ title: 'Rationale', icon: <Lightbulb size={18} />, body: <div className="ev-body">{String(r.rationale)}</div> });
  if (sec.objectives) sections.push({ title: 'Objectives', icon: <Flag size={18} />, body: <Bullets items={p.objectives} /> });
  if (sec.methodology) {
    const m = p.methodology;
    sections.push({
      title: 'Methodology / Work plan', icon: <Route size={18} />, body: (
        <div>
          {m.steps.map((st, i) => (
            <div key={i} className="row-top gap-12" style={{ marginBottom: 14 }}>
              <span className="ev-step">{i + 1}</span>
              <div>
                {st.stage && <div style={{ fontSize: 14, fontWeight: 700 }}>{st.stage}</div>}
                {st.activities.map((a, j) => <div key={j} style={{ fontSize: 13.5, color: '#4a5568', marginTop: 3, lineHeight: 1.4 }}>• {a}</div>)}
              </div>
            </div>
          ))}
          {m.legacy.map((l) => <Field key={l.label} label={l.label} value={l.text} />)}
        </div>
      ),
    });
  }
  if (sec.matrix) {
    const cols: [string, string][] = [['day', 'Day'], ['time', 'Time'], ['event', 'Activity'], ['speaker', 'Speaker/Facilitator']];
    sections.push({ title: 'Activity matrix', icon: <CalendarDays size={18} />, body: <Table rows={p.activityMatrix} cols={cols} raw={r.activity_matrix} /> });
  }
  if (sec.budget) {
    sections.push({
      title: 'Budget', icon: <Wallet size={18} />, body: (
        <div>
          {p.materials && <><div className="ev-sub">Training materials</div><Table rows={p.materials} cols={[['item', 'Item'], ['qty', 'Qty'], ['cost', 'Cost'], ['total', 'Total']]} /></>}
          {p.snacks && <><div className="ev-sub mt-16">Meals / snacks</div><Table rows={p.snacks} cols={[['item', 'Item'], ['pax', 'Participants'], ['cost', 'Cost/Day'], ['total', 'Total']]} /></>}
        </div>
      ),
    });
  }
  if (sec.committees) {
    sections.push({
      title: 'Committees', icon: <GitBranch size={18} />, body: (
        <div>
          {p.execCommittee && <><div className="ev-sub">Executive committee</div>
            {p.execCommittee.map((m, i) => { const pos = String(m.position ?? m.designation ?? ''); return <div key={i} className="ev-li">• {String(m.name ?? '')}{pos ? ` — ${pos}` : ''}</div>; })}</>}
          {p.twg && <><div className="ev-sub mt-12">Technical working groups</div>
            {p.twg.map((g, i) => (
              <div key={i}>
                {g.title && <div style={{ fontSize: 11, fontWeight: 600, color: '#718096', margin: '6px 0 4px', letterSpacing: 0.3 }}>{g.title}</div>}
                {g.members.map((m, j) => <div key={j} className="ev-li" style={{ marginLeft: 8 }}>• {String(m.name ?? '')}{m.designation ? ` — ${m.designation}` : ''}</div>)}
              </div>
            ))}</>}
        </div>
      ),
    });
  }
  if (sec.monitoring) {
    sections.push({
      title: 'Monitoring & evaluation', icon: <ClipboardCheck size={18} />, body: (
        <div>
          {ProposalView.has(r.monitoring_criteria) && <div className="ev-body">{String(r.monitoring_criteria)}</div>}
          {p.indicators.length > 0 && <><div className="ev-sub">Indicators</div>{p.indicators.map((l, i) => <div key={i} className="ev-li">{i + 1}. {l}</div>)}</>}
        </div>
      ),
    });
  }
  if (sec.signatories) {
    const sg = p.signatories;
    sections.push({
      title: 'Signatories', icon: <PenLine size={18} />, body: typeof sg === 'string' ? <div className="ev-li">{sg}</div> : (
        <div className="row wrap gap-12">
          {(sg ?? []).map((x, i) => (
            <div key={i} className="ev-sig">
              {x.role && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: '#718096' }}>{x.role.toUpperCase()}</div>}
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{x.name || '—'}</div>
              {x.title && <div style={{ fontSize: 12.5, color: '#4a5568' }}>{x.title}</div>}
            </div>
          ))}
        </div>
      ),
    });
  }
  const participants = p.participants;
  const focal = p.focal;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="col gap-16">
      {top}
      <div className="ev-panel">
        <div className="row-top gap-12">
          <IconButton title="Back to events" onClick={onBack} className="ev-back"><ArrowLeft size={20} /></IconButton>
          <div className="grow">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: '#718096' }}>EVENT PROPOSAL</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>{event.title}</div>
          </div>
          <StatusBadge e={event} />
        </div>
        <div className="row wrap" style={{ gap: '10px 22px', marginTop: 16 }}>
          {event.creatorName && <Meta icon={<UserIcon size={16} />} text={`Proposed by ${event.creatorName}`} />}
          {ProposalView.has(r.target_date) && <Meta icon={<CalendarDays size={16} />} text={String(r.target_date)} />}
          {ProposalView.has(r.venue) && <Meta icon={<MapPin size={16} />} text={String(r.venue)} />}
        </div>
        <hr className="divider" style={{ margin: '18px 0 14px', background: '#e2e8f0' }} />
        <div className="row wrap gap-10">
          {actions}
          <Button variant="outline-muted" size="lg" icon={<Printer size={18} />} onClick={onPrint}>Print proposal</Button>
          {attendance && <Button variant="outline-muted" size="lg" icon={<QrCode size={18} />} onClick={() => setQrOpen(true)}>Attendance QR codes</Button>}
        </div>
        {qrOpen && <AttendanceQrDialog eventId={event.id} onClose={() => setQrOpen(false)} />}
      </div>

      <div className="ev-facts">
        {p.facts.map((f) => (
          <div key={f.label} className="ev-fact">
            <span className="att-icon" style={{ width: 38, height: 38, borderRadius: 10, background: '#eef2fa', color: 'var(--dark)' }}>{FACT_ICON[f.icon]}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: '#718096' }}>{f.label}</div>
              <div className="clamp-2" style={{ fontSize: 14.5, fontWeight: 700 }}>{f.value.trim() || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {(focal || participants) && (
        <div className="ev-two">
          {focal && <Card icon={<IdCard size={18} />} title="Focal person" style={{ width: participants ? 320 : undefined }}>{focal.map((f) => <Field key={f.label} label={f.label} value={f.value} />)}</Card>}
          {participants && (
            <Card icon={<Users size={18} />} title="Target participants" style={{ flex: 1, minWidth: 0 }}>
              {typeof participants === 'string' ? <Field label="Participants" value={participants} /> : (
                <Table rows={participants.rows} cols={[['category', 'Category'], ['male', 'Male'], ['female', 'Female'], ['total', 'Total']]}
                  footer={participants.totals ? ['Total', participants.totals.male, participants.totals.female, participants.totals.total] : undefined} />
              )}
            </Card>
          )}
        </div>
      )}

      {p.outputs.length > 0 && <Card icon={<ListChecks size={18} />} title="Expected outputs"><Bullets items={p.outputs} small /></Card>}

      {sections.map((x, i) => (
        <div key={x.title} className="ev-panel">
          <div className="row gap-8 mb-12">
            <span className="ev-roman">{ROMAN[i + 1] ?? i + 2}</span>
            <span style={{ color: '#4a5568', display: 'flex' }}>{x.icon}</span>
            <span style={{ fontSize: 15.5, fontWeight: 700 }}>{x.title}</span>
          </div>
          {x.body}
        </div>
      ))}
      {bottom}
    </div>
  );
}
