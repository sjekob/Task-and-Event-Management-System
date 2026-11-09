import { CalendarClock, FileText, MapPin, Send, Users } from 'lucide-react';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { richToPlain } from '@shared/utils/richText';
import { useFeedback } from '../../ui/feedback';
import { Button, Modal } from '../../ui/kit';
import { SpecialTasksTable } from './SpecialTasksDialog';
import { VenueMapPicker } from './VenueMap';

/**
 * Submit the uploaded proposal file as is, without reviewing every step. The
 * approver reads the original file; TaskNet still needs what a file can't give
 * it: when the event runs (date and hours, for attendance), where (the venue
 * pinned, for the attendance perimeter) and which committee members get an
 * automated special task.
 */
export function SubmitAsFileDialog({ c, onClose, onSubmitted }: { c: ProposalFormController; onClose: () => void; onSubmitted: (message: string) => void }) {
  const fb = useFeedback();
  const s = c.state;
  const d = s.d;
  const today = new Date().toISOString().slice(0, 10);
  const issues = c.asFileIssues;
  const timesBad = !!(d.startTime && d.endTime && d.endTime <= d.startTime);
  const hasCommittee = d.twg.some((g) => g.members.some((m) => m.name.trim()));

  const submit = async () => {
    const r = await c.submitAsFile();
    if (r.ok) onSubmitted(r.message); else fb.toast(r.message, 'error');
  };

  return (
    <Modal title="Submit your proposal file as is" icon={<FileText size={20} />} size="xwide" onClose={onClose}
      subtitle={<>The approver will read <b>{c.sourceFileName}</b> exactly as you wrote it. TaskNet still needs three things the file can't give it.</>}
      footer={<>
        <span className="caption grow">{issues.length ? `Still needed: ${issues.join(', ')}.` : 'Ready to submit.'}</span>
        <Button variant="outline-muted" onClick={onClose}>Back</Button>
        <Button icon={<Send size={16} />} loading={s.submitting} disabled={issues.length > 0} onClick={() => void submit()}>Submit proposal</Button>
      </>}>
      <div className="col" style={{ gap: 22 }}>
        <section className="sf-sec">
          <div className="sf-head"><span className="sf-num">1</span><CalendarClock size={16} /><b>When</b>
            <span className="caption">Time In is open for the first 2 hours; Time Out (the evaluation) from 2 hours before the end until midnight.</span></div>
          <div className="row wrap gap-12" style={{ alignItems: 'flex-end' }}>
            <label className="sf-field">
              <span className="field-help">Date{richToPlain(d.title) ? ` of "${richToPlain(d.title)}"` : ''}</span>
              <input className="pf-in" type="date" min={today} value={c.targetDateIso} onChange={(e) => c.setTargetDate(e.target.value)} />
            </label>
            <label className="sf-field">
              <span className="field-help">Starts at</span>
              <input className="pf-in" type="time" value={d.startTime} onChange={(e) => c.set('startTime', e.target.value)} />
            </label>
            <label className="sf-field">
              <span className="field-help">Ends at</span>
              <input className="pf-in" type="time" value={d.endTime} onChange={(e) => c.set('endTime', e.target.value)} />
            </label>
          </div>
          {s.dateIssue && <div className="field-error mt-4">{s.dateIssue}</div>}
          {timesBad && <div className="field-error mt-4">The end time must be after the start time.</div>}
        </section>

        <section className="sf-sec">
          <div className="sf-head"><span className="sf-num">2</span><MapPin size={16} /><b>Where</b>
            <span className="caption">Pin the venue: attendance is accepted only inside this perimeter.</span></div>
          <VenueMapPicker venue={richToPlain(d.venue)} pin={d.venuePin} radius={d.venueRadius} onPin={(p) => c.setVenuePin(p)} onRadius={(r) => c.setVenueRadius(r)} />
          {!d.venuePin && <div className="field-help mt-4">Required: search for the venue or click the map to pin it.</div>}
        </section>

        <section className="sf-sec">
          <div className="sf-head"><span className="sf-num">3</span><Users size={16} /><b>Committee special tasks</b>
            <span className="caption">Tick who gets a special task when the event is approved; the others are credited the top score.</span></div>
          {hasCommittee ? <SpecialTasksTable c={c} />
            : <div className="caption">No working committee was found in the file, so no special tasks will be created.</div>}
        </section>
      </div>
    </Modal>
  );
}
