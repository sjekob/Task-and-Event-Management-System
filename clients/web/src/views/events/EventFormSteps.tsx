import { useState } from 'react';
import { ClipboardCheck, Users } from 'lucide-react';
import { MemberRow, MemberText, ProposalFormController } from '@shared/controllers/EventControllers';
import { memberResult } from '@shared/controllers/proposalReading';
import { CommitteeSuggest } from './CommitteeSuggest';
import { RichText } from '../../ui/RichText';
import { Button } from '../../ui/kit';
import { AddBtn, Grid, L, Rm, RowGrid } from './EventFormFields';
import { SpecialTasksDialog } from './SpecialTasksDialog';

// Steps 2-6 of the proposal form.
/** Rationale & objectives. */
export function RationaleStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
  <>
    <div className="pf-sec">II. RATIONALE</div>
    <RichText multiline value={d.rationale} rows={8} placeholder="Provide the rationale for this activity..." onChange={(v) => c.set('rationale', v)} />
    <div className="pf-sec" style={{ marginTop: 28 }}>III. OBJECTIVES</div>
    <div className="body-md mb-12" style={{ color: 'var(--text-2)' }}>Enter each objective on a new line. They will be numbered automatically in the printed proposal.</div>
    <RichText multiline value={d.objectives} rows={8} onChange={(v) => c.set('objectives', v)}
      placeholder={'equip young journalists with the basics of writing...\nproduce various journalistic articles...\nchoose the campus journalists who will compete...'} />
  </>
  );
}

/** Methodology. */
export function MethodologyStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
  <>
    <div className="pf-sec">IV. METHODOLOGY</div>
    <label className="pf-label" htmlFor="pf-method-intro">Introduction <span className="caption">(how the activity will be carried out, before the phases)</span></label>
    <textarea id="pf-method-intro" className="pf-in pf-auto mb-16" rows={3} value={d.methodologyIntro}
      placeholder="e.g. The training shall be composed of lectures, video clip viewing, sharing and games. The schedule will be as follows:"
      onChange={(e) => c.set('methodologyIntro', e.target.value)} style={{ width: '100%' }} />
    <Grid head={[['Phase', 1], ['Stage', 2], ['Activities', 3]]}>
      {d.phases.map((r, i) => (
        <div key={i} className="pf-grid-row">
          <div style={{ flex: 1, fontWeight: 700, fontSize: 13, padding: '12px 4px' }}>Phase {i + 1}</div>
          <textarea className="pf-in" style={{ flex: 2 }} rows={2} value={r.stage} onChange={(e) => c.setRow('phases', i, 'stage', e.target.value)} />
          <textarea className="pf-in" style={{ flex: 3 }} rows={3} value={r.activities} onChange={(e) => c.setRow('phases', i, 'activities', e.target.value)} />
          <Rm onClick={() => c.removeRow('phases', i)} />
        </div>
      ))}
    </Grid>
    <AddBtn label="Add phase" onClick={() => c.addRow('phases')} />
  </>
  );
}

/** Activity matrix. */
export function MatrixStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
  <>
    <div className="pf-sec">V. ACTIVITY MATRIX</div>
    <RowGrid list="matrix" c={c} rows={d.matrix} cols={[['day', 'Day', 2, 'Oct. 23, 2024'], ['time', 'Time', 2, '4:00-5:00 PM'], ['event', 'Event', 3, 'e.g. News Writing'], ['speaker', 'Speaker', 3, 'Speaker name']]} />
    <div className="field-help mt-4">Attendance QR codes use each row's day and time. A special task, if named, is completed for every attendee who times out and evaluates the activity.</div>
    <AddBtn label="Add row" onClick={() => c.addRow('matrix')} />
  </>
  );
}

/** Budget + committees. */
export function BudgetStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  const [tasksOpen, setTasksOpen] = useState(false);
  const members = d.twg.flatMap((g) => g.members).filter((m) => m.name.trim());
  const automated = members.filter((m) => m.automate).length;
  return (
  <>
    <div className="pf-sec">VII. PROPOSED BUDGET</div>
    <div className="body-md mb-16" style={{ color: 'var(--text-2)' }}>Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.</div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>a. Training Materials</div>
    <RowGrid list="materials" c={c} rows={d.materials} cols={[['item', 'Particulars', 1, 'Bond paper...'], ['qty', 'Quantity', 1, '1 ream'], ['cost', 'Cost', 1, '270.00'], ['total', 'Total', 1, '270.00']]} />
    <AddBtn label="Add item" onClick={() => c.addRow('materials')} />
    <div style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>b. Snacks for Program Partners</div>
    <RowGrid list="snacks" c={c} rows={d.snacks} cols={[['item', 'Particulars', 1, 'Meals'], ['pax', 'No. of Participants', 1, '11 pax'], ['cost', 'Cost/pax', 1, '100.00'], ['total', 'Total', 1, '1100.00']]} />
    <AddBtn label="Add item" onClick={() => c.addRow('snacks')} />
    <div className="pf-sec" style={{ marginTop: 28 }}>VI. WORKING COMMITTEE</div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>a. Executive Committee</div>
    <RowGrid list="exec" c={c} rows={d.exec} cols={[['name', 'Name', 1, 'e.g. FREDERICK M. BALDOZA'], ['position', 'Position', 1, 'e.g. Principal']]} />
    <AddBtn label="Add member" onClick={() => c.addRow('exec')} />
    <div style={{ fontSize: 14, fontWeight: 600, margin: '24px 0 12px' }}>b. Technical Working Group</div>
    {d.twg.map((g, gi) => (
      <div key={gi} className="mb-16">
        <div className="row gap-8 mb-8">
          <div className="input-icon grow"><Users size={18} /><input className="pf-in" style={{ paddingLeft: 36, fontWeight: 600, background: 'var(--surface-2)' }} placeholder="e.g. Supervising Committee" value={g.title} onChange={(e) => c.setTwgTitle(gi, e.target.value)} /></div>
          {d.twg.length > 1 && <Rm onClick={() => c.removeTwgGroup(gi)} />}
        </div>
        <Grid head={[['Name', 1.1], ['Designation', 1], ['Terms of Reference', 1.5], ['Output', 1.3], ['TaskNet account', 1.1]]}>
          {g.members.map((m, mi) => (
            <div key={mi} className="pf-grid-row">
              {([['name', 'Full name', 1.1], ['designation', 'e.g. Chairperson', 1], ['tor', 'e.g. Leads the Committee', 1.5], ['output', 'e.g. Checked reports', 1.3]] as [MemberText, string, number][]).map(([k, hint, f]) => (
                <textarea key={k} className="pf-in pf-auto" rows={1} style={{ flex: f, fontSize: 12.5 }} placeholder={hint} value={m[k]}
                  onChange={(e) => c.setMember(gi, mi, k, e.target.value)} />
              ))}
              <MemberLink c={c} g={gi} i={mi} m={m} />
              <Rm onClick={() => c.removeMember(gi, mi)} />
            </div>
          ))}
        </Grid>
        <AddBtn label="Add member" onClick={() => c.addMember(gi)} />
      </div>
    ))}
    <AddBtn label="Add Committee Group" onClick={() => c.addTwgGroup()} />
    <div className="st-bar">
      <ClipboardCheck size={18} color="var(--accent)" />
      <div className="grow" style={{ minWidth: 220 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>Special tasks on approval</div>
        <div className="caption">
          {automated ? `${automated} of ${members.length} committee ${members.length === 1 ? 'member gets' : 'members get'} a special task.`
            : 'No special tasks chosen: linked members get the top score instead.'} Each task is titled by the Output, described by the Terms of Reference, and due 7 days after the event unless you change it.
        </div>
      </div>
      <Button onClick={() => setTasksOpen(true)} disabled={!members.length}>Choose special tasks</Button>
    </div>
    {tasksOpen && <SpecialTasksDialog c={c} onClose={() => setTasksOpen(false)} />}
  </>
  );
}

/**
 * Links a TWG member to an account. Special tasks are chosen in the "Choose
 * special tasks" table; the badge shows what this member gets on approval.
 */
function MemberLink({ c, g, i, m }: { c: ProposalFormController; g: number; i: number; m: MemberRow }) {
  const result = memberResult(m);
  return (
    <div className="pf-account" style={{ flex: 1.1 }}>
      <select className="pf-in" style={{ fontSize: 12.5, padding: '8px 8px' }} value={m.userId ?? ''} aria-label="TaskNet account"
        onChange={(e) => c.linkMember(g, i, e.target.value ? Number(e.target.value) : null)}>
        <option value="">Not linked</option>
        {c.state.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
        <span className={`badge ${result.tone}`}>{result.label}</span>
        <CommitteeSuggest c={c} g={g} i={i} m={m} />
      </div>
    </div>
  );
}

/** Monitoring & evaluation. */
export function MonitoringStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
  <>
    <div className="pf-sec">VIII. MONITORING AND EVALUATION</div>
    <L t="Monitoring Instructions / Evaluation Criteria"><RichText multiline value={d.monitoring} rows={6} placeholder="Add specific monitoring instructions or evaluation criteria..." onChange={(v) => c.set('monitoring', v)} /></L>
    <div className="pf-sec" style={{ marginTop: 28 }}>Observation Tool Indicators</div>
    <div className="body-md mb-16" style={{ color: 'var(--text-2)' }}>List the indicators to be observed. The Evident / Not Evident columns will be filled in on the printed evaluation form.</div>
    <div className="pf-grid">
      <div className="pf-grid-head" style={{ minWidth: 0 }}><span style={{ color: 'var(--muted)' }}>#</span><span style={{ marginLeft: 12 }}>Indicator Description</span></div>
      {d.indicators.map((x, i) => (
        <div key={i} className="pf-grid-row" style={{ minWidth: 0, alignItems: 'center' }}>
          <span className="caption" style={{ width: 24 }}>{i + 1}.</span>
          <input className="pf-in" style={{ background: 'transparent', border: 0 }} placeholder="Describe what will be observed..." value={x} onChange={(e) => c.setIndicator(i, e.target.value)} />
          {d.indicators.length > 1 && <Rm onClick={() => c.removeIndicator(i)} />}
        </div>
      ))}
    </div>
    <AddBtn label="Add indicator" onClick={() => c.addIndicator()} />
    <div className="pf-sec" style={{ marginTop: 32 }}>Signatories</div>
    <div className="body-md mb-16" style={{ color: 'var(--text-2)' }}>Enter the names and positions of the signatories. These will appear in the printed proposal.</div>
    {d.signatories.map((x, i) => (
      <div key={x.role} className="mb-16">
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{x.role}</div>
        <div className="grid-2" style={{ gap: 10 }}>
          <input className="pf-in" placeholder="Full name (e.g. Juan D. Cruz)" value={x.name} onChange={(e) => c.setSignatory(i, 'name', e.target.value)} />
          <input className="pf-in" placeholder="Position/Title" value={x.title} onChange={(e) => c.setSignatory(i, 'title', e.target.value)} />
        </div>
      </div>
    ))}
  </>
  );
}
