import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, FileUp, Send } from 'lucide-react';
import { ProposalFormController, STEP_TITLES } from '@shared/controllers/EventControllers';
import { EventItem, Json } from '@shared/models';
import { useApp } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useDirty, useUnsavedGuard } from '../../app/unsaved';
import { useFeedback } from '../../ui/feedback';
import { Button, ErrorBox, IconButton, Loading } from '../../ui/kit';
import './events.css';
import { BriefStep } from './EventFormBrief';
import { ReturnedBanner } from './EventReview';
import { ProposalDropArea, ReadingPanel } from './ProposalUpload';
import { BudgetStep, MatrixStep, MethodologyStep, MonitoringStep, RationaleStep } from './EventFormSteps';
import { SpecialTasksDialog } from './SpecialTasksDialog';
import { SubmitAsFileDialog } from './SubmitAsFileDialog';

/** /events/new and /events/:id/edit (the event comes via navigation state, else it is fetched). */
export default function EventFormView() {
  const app = useApp();
  const { id } = useParams();
  const loc = useLocation();
  const passed = (loc.state as { event?: Json } | null)?.event ?? null;
  const [existing, setExisting] = useState<Json | null | undefined>(id ? passed ?? undefined : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id || existing !== undefined) return;
    app.services.events.get(Number(id)).then((e) => (e ? setExisting(e.raw) : setError('Event not found.'))).catch(() => setError('Event not found.'));
  }, [id, existing, app]);
  if (error) return <ErrorBox message={error} />;
  if (existing === undefined) return <Loading />;
  return <ProposalForm existing={existing} />;
}

function ProposalForm({ existing }: { existing: Json | null }) {
  const app = useApp();
  const navigate = useNavigate();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ProposalFormController(app.services, app.session, existing), []);

  // Leaving with unsaved changes asks first (sidebar, links, Back, closing the tab).
  const dirty = useDirty(s.d);
  const guard = useUnsavedGuard(dirty, {
    what: 'event proposal',
    onDiscard: () => c.discard(),
    saveLabel: c.isReturned ? 'Save changes and leave' : 'Save draft and leave',
    saveDraft: c.canSaveAsDraft ? async () => {
      const r = await c.submit(true);
      fb.toast(r.message, r.ok ? 'success' : 'error');
      return r.ok;
    } : undefined,
  });

  const send = async (asDraft = false) => {
    const r = await c.submit(asDraft);
    if (r.ok) { setReview(false); fb.toast(r.message, 'success'); guard.release(); navigate('/events'); } else fb.toast(r.message, 'error');
  };
  // Submitting (not saving a draft) first shows the committee's special tasks to confirm.
  const [review, setReview] = useState(false);
  const [asFile, setAsFile] = useState(false);
  const hasCommittee = s.d.twg.some((g) => g.members.some((m) => m.name.trim()));
  const submit = async (asDraft = false) => {
    if (!asDraft && hasCommittee && !review) { setReview(true); return; }
    await send(asDraft);
  };

  const steps = [BriefStep, RationaleStep, MethodologyStep, MatrixStep, BudgetStep, MonitoringStep];
  const Step = steps[s.step];
  const title = (
    <div className="row gap-8">
      <IconButton title="Back" onClick={() => navigate('/events')}><ArrowLeft size={20} /></IconButton>
      <span className="grow" style={{ fontSize: 22, fontWeight: 700 }}>{c.isEditing ? 'Edit Event' : 'Add New Event'}</span>
      {!s.uploading && c.canSaveAsDraft && !s.d.reading && (
        <Button variant="outline-muted" size="sm" icon={<FileUp size={16} />} onClick={() => c.showUpload(true)}>Fill from proposal file</Button>
      )}
    </div>
  );
  if (s.uploading) return <div className="col gap-16">{title}<ProposalDropArea c={c} />{guard.dialog}</div>;

  return (
    <div>
      {guard.dialog}
      {review && <SpecialTasksDialog c={c} submitting={s.submitting} onClose={() => setReview(false)} onSubmit={() => void send()} />}
      {c.isReturned && existing && (
        <div className="mb-16"><ReturnedBanner event={new EventItem(existing)} action={
          <Button icon={<Send size={16} />} loading={s.submitting} onClick={() => void submit()}>Resubmit for approval</Button>
        } /></div>
      )}
      {asFile && <SubmitAsFileDialog c={c} onClose={() => setAsFile(false)}
        onSubmitted={(message) => { setAsFile(false); fb.toast(message, 'success'); guard.release(); navigate('/events'); }} />}
      <ReadingPanel c={c} onSubmitAsFile={c.isReturned ? undefined : () => setAsFile(true)} />
      <div className="pf-head">
        {title}
        <div className="pf-steps">
          {STEP_TITLES.map((t, i) => (
            <button key={t} className="pf-step" onClick={() => c.goTo(i)}>
              <div className="row gap-8">
                <span className="pf-step-num" style={{ background: i < s.step ? '#48bb78' : i === s.step ? '#1e2126' : 'var(--border-strong)' }}>{i < s.step ? <Check size={14} /> : i + 1}</span>
                <span className="ellipsis" style={{ fontSize: 12, fontWeight: i === s.step ? 700 : 400, color: i === s.step ? 'var(--text)' : 'var(--muted)' }}>{t}</span>
              </div>
              <div className="pf-step-bar" style={{ background: i <= s.step ? '#1e2126' : 'var(--border)' }} />
            </button>
          ))}
        </div>
      </div>
      <div className="pf-body col gap-16"><Step c={c} /></div>
      <div className="pf-foot">
        {s.step > 0 ? <Button variant="outline-muted" style={{ width: 120 }} onClick={() => c.goTo(s.step - 1)}>Back</Button> : <span />}
        <div className="row gap-12">
          {c.canSaveAsDraft && <Button variant="outline-muted" disabled={s.submitting} onClick={() => void submit(true)} style={{ borderColor: 'var(--border-strong)' }}>{c.isReturned ? 'Save changes' : 'Save as Draft'}</Button>}
          <Button style={{ minWidth: 160, background: '#1e2126' }} loading={s.submitting}
            onClick={() => (c.isLastStep ? void submit() : c.goTo(s.step + 1))}>
            {s.submitting ? '' : !c.isLastStep ? 'Next →' : c.isReturned ? 'Resubmit for approval' : c.isEditing ? 'Save Changes' : 'Submit Proposal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
