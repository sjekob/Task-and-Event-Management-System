import { NATURES, ProposalFormController } from '@shared/controllers/EventControllers';
import { Format } from '@shared/utils/format';
import { richToPlain } from '@shared/utils/richText';
import { useFeedback } from '../../ui/feedback';
import { RichText } from '../../ui/RichText';
import { AddBtn, L } from './EventFormFields';
import { VenueMapPicker } from './VenueMap';

// Step 1 of the proposal form.
/** Proposal brief. */
export function BriefStep({ c }: { c: ProposalFormController }) {
  const fb = useFeedback();
  const s = c.state;
  const d = s.d;
  const today = Format.isoDate(new Date());
  const dateOk = !s.dateIssue && !!d.targetDate.trim() && !s.checkingDate;
  return (
  <>
    <div className="pf-sec">I. PROPOSAL BRIEF</div>
    <L t="a. Title"><RichText placeholder="Enter project title" value={d.title} onChange={(v) => c.set('title', v)} /></L>
    <L t="b. Nature of Activity">
      <div className="row wrap gap-16">
        {NATURES.map((n) => (
          <label key={n} className="check"><input type="radio" name="nature" checked={d.nature === n} onChange={() => c.set('nature', n)} style={{ accentColor: '#1e2126' }} />{n}</label>
        ))}
      </div>
    </L>
    <div className="grid-2">
      <L t="c. Target Date">
        <input className="pf-in" type="date" min={today} value={c.targetDateIso}
          onChange={(e) => {
            if (e.target.value && c.isDayTaken(e.target.value)) fb.toast('Another event is already scheduled on that day.', 'error');
            c.setTargetDate(e.target.value);
          }} />
        {d.targetDate && <div className="caption mt-4">{d.targetDate}</div>}
        {s.dateIssue ? <div className="field-error mt-4">{s.dateIssue}</div>
          : s.checkingDate ? <div className="field-help mt-4">Checking the calendar...</div>
          : dateOk ? <div className="mt-4" style={{ fontSize: 11.5, color: '#16a34a' }}>No other event is scheduled on this date.</div> : null}
        {s.dateWarning && !s.dateIssue && <div className="mt-4" style={{ fontSize: 11.5, color: '#b45309' }}>{s.dateWarning}</div>}
        <div className="row gap-8 mt-8" style={{ alignItems: 'flex-end' }}>
          <label className="grow">
            <span className="field-help" style={{ display: 'block', marginBottom: 4 }}>Starts at</span>
            <input className="pf-in" type="time" aria-label="Event start time" value={d.startTime} onChange={(e) => c.set('startTime', e.target.value)} />
          </label>
          <span className="muted" style={{ paddingBottom: 10 }}>to</span>
          <label className="grow">
            <span className="field-help" style={{ display: 'block', marginBottom: 4 }}>Ends at</span>
            <input className="pf-in" type="time" aria-label="Event end time" value={d.endTime} onChange={(e) => c.set('endTime', e.target.value)} />
          </label>
        </div>
        {d.startTime && d.endTime && d.endTime <= d.startTime
          ? <div className="field-error mt-4">The end time must be after the start time.</div>
          : <div className="field-help mt-4">Attendance opens from these hours: Time In for the first 2 hours, Time Out (the evaluation) from 2 hours before the end until midnight.</div>}
      </L>
      <L t="d. Proposed Venue"><RichText placeholder="e.g. NCS II Pavilion" value={d.venue} onChange={(v) => c.set('venue', v)} /></L>
    </div>
    <VenueMapPicker venue={richToPlain(d.venue)} pin={d.venuePin} radius={d.venueRadius} onPin={(p) => c.setVenuePin(p)} onRadius={(r) => c.setVenueRadius(r)} />
    <L t="e. Target Participants">
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
        <table className="pf-pax">
          <thead><tr><th style={{ width: '45%' }} /><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead>
          <tbody>
            {([['pCat1', 'tMale', 'tFemale', c.totals.t], ['pCat2', 'jMale', 'jFemale', c.totals.j]] as const).map(([cat, m, f, t]) => (
              <tr key={cat}>
                <td><input className="pf-in" style={{ background: 'transparent', border: 0 }} placeholder="Category" value={d[cat]} onChange={(e) => c.set(cat, e.target.value)} /></td>
                <td><input className="pf-in" inputMode="numeric" style={{ textAlign: 'center' }} placeholder={String(d[m])} value={d[m] || ''} onChange={(e) => c.setCount(m, e.target.value)} /></td>
                <td><input className="pf-in" inputMode="numeric" style={{ textAlign: 'center' }} placeholder={String(d[f])} value={d[f] || ''} onChange={(e) => c.setCount(f, e.target.value)} /></td>
                <td style={{ fontWeight: 600 }}>{t}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td style={{ textAlign: 'left', padding: 10 }}>TOTAL</td><td>{c.totals.male}</td><td>{c.totals.female}</td><td>{c.totals.all}</td></tr>
          </tbody>
        </table>
      </div>
    </L>
    <L t="f. Expected Outputs">
      {d.outputs.map((o, i) => (
        <div key={i} className="row gap-8 mb-8"><span className="caption">{i + 1}.</span><div className="grow" style={{ minWidth: 0 }}><RichText placeholder="Expected output..." value={o} onChange={(v) => c.setOutput(i, v)} /></div></div>
      ))}
      <AddBtn label="Add output" onClick={() => c.addOutput()} />
    </L>
    <div className="grid-2">
      <L t="g. Proposed Budget (₱)"><input className="pf-in" placeholder="e.g. 3,120.00" value={d.budget} onChange={(e) => c.set('budget', e.target.value)} /></L>
      <L t="h. Source of Fund"><input className="pf-in" placeholder="e.g. School Paper Fund/SPTA Fund" value={d.fund} onChange={(e) => c.set('fund', e.target.value)} /></L>
    </div>
    <L t="h. Focal Person">
      <div className="grid-3" style={{ gap: 12 }}>
        <input className="pf-in" placeholder="Full name" value={d.focalName} onChange={(e) => c.set('focalName', e.target.value)} />
        <RichText placeholder="Designation" value={d.focalRole} onChange={(v) => c.set('focalRole', v)} />
        <input className="pf-in" placeholder="CP # / Contact" value={d.focalCp} onChange={(e) => c.set('focalCp', e.target.value)} />
      </div>
    </L>
  </>
  );
}
