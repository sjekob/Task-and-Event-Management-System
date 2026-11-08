import { useState } from 'react';
import { ChevronRight, UserMinus, UserPlus } from 'lucide-react';
import { AssignMoreController, TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Task, User } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { AssignPickerDialog, AssignRoleSelector } from '../../ui/AssignPickerDialog';
import { Avatar, Button, Modal, Spinner } from '../../ui/kit';
import { Pill, Run } from './TaskDetailParts';

// Assignees with their status, plus adding / removing people.
export function AssigneesCard({ c, run }: { c: TaskDetailController; run: Run }) {
  const fb = useFeedback();
  const [assigning, setAssigning] = useState(false);
  const users = c.team;
  const selected = c.selectedReport?.personnelId;
  const remove = async (u: User) => {
    const ok = await fb.confirm({
      title: `Remove ${u.fullName}?`,
      message: 'They will no longer see this task. Anything they already submitted stays on record.',
      confirmLabel: `Remove ${u.fullName.split(' ')[0]}`, cancelLabel: 'Keep assigned', danger: true,
    });
    if (ok) await run(() => c.unassign(u.id));
  };
  return (
    <div className="td-card">
      <div className="row gap-8">
        <span className="td-title">{c.mineOnly ? 'People you assigned' : 'Assigned personnel'}</span>
        <Pill tone="gray">{users.length}</Pill>
        <div className="grow" />
        {c.canAssign && <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setAssigning(true)}>Assign</Button>}
      </div>
      {users.length === 0 ? <div className="body-md mt-12">No one is assigned yet.</div> : (
        <div className="td-assignees mt-12">
          {users.map((u) => {
            const st = c.statusFor(u);
            const has = !!c.reportOf(u.id);
            return (
              <div key={u.id} className={`td-assignee ${selected === u.id ? 'on' : ''} ${has ? 'clickable' : ''}`} onClick={() => has && c.selectAssignee(u)}>
                <Avatar url={u.avatarUrl} initials={u.initials} size={34} />
                <div className="grow">
                  <div className="ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>{u.fullName}</div>
                  <div className="caption">{[u.roleLabel, u.gradeLevel].filter(Boolean).join(' · ')}</div>
                </div>
                <Pill tone={st.tone}>{st.label}</Pill>
                {has && <span title={`View ${u.fullName.split(' ')[0]}'s report`}><ChevronRight size={20} color={selected === u.id ? 'var(--accent)' : 'var(--light)'} /></span>}
                {c.canAssign && (
                  <button className="icon-btn sm" title={`Remove ${u.fullName}`} onClick={(e) => { e.stopPropagation(); void remove(u); }}><UserMinus size={18} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {assigning && <AssignMoreDialog task={c.task} onClose={() => setAssigning(false)} onAssigned={() => void c.load()} />}
    </div>
  );
}

export function AssignMoreDialog({ task, onClose, onAssigned }: { task: Task; onClose: () => void; onAssigned: () => void }) {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new AssignMoreController(services, task, user?.assignableRoles ?? []), []);
  const header = c.roles.length > 1 ? (
    <div>
      <div className="label-sm mb-8">Assign as</div>
      <AssignRoleSelector options={c.roles} value={s.role} onChange={(r) => c.setRole(r)} />
    </div>
  ) : null;
  if (s.loading || s.error || !s.available.length) {
    return (
      <Modal title="Assign Users" onClose={onClose}>
        {header}
        <div className="center-fill">{s.loading ? <Spinner /> : <span className="body-md">{s.error ?? 'Everyone with this role is already assigned.'}</span>}</div>
      </Modal>
    );
  }
  return (
    <AssignPickerDialog
      key={s.role}
      title="Assign Users"
      header={header}
      onClose={onClose}
      options={{
        users: s.available, selected: [], hasTaskText: c.hasTaskText, loadSuggestions: c.loadSuggestions,
        onConfirm: async (ids) => {
          const skipped = await c.assign(ids);
          onAssigned();
          if (skipped > 0) fb.toast(`${skipped} ${skipped === 1 ? 'person was' : 'people were'} not assigned — outside what your role may assign.`, 'error');
          else fb.toast('Assigned');
        },
      }}
    />
  );
}
