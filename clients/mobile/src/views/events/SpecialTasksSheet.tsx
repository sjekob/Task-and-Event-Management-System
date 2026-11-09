import { View } from 'react-native';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { MemberRow, taskDueDate } from '@shared/controllers/proposalDraft';
import { Format } from '@shared/utils/format';
import { Button, C, Check, Input, Modal, Row, T } from '../../ui/kit';

/**
 * The proponent chooses which committee members get a special task when the
 * event is approved: titled by the Output, described by the Terms of Reference,
 * due a number of days after the event (7 by default, changeable per task).
 * Same rules as the web table; on a phone each member is a card.
 */
export function SpecialTasksSheet({ c, onClose, onSubmit, submitting }: {
  c: ProposalFormController; onClose: () => void; onSubmit?: () => void; submitting?: boolean;
}) {
  const d = c.state.d;
  const rows = d.twg.flatMap((g, gi) => g.members.map((m, mi) => ({ g, gi, m, mi }))).filter((r) => r.m.name.trim());
  const eligible = rows.filter((r) => ProposalFormController.canAutomate(r.m));
  const checked = eligible.filter((r) => r.m.automate).length;
  const allOn = eligible.length > 0 && checked === eligible.length;

  return (
    <Modal title={onSubmit ? 'Before you submit: special tasks' : 'Special Tasks'} icon="clipboard" onClose={onClose}
      subtitle="Checked members get a special task when the event is approved. Unchecked members get the top score (100/100)."
      footer={onSubmit ? (
        <Row gap={8}>
          <Button variant="outline" style={{ flex: 1 }} onPress={onClose}>Back</Button>
          <Button style={{ flex: 1 }} loading={submitting} onPress={onSubmit}>Submit · {checked} task{checked === 1 ? '' : 's'}</Button>
        </Row>
      ) : <Button block onPress={onClose}>Done · {checked} of {eligible.length} chosen</Button>}>
      {!rows.length ? <T color={C.muted} center>Add committee members first.</T> : (
        <>
          <Check checked={allOn} disabled={!eligible.length} onChange={() => c.setAllAutomate(!allOn)} label="Select all who can get a task" />
          {rows.map(({ g, gi, m, mi }) => {
            const can = ProposalFormController.canAutomate(m);
            const due = taskDueDate(d.targetDate, m.dueDays);
            return (
              <View key={`${gi}-${mi}`} style={{ borderWidth: 1, borderColor: m.automate ? C.accent : C.border, borderRadius: 12, padding: 12, gap: 8,
                backgroundColor: m.automate ? C.accentBg : C.card }}>
                <Check checked={m.automate} disabled={!can} onChange={() => c.setMemberAutomate(gi, mi, !m.automate)}
                  label={<View style={{ flex: 1 }}>
                    <T weight={700}>{m.name}</T>
                    <T size={12} color={C.muted}>{[m.designation, g.title].filter((x) => x.trim()).join(' · ')}</T>
                  </View>} />
                {!can && <T size={12} color={C.amberDark}>{whyNot(m)}</T>}
                <View style={{ gap: 2 }}>
                  <T size={11} weight={600} color={C.muted}>OUTPUT (TASK TITLE)</T>
                  <T size={13.5} weight={600}>{m.output.trim() || 'No Output written'}</T>
                </View>
                <View style={{ gap: 2 }}>
                  <T size={11} weight={600} color={C.muted}>DESCRIPTION (TERMS OF REFERENCE)</T>
                  <T size={13} color={C.text2}>{m.tor.trim() || 'No Terms of Reference written'}</T>
                </View>
                <Row gap={8} style={{ opacity: m.automate ? 1 : 0.55 }}>
                  <Input value={String(m.dueDays)} keyboardType="number-pad" editable={m.automate} style={{ width: 64 }}
                    onChangeText={(v) => c.setMemberDueDays(gi, mi, v === '' ? 0 : Number(v.replace(/\D/g, '')))} />
                  <T size={12.5} color={C.text2} style={{ flex: 1 }}>
                    days after the event{due ? ` · due ${Format.date(due)}` : ' · set the event date first'}
                  </T>
                </Row>
              </View>
            );
          })}
        </>
      )}
    </Modal>
  );
}

function whyNot(m: MemberRow): string {
  return m.userId === null ? 'Link an account to give a task' : 'Write an Output to title the task';
}
