import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, MapPinOff, RefreshCw } from 'lucide-react';
import { AttendanceScanController, LOCATION_HELP, Locate } from '@shared/controllers/AttendanceScanController';
import { formatDistance } from '@shared/utils/geo';
import { Format } from '@shared/utils/format';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Field, Select, Spinner, TextInput } from '../../ui/kit';
import { VenueMap } from './VenueMap';

/** The browser's position, or why it couldn't be had. A pinned venue needs a fresh, precise fix. */
const locate: Locate = (precise) => {
  if (!('geolocation' in navigator)) return Promise.resolve({ problem: 'unsupported' as const });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ fix: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (err) => resolve({ problem: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: precise ? 15000 : 8000, maximumAge: precise ? 0 : 60_000 },
    );
  });
};

/**
 * /attendance/:eventId/:index/scan?action=time_in|time_out&code=… — opened by an
 * attendance QR. Public: signed-in personnel scan as themselves, anyone else
 * (students, parents, external stakeholders) fills a short guest form first.
 */
export default function AttendanceScanView() {
  const { user, restoring } = useSession();
  if (restoring) return <Page><Spinner /></Page>;
  return <Scan guest={!user} />;
}

function Scan({ guest }: { guest: boolean }) {
  const { eventId = '', index = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const services = useServices();
  const fb = useFeedback();
  const action = params.get('action') ?? '';
  const code = params.get('code') ?? '';
  const [c, s] = useScreenController(
    () => new AttendanceScanController(services, Number(eventId), Number(index), action, code, guest), [eventId, index, action, code, guest]);

  const after = (toEvaluation: boolean) => {
    if (!toEvaluation) return;
    fb.toast(c.state.message);
    navigate(c.evaluatePath, { replace: true });
  };
  useEffect(() => { void c.start(locate).then(after); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = c.label;
  const info = s.info;
  const pin = c.pin;
  const map = pin && (
    <div style={{ width: '100%', marginTop: 8 }}>
      <VenueMap pin={{ lat: pin.latitude, lng: pin.longitude }} radius={pin.radius_m} label={info?.venue ?? 'Venue'}
        you={s.fix ? { lat: s.fix.latitude, lng: s.fix.longitude } : null} height={240} />
      <div className="caption" style={{ textAlign: 'center', marginTop: 4 }}>Blue circle: the venue perimeter ({pin.radius_m} m). Orange dot: you.</div>
    </div>
  );
  const retry = <Button className="mt-12" icon={<RefreshCw size={16} />} onClick={() => void c.retry(locate).then(after)}>Try again</Button>;

  let body: ReactNode;
  if (s.step === 'loading' || s.step === 'locating' || s.step === 'submitting') {
    body = (
      <>
        <Spinner />
        <div className="caption">
          {s.step === 'loading' ? 'Loading activity…' : s.step === 'locating' ? (pin ? 'Checking that you are at the venue…' : 'Getting your location for the record…') : `Recording your ${label}…`}
        </div>
        {s.step === 'locating' && pin && <div className="caption">Allow location access if your browser asks.</div>}
      </>
    );
  } else if (s.step === 'guest-form') {
    const g = s.guest;
    const opts = c.guestOptions;
    body = (
      <div className="col gap-12" style={{ width: '100%', textAlign: 'left' }}>
        <div className="caption">No TaskNet account needed. Enter your details to time in. After the activity, scan again with the same email to evaluate it: that is your Time Out.</div>
        <Field label="Full name" required><TextInput autoComplete="name" value={g.name} onChange={(e) => c.setGuest({ name: e.target.value })} /></Field>
        <Field label="I am a…" required>
          <Select value={g.role} onChange={(e) => c.setGuest({ role: e.target.value })}>
            {(opts?.role ?? ['student', 'parent', 'external stakeholder', 'visitor']).map((r) => <option key={r} value={r}>{Format.titleCase(r)}</option>)}
          </Select>
        </Field>
        <Field label="Email" required help="One Time In and one evaluation (Time Out) per email for each session.">
          <TextInput type="email" autoComplete="email" value={g.email} onChange={(e) => c.setGuest({ email: e.target.value })} />
        </Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Sex" required>
            <Select value={g.sex} onChange={(e) => c.setGuest({ sex: e.target.value })}>
              <option value="">Select</option>{(opts?.sex ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Age group" required>
            <Select value={g.age_group} onChange={(e) => c.setGuest({ age_group: e.target.value })}>
              <option value="">Select</option>{(opts?.age_group ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="School / office / organization (optional)">
          <TextInput autoComplete="organization" value={g.affiliation ?? ''} onChange={(e) => c.setGuest({ affiliation: e.target.value })} />
        </Field>
        <label className="row-top gap-8" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={s.consent} onChange={(e) => c.setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I agree that TaskNet records my name, email and location for this event&apos;s attendance and evaluation.
            <span className="caption" style={{ display: 'block' }}>In line with the Data Privacy Act of 2012 (RA 10173). Used only for this event&apos;s records.</span></span>
        </label>
        {s.formError && <div style={{ color: 'var(--red)', fontSize: 13 }}>{s.formError}</div>}
        <Button block variant="success" onClick={() => void c.submitGuest(locate).then(after)}>Continue</Button>
        <div className="caption" style={{ textAlign: 'center' }}>
          Have a TaskNet account? <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>Log in instead</Link>
        </div>
      </div>
    );
  } else if (s.step === 'outside') {
    body = (
      <>
        <div className="col gap-4" style={{ width: '100%', textAlign: 'left', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 12 }}>
          <div className="row gap-8" style={{ fontWeight: 700, color: '#c2410c' }}><AlertTriangle size={18} />You are outside the event perimeter</div>
          <div style={{ fontSize: 13.5 }}>
            You are about <b>{c.distance != null ? formatDistance(c.distance) : '—'}</b> from {info?.venue || 'the venue'}. {label} is accepted only within {pin?.radius_m} m. Go to the venue, then tap Try again.
          </div>
          {s.fix?.accuracy != null && s.fix.accuracy > 50 && (
            <div className="caption">Your phone&apos;s location is only accurate to about {formatDistance(s.fix.accuracy)}. Turning on precise location or moving near a window can help.</div>
          )}
        </div>
        {map}
        {retry}
      </>
    );
  } else if (s.step === 'no-location') {
    const help = LOCATION_HELP[s.problem ?? 'unavailable'];
    body = (
      <>
        <MapPinOff size={52} color="var(--red)" />
        <div style={{ fontSize: 17, fontWeight: 700 }}>Location needed for {label}</div>
        <div className="caption">This event only accepts attendance at {info?.venue || 'the venue'} (within {pin?.radius_m} m), so TaskNet needs your location to confirm you are there.</div>
        <div style={{ width: '100%', textAlign: 'left', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{help.title}</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{help.steps.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        {retry}
        <div className="caption">Still stuck? Open the QR link on a phone with GPS turned on (laptops often can&apos;t find their location).</div>
      </>
    );
  } else {
    const ok = s.step === 'done';
    body = (
      <>
        {ok ? <CheckCircle2 size={56} color="var(--green)" /> : <AlertCircle size={56} color="var(--red)" />}
        <div style={{ fontSize: 17, fontWeight: 700 }}>{label} {ok ? 'recorded' : 'not recorded'}</div>
        <div className="caption">{s.message}</div>
        {pin && s.fix && map}
        {ok && <div className="caption mt-4">After the activity ends, scan this same QR again and answer the evaluation: it records your Time Out (until midnight).{guest && ' Your details are remembered on this phone.'}</div>}
        {ok ? (!guest && <Button variant="ghost" className="mt-12" onClick={() => navigate('/dashboard')}>Go to dashboard</Button>) : retry}
        {!ok && guest && <Button variant="ghost" onClick={() => c.editGuest()}>Edit my details</Button>}
      </>
    );
  }

  const tone = c.isTimeIn ? 'var(--green)' : 'var(--accent)';
  return (
    <Page>
      <span className="chip" style={{ background: `color-mix(in srgb, ${tone} 12%, white)`, color: tone, fontWeight: 700 }}>Attendance · {label}{guest ? ' · Guest' : ''}</span>
      {info && (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 14 }}>{info.activity.event?.trim() || `Activity ${info.activity_index + 1}`}</div>
          <div className="caption">{info.event_title}</div>
          <div className="caption mt-4">{[info.activity.time, info.venue].filter(Boolean).join('  ·  ')}</div>
          {c.window && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Time In: {c.window}</div>}
          {c.evaluationWindow && <div style={{ fontSize: 12, fontWeight: 600 }}>Time Out (evaluation): {c.evaluationWindow}</div>}
          {pin && <div className="caption" style={{ color: '#1d4ed8', marginTop: 2 }}>Must be within {pin.radius_m} m of the venue</div>}
        </>
      )}
      <div className="col" style={{ alignItems: 'center', gap: 8, marginTop: 22 }}>{body}</div>
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}
