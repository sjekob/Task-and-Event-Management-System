import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CheckCircle2, CircleX, Eye, FileText, History, MapPin, PenLine, Undo2, UserCheck } from 'lucide-react';
import { EventDetailController, SendBack } from '@shared/controllers/EventControllers';
import { EventItem } from '@shared/models';
import { useMediaUrl, useServices, useSession } from '../../app/AppContext';
import { useLiveRefresh, useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button } from '../../ui/kit';
import { FileViewerDialog } from '../../ui/FileViewerDialog';
import { EventDetail } from './EventDetail';
import { Card } from './EventDetailParts';
import { AttendanceTable, ReturnedBanner, ReviewHistory, SendBackDialog } from './EventReview';
import { VenueMap } from './VenueMap';

/**
 * One event's page: the proposal with what the signed-in person may do
 * (approve, request revisions, reject, disable, revise), its venue map,
 * attendance list and review history. Kept current every 30 seconds.
 */
export function EventDetailView({ id, initial, onBack, onPrint, onChanged }: {
  id: number; initial: EventItem | null; onBack: () => void; onPrint: (e: EventItem) => void; onChanged: () => void;
}) {
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EventDetailController(services, user, id, initial), [id, user?.id]);
  const [review, setReview] = useState<SendBack | null>(null);
  const [viewing, setViewing] = useState(false);
  const media = useMediaUrl();
  useEffect(() => { void c.load(); }, [c]);
  useLiveRefresh(() => void c.load());

  const e = s.event;
  if (!e) return <div className="card center-fill body-md">{s.error ?? 'Loading…'}</div>;
  const a = c.actions;
  const edit = () => navigate(`/events/${e.id}/edit`, { state: { event: e.raw } });
  const run = async (fn: () => Promise<string | void>, done?: string) => {
    try { const msg = await fn(); fb.toast(msg || done || 'Done'); onChanged(); } catch (err) { fb.error(err); }
  };
  const disable = async () => {
    if (await fb.confirm({ title: 'Confirm Disable', message: `Disable "${e.title}"?`, confirmLabel: 'Disable', danger: true })) await run(() => c.disable(), 'Event disabled');
  };
  const pin = e.venuePin;

  return (
    <>
      <EventDetail event={e} onBack={onBack} onPrint={() => onPrint(e)} attendance={a.qr}
        top={(e.isReturned || e.proposalFile) ? (
          <div className="col gap-12">
            {e.isReturned && (
              <ReturnedBanner event={e} action={a.edit && (
                <Button variant={e.status === 'rejected' ? 'danger' : undefined} icon={<PenLine size={16} />} onClick={edit}>Revise &amp; resubmit</Button>
              )} />
            )}
            {e.proposalFile && (
              <div className={`ev-file ${e.submittedAsFile ? 'main' : ''}`}>
                <FileText size={22} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 700 }}>{e.proposalFile.name}</div>
                  <div className="caption">{e.submittedAsFile
                    ? 'Submitted as the original file: read it for the full proposal. The details below were read from it automatically; the time, venue pin and special tasks were set by the proponent.'
                    : 'The proposal file this event was filled in from.'}</div>
                </div>
                <Button size="sm" icon={<Eye size={15} />} onClick={() => setViewing(true)}>View file</Button>
              </div>
            )}
          </div>
        ) : undefined}
        actions={<>
          {a.approve && <Button variant="success" size="lg" icon={<CheckCircle2 size={18} />} onClick={() => void run(() => c.approve())}>Approve event</Button>}
          {a.sendBack && <Button variant="outline-muted" size="lg" icon={<Undo2 size={18} />} style={{ color: '#c2410c', borderColor: '#fdba74' }} onClick={() => setReview('revisions_requested')}>Request revisions</Button>}
          {a.sendBack && <Button variant="outline-muted" size="lg" icon={<CircleX size={18} />} style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => setReview('rejected')}>Reject</Button>}
          {a.disable && <Button variant="outline-muted" size="lg" icon={<Ban size={18} />} style={{ color: 'var(--muted)' }} onClick={() => void disable()}>Disable event</Button>}
          {a.edit && <Button variant="outline-muted" size="lg" icon={<PenLine size={18} />} onClick={edit}>{e.isReturned ? 'Revise proposal' : 'Edit proposal'}</Button>}
        </>}
        bottom={<>
          {pin && (
            <Card icon={<MapPin size={18} />} title="Venue & attendance perimeter">
              <div className="row wrap gap-8 mb-12">
                <span className="caption grow">Time In / Time Out scans are accepted within {pin.radius} m of the pin{e.venue ? ` (${e.venue})` : ''}.</span>
                <a className="caption" href={EventDetailController.mapLink(pin.lat, pin.lng)} target="_blank" rel="noreferrer">Open in OpenStreetMap</a>
              </div>
              <VenueMap pin={pin} radius={pin.radius} label={e.venue ?? undefined} height={300} />
            </Card>
          )}
          {a.attendanceList && (
            <Card icon={<UserCheck size={18} />} title="Attendance">
              <AttendanceTable list={s.attendance} error={s.attendanceError} {...c.attendanceSummary} />
            </Card>
          )}
          {e.reviews.length > 0 && <Card icon={<History size={18} />} title="Review history"><ReviewHistory reviews={e.reviews} /></Card>}
        </>} />
      {viewing && e.proposalFile && (
        <FileViewerDialog filename={e.proposalFile.name} url={media(e.proposalFile.url) ?? e.proposalFile.url} onClose={() => setViewing(false)} />
      )}
      {review && (
        <SendBackDialog event={e} decision={review} onClose={() => setReview(null)}
          send={async (comment) => {
            try { fb.toast(await c.sendBack(review, comment)); setReview(null); onChanged(); return true; } catch (err) { fb.error(err); return false; }
          }} />
      )}
    </>
  );
}
