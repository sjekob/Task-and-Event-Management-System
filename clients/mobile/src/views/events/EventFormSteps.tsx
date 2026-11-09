import { useState } from 'react';
import { View } from 'react-native';
import { MemberRow, MemberText, ProposalFormController } from '@shared/controllers/EventControllers';
import { memberResult } from '@shared/controllers/proposalReading';
import { Badge, Button, C, Field, Icon, Input, Row, Select, T } from '../../ui/kit';
import { CommitteeSuggest } from './CommitteeSuggest';
import { AddBtn, Note, RichPlain, RowCard, RowList, StepTitle } from './EventFormFields';
import { SpecialTasksSheet } from './SpecialTasksSheet';

// Steps 2-6 of the proposal form.
export function RationaleStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
    <>
      <StepTitle>II. RATIONALE</StepTitle>
      <RichPlain multiline rows={8} value={d.rationale} placeholder="Provide the rationale for this activity..." onChange={(v) => c.set('rationale', v)} />
      <StepTitle>III. OBJECTIVES</StepTitle>
      <Note>Enter each objective on a new line. They will be numbered automatically in the printed proposal.</Note>
      <RichPlain multiline rows={8} value={d.objectives} placeholder="equip young journalists with the basics of writing..." onChange={(v) => c.set('objectives', v)} />
    </>
  );
}

export function MethodologyStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
    <>
      <StepTitle>IV. METHODOLOGY</StepTitle>
      <Field label="Introduction" help="How the activity will be carried out, before the phases.">
        <Input multiline rows={4} value={d.methodologyIntro} placeholder="e.g. The training shall be composed of lectures, video clip viewing, sharing and games."
          onChangeText={(v) => c.set('methodologyIntro', v)} />
      </Field>
      {d.phases.map((r, i) => (
        <RowCard key={i} title={`Phase ${i + 1}`} onRemove={() => c.removeRow('phases', i)}>
          <Field label="Stage"><Input multiline rows={2} value={r.stage} onChangeText={(v) => c.setRow('phases', i, 'stage', v)} /></Field>
          <Field label="Activities"><Input multiline rows={3} value={r.activities} onChangeText={(v) => c.setRow('phases', i, 'activities', v)} /></Field>
        </RowCard>
      ))}
      <AddBtn label="Add phase" onPress={() => c.addRow('phases')} />
    </>
  );
}

export function MatrixStep({ c }: { c: ProposalFormController }) {
  return (
    <>
      <StepTitle>V. ACTIVITY MATRIX</StepTitle>
      <Note>Attendance QR codes use each row's day and time (write the time as a range, e.g. 4:00-5:00 PM). A special task, if named, is completed for every attendee who times out and evaluates the activity.</Note>
      <RowList list="matrix" c={c} rows={c.state.d.matrix} title={(i) => `Row ${i + 1}`}
        cols={[['day', 'Day', 'Oct. 23, 2024'], ['time', 'Time', '4:00-5:00 PM'], ['event', 'Event', 'e.g. News Writing'], ['speaker', 'Speaker', 'Speaker name']]} />
      <AddBtn label="Add row" onPress={() => c.addRow('matrix')} />
    </>
  );
}

export function BudgetStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
    <>
      <StepTitle>VII. PROPOSED BUDGET</StepTitle>
      <Note>Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.</Note>
      <T weight={600}>a. Training Materials</T>
      <RowList list="materials" c={c} rows={d.materials} title={(i) => `Item ${i + 1}`}
        cols={[['item', 'Particulars', 'Bond paper...'], ['qty', 'Quantity', '1 ream'], ['cost', 'Cost', '270.00'], ['total', 'Total', '270.00']]} />
      <AddBtn label="Add item" onPress={() => c.addRow('materials')} />
      <T weight={600}>b. Snacks for Program Partners</T>
      <RowList list="snacks" c={c} rows={d.snacks} title={(i) => `Item ${i + 1}`}
        cols={[['item', 'Particulars', 'Meals'], ['pax', 'No. of Participants', '11 pax'], ['cost', 'Cost/pax', '100.00'], ['total', 'Total', '1100.00']]} />
      <AddBtn label="Add item" onPress={() => c.addRow('snacks')} />
      <StepTitle>VI. WORKING COMMITTEE</StepTitle>
      <T weight={600}>a. Executive Committee</T>
      <RowList list="exec" c={c} rows={d.exec} title={(i) => `Member ${i + 1}`} cols={[['name', 'Name', 'e.g. FREDERICK M. BALDOZA'], ['position', 'Position', 'e.g. Principal']]} />
      <AddBtn label="Add member" onPress={() => c.addRow('exec')} />
      <T weight={600}>b. Technical Working Group</T>
      {d.twg.map((g, gi) => (
        <RowCard key={gi} title="Committee" onRemove={d.twg.length > 1 ? () => c.removeTwgGroup(gi) : undefined}>
          <Input value={g.title} placeholder="e.g. Supervising Committee" style={{ fontWeight: '600' }} onChangeText={(v) => c.setTwgTitle(gi, v)} />
          {g.members.map((m, mi) => <MemberCard key={mi} c={c} g={gi} i={mi} m={m} />)}
          <AddBtn label="Add member" onPress={() => c.addMember(gi)} />
        </RowCard>
      ))}
      <AddBtn label="Add Committee Group" onPress={() => c.addTwgGroup()} />
      <SpecialTasksBar c={c} />
    </>
  );
}

/** Opens the special-task chooser; says how many members get a task. */
function SpecialTasksBar({ c }: { c: ProposalFormController }) {
  const [open, setOpen] = useState(false);
  const members = c.state.d.twg.flatMap((g) => g.members).filter((m) => m.name.trim());
  const automated = members.filter((m) => m.automate).length;
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong, borderRadius: 12, padding: 12, gap: 8, backgroundColor: C.surface2 }}>
      <Row gap={8}><Icon name="clipboard" size={17} color={C.accent} /><T weight={700}>Special tasks on approval</T></Row>
      <T size={12.5} color={C.text2}>
        {automated ? `${automated} of ${members.length} committee members get a special task.` : 'No special tasks chosen: linked members get the top score instead.'}
        {' '}Each task is titled by the Output, described by the Terms of Reference, and due 7 days after the event unless you change it.
      </T>
      <Button disabled={!members.length} onPress={() => setOpen(true)}>Choose special tasks</Button>
      {open && <SpecialTasksSheet c={c} onClose={() => setOpen(false)} />}
    </View>
  );
}

/** A TWG member: details and the linked account (special tasks are chosen in the chooser). */
function MemberCard({ c, g, i, m }: { c: ProposalFormController; g: number; i: number; m: MemberRow }) {
  const fields: [MemberText, string, string][] = [['name', 'Name', 'Full name'], ['designation', 'Designation', 'e.g. Chairperson'], ['tor', 'Terms of Reference', 'e.g. Leads the Committee'], ['output', 'Output', 'e.g. Checked reports']];
  return (
    <RowCard title={`Member ${i + 1}`} onRemove={() => c.removeMember(g, i)}>
      {fields.map(([k, label, hint]) => <Field key={k} label={label}><Input placeholder={hint} value={m[k]} onChangeText={(v) => c.setMember(g, i, k, v)} /></Field>)}
      <Field label="Linked account">
        <Select<number | null> value={m.userId} title="Link to an account" placeholder="Not linked to an account"
          options={[{ value: null, label: 'Not linked to an account' }, ...c.state.people.map((p) => ({ value: p.id, label: p.name }))]}
          onChange={(v) => c.linkMember(g, i, v)} />
      </Field>
      <CommitteeSuggest c={c} g={g} i={i} m={m} />
      <Badge tone={memberResult(m).tone}>{memberResult(m).label}</Badge>
    </RowCard>
  );
}

export function MonitoringStep({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  return (
    <>
      <StepTitle>VIII. MONITORING AND EVALUATION</StepTitle>
      <RichPlain label="Monitoring Instructions / Evaluation Criteria" multiline rows={6} value={d.monitoring} placeholder="Add specific monitoring instructions or evaluation criteria..." onChange={(v) => c.set('monitoring', v)} />
      <StepTitle>Observation Tool Indicators</StepTitle>
      <Note>List the indicators to be observed. The Evident / Not Evident columns will be filled in on the printed evaluation form.</Note>
      {d.indicators.map((x, i) => (
        <RowCard key={i} title={`Indicator ${i + 1}`} onRemove={d.indicators.length > 1 ? () => c.removeIndicator(i) : undefined}>
          <Input placeholder="Describe what will be observed..." value={x} onChangeText={(v) => c.setIndicator(i, v)} />
        </RowCard>
      ))}
      <AddBtn label="Add indicator" onPress={() => c.addIndicator()} />
      <StepTitle>Signatories</StepTitle>
      <Note>Enter the names and positions of the signatories. These will appear in the printed proposal.</Note>
      {d.signatories.map((x, i) => (
        <Field key={x.role} label={x.role}>
          <Input placeholder="Full name (e.g. Juan D. Cruz)" value={x.name} onChangeText={(v) => c.setSignatory(i, 'name', v)} />
          <Input placeholder="Position/Title" value={x.title} onChangeText={(v) => c.setSignatory(i, 'title', v)} />
        </Field>
      ))}
      <Row><T size={11.5} color={C.muted}>Tip: bold, underline and text size can be set on the web version of the form.</T></Row>
    </>
  );
}
