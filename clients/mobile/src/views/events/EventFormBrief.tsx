import { View } from 'react-native';
import { NATURES, ProposalFormController } from '@shared/controllers/EventControllers';
import { Format } from '@shared/utils/format';
import { useFeedback } from '../../ui/feedback';
import { C, Check, DateField, Field, Input, Row, T } from '../../ui/kit';
import { AddBtn, RichPlain, StepTitle } from './EventFormFields';
import { VenuePinCard } from './ProposalExtras';

/** Step 1: the proposal brief. */
export function BriefStep({ c }: { c: ProposalFormController }) {
  const fb = useFeedback();
  const s = c.state;
  const d = s.d;
  const dateOk = !s.dateIssue && !!d.targetDate.trim() && !s.checkingDate;
  const count = (key: 'tMale' | 'tFemale' | 'jMale' | 'jFemale') => (
    <Input keyboardType="number-pad" style={{ flex: 1, textAlign: 'center' }} placeholder={String(d[key])} value={d[key] ? String(d[key]) : ''} onChangeText={(v) => c.setCount(key, v)} />
  );
  return (
    <>
      <StepTitle>I. PROPOSAL BRIEF</StepTitle>
      <RichPlain label="a. Title" placeholder="Enter project title" value={d.title} onChange={(v) => c.set('title', v)} />
      <Field label="b. Nature of Activity">
        <Row wrap gap={14}>{NATURES.map((n) => <Check key={n} radio checked={d.nature === n} onChange={() => c.set('nature', n)} label={n} />)}</Row>
      </Field>
      <Field label="c. Target Date">
        <DateField value={c.targetDateIso || null} min={Format.isoDate(new Date())}
          onChange={(v) => {
            if (v && c.isDayTaken(v)) fb.toast('Another event is already scheduled on that day.', 'error');
            if (v) c.setTargetDate(v);
          }} />
        {d.targetDate ? <T size={12} color={C.muted}>{d.targetDate}</T> : null}
        {s.dateIssue ? <T size={12} color={C.red}>{s.dateIssue}</T>
          : s.checkingDate ? <T size={12} color={C.muted}>Checking the calendar...</T>
          : dateOk ? <T size={12} color="#16a34a">No other event is scheduled on this date.</T> : null}
        {s.dateWarning && !s.dateIssue ? <T size={12} color={C.amberDark}>{s.dateWarning}</T> : null}
      </Field>
      <RichPlain label="d. Proposed Venue" placeholder="e.g. NCS II Pavilion" value={d.venue} onChange={(v) => c.set('venue', v)} />
      <VenuePinCard c={c} />
      <Field label="e. Target Participants">
        <View style={{ gap: 8, backgroundColor: C.surface2, borderRadius: 12, padding: 10 }}>
          <Row><T size={11.5} weight={700} color={C.muted} style={{ flex: 2 }}>CATEGORY</T><T size={11.5} weight={700} color={C.muted} style={{ flex: 1, textAlign: 'center' }}>MALE</T><T size={11.5} weight={700} color={C.muted} style={{ flex: 1, textAlign: 'center' }}>FEMALE</T><T size={11.5} weight={700} color={C.muted} style={{ width: 40, textAlign: 'center' }}>TOTAL</T></Row>
          {([['pCat1', 'tMale', 'tFemale', c.totals.t], ['pCat2', 'jMale', 'jFemale', c.totals.j]] as const).map(([cat, m, f, t]) => (
            <Row key={cat}>
              <Input style={{ flex: 2 }} placeholder="Category" value={d[cat]} onChangeText={(v) => c.set(cat, v)} />
              {count(m)}{count(f)}
              <T weight={600} style={{ width: 40, textAlign: 'center' }}>{t}</T>
            </Row>
          ))}
          <Row><T weight={700} style={{ flex: 2 }}>TOTAL</T><T weight={700} style={{ flex: 1, textAlign: 'center' }}>{c.totals.male}</T><T weight={700} style={{ flex: 1, textAlign: 'center' }}>{c.totals.female}</T><T weight={700} style={{ width: 40, textAlign: 'center' }}>{c.totals.all}</T></Row>
        </View>
      </Field>
      <Field label="f. Expected Outputs">
        {d.outputs.map((o, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }}>
            <T size={12} color={C.muted} style={{ marginTop: 12 }}>{i + 1}.</T>
            <View style={{ flex: 1 }}><RichPlain value={o} placeholder="Expected output..." onChange={(v) => c.setOutput(i, v)} /></View>
          </Row>
        ))}
        <AddBtn label="Add output" onPress={() => c.addOutput()} />
      </Field>
      <Field label="g. Proposed Budget (₱)"><Input keyboardType="decimal-pad" placeholder="e.g. 3,120.00" value={d.budget} onChangeText={(v) => c.set('budget', v)} /></Field>
      <Field label="h. Source of Fund"><Input placeholder="e.g. School Paper Fund/SPTA Fund" value={d.fund} onChangeText={(v) => c.set('fund', v)} /></Field>
      <Field label="h. Focal Person">
        <Input placeholder="Full name" value={d.focalName} onChangeText={(v) => c.set('focalName', v)} />
        <RichPlain value={d.focalRole} placeholder="Designation" onChange={(v) => c.set('focalRole', v)} />
        <Input placeholder="CP # / Contact" keyboardType="phone-pad" value={d.focalCp} onChangeText={(v) => c.set('focalCp', v)} />
      </Field>
    </>
  );
}
