import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { MemberRow } from '@shared/controllers/proposalDraft';
import { CommitteeSuggestion } from '@shared/services/EventService';
import { Avatar, Badge, C, Icon, Modal, Row, Spinner, T } from '../../ui/kit';

/**
 * "Suggest who fits" for a committee member: staff ranked for the member's role
 * (Terms of Reference, output, designation) by the same fit score as task
 * assignment, the person named in the proposal first. Tapping one links them.
 */
export function CommitteeSuggest({ c, g, i, m }: { c: ProposalFormController; g: number; i: number; m: MemberRow }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CommitteeSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = async () => {
    setOpen(true);
    setList(null);
    setError(null);
    try { setList(await c.suggestMembers(g, i)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load suggestions'); }
  };

  return (
    <>
      <Pressable onPress={() => void show()} accessibilityRole="button" accessibilityLabel="Suggest who fits this role"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
          borderRadius: 999, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentBg }}>
        <Icon name="zap" size={14} color={C.accentDark} /><T size={12.5} weight={600} color={C.accentDark}>Suggest who fits</T>
      </Pressable>
      {open && (
        <Modal title="Who fits this role" icon="zap" onClose={() => setOpen(false)}
          subtitle={m.tor.trim() || m.output.trim() ? 'From their skills, certificates and current workload.' : 'Add the Terms of Reference or output for better matches.'}>
          {error ? <T color={C.red}>{error}</T>
            : !list ? <View style={{ padding: 20, alignItems: 'center' }}><Spinner /></View>
            : !list.length ? <T color={C.muted}>No staff to suggest.</T>
            : list.map(({ s, nameMatch }) => {
              const on = m.userId === s.user.id;
              const tone = s.score >= 70 ? 'green' : s.score >= 40 ? 'amber' : 'gray';
              return (
                <Pressable key={s.user.id} onPress={() => { c.linkMember(g, i, s.user.id, s.user.fullName); setOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10,
                    backgroundColor: on ? C.accentBg : C.card, borderWidth: 1, borderColor: on ? C.accent : C.border }}>
                  <Avatar url={s.user.avatarUrl} initials={s.user.initials} size={34} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={6} wrap><T weight={700}>{s.user.fullName}</T>{nameMatch ? <Badge tone="blue">Named in proposal</Badge> : null}</Row>
                    <T size={12} color={C.muted}>
                      {[s.user.roleLabel, s.user.gradeLevel].filter(Boolean).join(' · ')} · {s.openTasks} open task{s.openTasks === 1 ? '' : 's'}{s.isHighBurden ? ' · busy' : ''}
                    </T>
                    <T size={12} color={C.text2} lines={2}>{s.reasons[0] ?? 'No matching skills or certificates on file'}</T>
                  </View>
                  <Badge tone={tone}>{String(Math.round(s.score))}</Badge>
                </Pressable>
              );
            })}
        </Modal>
      )}
    </>
  );
}
