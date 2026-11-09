import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AssignMoreController, TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Task, User } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Avatar, Badge, Button, C, Icon, IconButton, Loading, Modal, T } from '../../ui/kit';
import { AssignPickerDialog, AssignRoleSelector } from '../common/AssignPicker';
import { Block, Run } from './TaskDetailParts';

/** Assignees with their status; tap one with a report to review it. Adds and removes people. */
export function AssigneesCard({ c, run, onPick }: { c: TaskDetailController; run: Run; onPick?: () => void }) {
  const fb = useFeedback();
  const [assigning, setAssigning] = useState(false);
  const users = c.team;
  const selected = c.selectedReport?.personnelId;
  const remove = async (u: User) => {
    const ok = await fb.confirm({
      title: `Remove ${u.fullName}?`, message: 'They will no longer see this task. Anything they already submitted stays on record.',
      confirmLabel: `Remove ${u.fullName.split(' ')[0]}`, cancelLabel: 'Keep assigned', danger: true,
    });
    if (ok) await run(() => c.unassign(u.id));
  };
  return (
    <Block title={`${c.mineOnly ? 'People you assigned' : 'Assigned personnel'} (${users.length})`}
      right={c.canAssign ? <Button size="sm" icon="user-plus" onPress={() => setAssigning(true)}>Assign</Button> : null}>
      {users.length === 0 ? <T size={13} color={C.muted}>No one is assigned yet.</T> : users.map((u) => {
        const st = c.statusFor(u);
        const has = !!c.reportOf(u.id);
        return (
          <Pressable key={u.id} onPress={() => { if (has) { c.selectAssignee(u); onPick?.(); } }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, backgroundColor: selected === u.id ? C.blueBg : 'transparent' }}>
            <Avatar url={u.avatarUrl} initials={u.initials} size={34} />
            <View style={{ flex: 1 }}>
              <T size={14} weight={600} lines={1}>{u.fullName}</T>
              <T size={11.5} color={C.muted}>{[u.roleLabel, u.gradeLevel].filter(Boolean).join(' · ')}</T>
            </View>
            <Badge tone={st.tone}>{st.label}</Badge>
            {has && <Icon name="chevron-right" size={18} color={selected === u.id ? C.accent : C.light} />}
            {c.canAssign && <IconButton name="user-minus" size={17} label={`Remove ${u.fullName}`} color={C.muted} onPress={() => void remove(u)} />}
          </Pressable>
        );
      })}
      {assigning && <AssignMoreDialog task={c.task} onClose={() => setAssigning(false)} onAssigned={() => void c.load()} />}
    </Block>
  );
}

export function AssignMoreDialog({ task, onClose, onAssigned }: { task: Task; onClose: () => void; onAssigned: () => void }) {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new AssignMoreController(services, task, user?.assignableRoles ?? []), []);
  const header = c.roles.length > 1 ? (
    <View style={{ gap: 6 }}>
      <T size={12.5} weight={600}>Assign as</T>
      <AssignRoleSelector options={c.roles} value={s.role} onChange={(r) => c.setRole(r)} />
    </View>
  ) : null;
  if (s.loading || s.error || !s.available.length) {
    return (
      <Modal title="Assign Users" onClose={onClose}>
        {header}
        {s.loading ? <Loading /> : <T color={C.muted}>{s.error ?? 'Everyone with this role is already assigned.'}</T>}
      </Modal>
    );
  }
  return (
    <AssignPickerDialog key={s.role} title="Assign Users" header={header} onClose={onClose}
      options={{
        users: s.available, selected: [], hasTaskText: c.hasTaskText, loadSuggestions: c.loadSuggestions,
        onConfirm: async (ids) => {
          const skipped = await c.assign(ids);
          onAssigned();
          if (skipped > 0) fb.toast(`${skipped} ${skipped === 1 ? 'person was' : 'people were'} not assigned — outside what your role may assign.`, 'error');
          else fb.toast('Assigned');
        },
      }} />
  );
}
