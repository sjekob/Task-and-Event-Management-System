import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Landmark, Lock, XCircle } from 'lucide-react';
import { EVALUATOR_ROLES, PublicEvaluationController } from '@shared/controllers/PublicEvaluationController';
import { Format } from '@shared/utils/format';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Field, Select, Spinner, TextArea, TextInput } from '../../ui/kit';

/**
 * /eval/:eventId — public observation tool reached from the event's QR code.
 * /attendance/:eventId/:index/evaluate — a signed-in attendee's evaluation of
 * one activity after Time Out (no name/email).
 * /eval/:eventId?session=N — a guest's evaluation of that session after their
 * Time Out: their saved details are filled in; submitting completes their attendance.
 */
export default function PublicEvaluationView() {
  const { eventId = '', index } = useParams();
  const [search] = useSearchParams();
  const sessionParam = search.get('session');
  const session = index === undefined && sessionParam !== null && /^\d+$/.test(sessionParam) ? Number(sessionParam) : null;
  const services = useServices();
  const fb = useFeedback();
  const activityIndex = index === undefined ? null : Number(index);
  const [c, s] = useScreenController(() => new PublicEvaluationController(services, eventId, activityIndex, session), [eventId, activityIndex, session]);
  useEffect(() => { void c.load(); }, [c]);

  const panel = (icon: React.ReactNode, title: string, body: string) => (
    <div className="col center" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
      {icon}
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 16 }}>{title}</div>
      <div className="body-md mt-8">{body}</div>
    </div>
  );

  let body: React.ReactNode;
  if (s.view === 'loading') body = <div className="center-fill" style={{ height: 200 }}><Spinner /></div>;
  else if (s.view === 'error') body = panel(<AlertCircle size={56} color="var(--red)" />, 'Unable to load event', s.message);
  else if (s.view === 'locked') body = panel(<Lock size={56} color="var(--amber)" />, String(s.event?.title ?? 'Event Evaluation'), s.message);
  else if (s.view === 'submitted') {
    body = panel(<CheckCircle2 size={56} color="var(--green)" />, 'Evaluation Submitted!', c.isAttendee || c.isGuestSession
      ? 'Thank you! Your attendance for this session is complete.'
      : 'Thank you for your response. Your feedback helps improve our future events.');
  }
  else {
    const e = s.event!;
    const monitoring = String(e.monitoring_criteria ?? '').trim();
    body = (
      <div className="col gap-16">
        <div className="row gap-12" style={{ paddingBottom: 12, borderBottom: '2px solid var(--dark)' }}>
          <span className="avatar" style={{ width: 44, height: 44, background: 'var(--dark)' }}><Landmark size={24} /></span>
          <div><div style={{ fontSize: 15, fontWeight: 800 }}>Kagawaran ng Edukasyon</div><div style={{ fontSize: 11, color: 'var(--text-2)' }}>Performance Observation Tool</div></div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{String(e.title ?? 'Event Evaluation')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{c.details}</div>
          {s.activity && (
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
              Activity: {s.activity.activity.event?.trim() || `Activity ${s.activity.activity_index + 1}`}
            </div>
          )}
          {c.isGuestSession && <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>Session {(c.session ?? 0) + 1} · submitting this completes your attendance</div>}
        </div>
        {monitoring && <div><div style={{ fontSize: 12, fontWeight: 700 }}>Monitoring &amp; Evaluation Criteria</div><div className="caption mt-4">{monitoring}</div></div>}
        {!c.isAttendee && <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Name (optional)"><TextInput value={s.name} onChange={(ev) => c.setName(ev.target.value)} /></Field>
          <Field label="I am a...">
            <Select value={s.role} onChange={(ev) => c.set({ role: ev.target.value })}>
              {EVALUATOR_ROLES.map((r) => <option key={r} value={r}>{Format.titleCase(r)}</option>)}
            </Select>
          </Field>
        </div>}
        {!c.isAttendee && (
          <Field label="Email (required)" help={c.isGuestSession ? 'Use the email you timed in and out with.' : 'Each email can submit this evaluation only once.'}>
            <TextInput type="email" value={s.email} onChange={(ev) => c.set({ email: ev.target.value })} />
          </Field>
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>About you</div>
          <div className="caption mt-4">Used only to summarize who evaluated the event.</div>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Sex (required)">
            <Select value={s.sex ?? ''} onChange={(ev) => c.set({ sex: ev.target.value || null })}>
              <option value="">Select…</option>
              {c.options('sex').map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Age group (required)">
            <Select value={s.ageGroup ?? ''} onChange={(ev) => c.set({ ageGroup: ev.target.value || null })}>
              <option value="">Select…</option>
              {c.options('age_group').map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="School / office / organization (optional)"><TextInput value={s.affiliation} onChange={(ev) => c.set({ affiliation: ev.target.value })} /></Field>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Observation Indicators</div>
          <div className="caption mt-4">Mark each indicator as Evident or Not Evident based on what you observed.</div>
        </div>
        {c.indicators.map((label, i) => (
          <div key={i} style={{ background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {label}</div>
            <div className="row gap-8 mt-8">
              {([[true, 'Evident', 'var(--green)'], [false, 'Not Evident', 'var(--red)']] as const).map(([v, l, color]) => {
                const on = s.marks[i] === v;
                return (
                  <button key={l} type="button" onClick={() => c.mark(i, v)} className="grow row center gap-6"
                    style={{ padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: on ? `color-mix(in srgb, ${color} 12%, white)` : '#fff', color: on ? color : 'var(--muted)', border: `${on ? 1.4 : 0.8}px solid ${on ? color : 'var(--light)'}` }}>
                    {v ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{l}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <Field label="Overall comments (optional)"><TextArea rows={3} value={s.comments} onChange={(ev) => c.set({ comments: ev.target.value })} /></Field>
        <Button block size="lg" loading={s.submitting} style={{ background: 'var(--dark)' }}
          onClick={async () => { const err = await c.submit(); if (err) fb.toast(err, 'error'); }}>
          Submit Evaluation
        </Button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-3)', padding: '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>{body}</div>
    </div>
  );
}
