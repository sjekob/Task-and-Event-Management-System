import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, CircleX, PenLine, Plus, Trash2, FileText, Undo2 } from 'lucide-react';
import { EventsController, SendBack } from '@shared/controllers/EventControllers';
import { EventItem } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useIsMobile, useLiveRefresh, useScreenController } from '../../app/hooks';
import { printProposal } from '../../app/printProposal';
import { useFeedback } from '../../ui/feedback';
import { Bone, Button, IconButton } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';
import './events.css';
import { EventDetailView } from './EventDetailView';
import { SendBackDialog } from './EventReview';
import { EventCard, Section, SideCalendar } from './EventListParts';

export default function EventsView() {
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const [c, s] = useScreenController(() => new EventsController(services, user), [user?.id]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const handledOpen = useRef<string | null>(null);
  const [review, setReview] = useState<{ e: EventItem; decision: SendBack } | null>(null);
  useEffect(() => { void c.load(); }, [c]);
  // The lists and calendars stay current (approvals, new proposals) while open.
  useLiveRefresh(() => void c.load());

  const openId = Number(params.get('open')) || null;

  // /events?open=12 (from the dashboard): highlight the card and open its details.
  useEffect(() => {
    const key = params.get('open');
    if (!key || s.loading || handledOpen.current === key) return;
    handledOpen.current = key;
    if (!c.find(Number(key))) {
      fb.toast('That event is no longer available.');
      setParams({}, { replace: true });
      return;
    }
    setHighlight(Number(key));
    setTimeout(() => setHighlight(null), 4000);
  }, [params, s.loading, c, fb, setParams]);

  const print = async (e: EventItem) => {
    if (await printProposal(e.raw)) fb.toast('Print preview opened in a new tab — use Print or Download there.');
    else fb.toast('Allow pop-ups for this site to print the proposal.', 'error');
  };
  const run = async (fn: () => Promise<void>, done: string) => { try { await fn(); fb.toast(done); } catch (e) { fb.error(e); } };
  const approve = async (e: EventItem) => { try { fb.toast(await c.approve(e)); } catch (err) { fb.error(err); } };
  const confirmDisable = async (e: EventItem) => {
    if (await fb.confirm({ title: 'Confirm Disable', message: `Disable "${e.title}"?`, confirmLabel: 'Disable', danger: true })) await run(() => c.disable(e), 'Event disabled');
  };
  const confirmDelete = async (e: EventItem) => {
    const t = e.title.trim() || 'Untitled Draft';
    if (await fb.confirm({ title: 'Delete Draft', message: `Delete "${t}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) await run(() => c.deleteDraft(e), 'Draft deleted');
  };
  const open = (e: EventItem) => setParams({ open: String(e.id) });
  // A returned proposal is fetched afresh so the approver's comment (its review history) shows.
  const edit = (e: EventItem) => navigate(`/events/${e.id}/edit`, { state: e.isReturned ? undefined : { event: e.raw } });

  if (openId && !s.loading && c.find(openId)) {
    return <EventDetailView key={openId} id={openId} initial={c.find(openId)} onBack={() => setParams({})} onPrint={(e) => void print(e)} onChanged={() => void c.load()} />;
  }

  const calendar = <SideCalendar c={c} />;
  const card = (e: EventItem, children: ReactNode) => (
    <div key={e.id} className={`ev-track ${highlight === e.id ? 'on' : ''}`}>{children}</div>
  );

  return (
    <div className="col gap-16" style={{ position: 'relative', paddingBottom: 64 }}>
      <div className="ev-banner">
        <h1>Event Calendar</h1>
        <div>Great things are on the horizon — stay active, stay organized!</div>
      </div>
      <div className="ev-layout">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap gap-8 mb-16">
            <button className={`ev-tab ${s.tab === 0 ? 'on' : ''}`} onClick={() => c.setTab(0)}>All Events</button>
            {!c.isPrincipal && <button className={`ev-tab ${s.tab === 1 ? 'on' : ''}`} onClick={() => c.setTab(1)}>My Events</button>}
            <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
          </div>
          {s.loading ? <div className="col gap-8">{[0, 1, 2].map((i) => <Bone key={i} h={74} r={12} />)}</div> : (
            <>
              {!s.events.length && <div className="card center-fill body-md">No events yet.</div>}
              {c.approved.length > 0 && <Section label="Upcoming / Approved Events">{c.approved.map((e) => card(e,
                <EventCard e={e} onTap={() => open(e)} onPrint={() => void print(e)} />))}</Section>}
              {c.completed.length > 0 && <Section label="Completed Events">{c.completed.map((e) => card(e,
                <EventCard e={e} onTap={() => open(e)} onPrint={() => void print(e)} />))}</Section>}
              {c.pending.length > 0 && <Section label="Pending Approval">{c.pending.map((e) => card(e,
                <EventCard e={e} onTap={() => open(e)} onPrint={() => void print(e)} menu={
                  c.isPrincipal && c.canApprove ? [
                    { label: 'Approve', icon: <CheckCircle2 size={15} color="#48bb78" />, onClick: () => void approve(e) },
                    { label: 'Request revisions', icon: <Undo2 size={15} color="#c2410c" />, onClick: () => setReview({ e, decision: 'revisions_requested' }) },
                    { label: 'Reject', icon: <CircleX size={15} />, onClick: () => setReview({ e, decision: 'rejected' }), danger: true },
                    { label: 'Disable', icon: <Ban size={15} />, onClick: () => void confirmDisable(e) },
                  ] : c.canManage ? [{ label: 'Edit', icon: <PenLine size={15} />, onClick: () => edit(e) }] : undefined
                } />))}</Section>}
              {c.returned.length > 0 && <Section label={c.isPrincipal ? 'Returned to Proponents' : 'Returned for Revision'}>{c.returned.map((e) => card(e,
                <EventCard e={e} onTap={() => open(e)} onPrint={() => void print(e)} menu={
                  !c.isPrincipal && c.canManage && e.createdBy === user?.id ? [{ label: 'Revise & resubmit', icon: <PenLine size={15} />, onClick: () => edit(e) }] : undefined
                } />))}</Section>}
              {c.disabled.length > 0 && s.tab === 0 && <Section label="Disabled Events">{c.disabled.map((e) => card(e,
                <div className="ev-card off" onClick={() => open(e)}>
                  <div className="grow">
                    <div className="row gap-8"><span className="ev-title" style={{ color: 'var(--light)', textDecoration: 'line-through' }}>{e.title}</span><span className="ev-pill red">Disabled</span></div>
                    <div className="ev-desc" style={{ color: '#b0b7c3' }}>{EventsController.description(e)}</div>
                  </div>
                  <IconButton small title="Print / Save as PDF" onClick={(ev) => { ev.stopPropagation(); void print(e); }}><FileText size={18} /></IconButton>
                  {c.canManage && <Button variant="ghost" size="sm" style={{ color: '#48bb78' }} onClick={(ev) => { ev.stopPropagation(); void run(() => c.enable(e), 'Event enabled'); }}>Enable</Button>}
                </div>))}</Section>}
              {c.drafts.length > 0 && <Section label="Drafts">{c.drafts.map((e) => (
                <div key={e.id} className="ev-card" style={{ border: '1px solid #dde3ed', cursor: 'default' }}>
                  <div className="grow">
                    <div className="row gap-8"><span className="ev-title">{e.title.trim() || 'Untitled Draft'}</span><span className="ev-pill gray">Draft</span></div>
                    <div className="ev-desc">Continue where you left off.</div>
                  </div>
                  <Button variant="ghost" size="sm" style={{ color: '#1e2126' }} onClick={() => edit(e)}>Continue Editing</Button>
                  <IconButton small title="Delete draft" onClick={() => void confirmDelete(e)}><Trash2 size={18} color="#e53e3e" /></IconButton>
                </div>
              ))}</Section>}
            </>
          )}
          {isMobile && <><div className="ev-label mt-16">Calendar</div>{calendar}</>}
        </div>
        {!isMobile && <div style={{ width: 290, flexShrink: 0 }}>{calendar}</div>}
      </div>
      {review && (
        <SendBackDialog event={review.e} decision={review.decision} onClose={() => setReview(null)}
          send={async (comment) => {
            try { fb.toast(await c.sendBack(review.e, review.decision, comment)); setReview(null); return true; } catch (err) { fb.error(err); return false; }
          }} />
      )}
      {c.canManage && (
        <button className="ev-fab" onClick={() => navigate('/events/new')}><Plus size={20} />Add Event</button>
      )}
    </div>
  );
}
