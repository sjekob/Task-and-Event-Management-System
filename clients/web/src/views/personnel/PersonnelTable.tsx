import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PersonnelController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { ActionMenu } from '../../ui/kit';

// Collapsible user tables (Academic Delegation / Personal Information).
export function Collapsible({ title, count, children, initiallyOpen, deactivated }: { title: string; count: number; children: ReactNode; initiallyOpen?: boolean; deactivated?: boolean }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <div className="col gap-12">
      <button className={`pm-section ${deactivated ? 'off' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span>{title} ({count})</span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && children}
    </div>
  );
}

export function UserTable({ users, tab, deactivated, actions, onView }: {
  users: User[]; tab: 0 | 1; deactivated: boolean;
  actions: (u: User) => { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }[];
  onView: (u: User) => void;
}) {
  if (!users.length) return null;
  const list = (items: string[]) => <span className="ellipsis" style={{ display: 'block', maxWidth: 200 }} title={items.join('\n')}>{items.length ? items.join(', ') : '—'}</span>;
  return (
    <div className="pm-table-wrap">
      <table className={`table pm-table ${deactivated ? 'off' : ''}`}>
        <thead>
          {tab === 0 ? (
            <tr><th>ID</th><th>Name</th><th>Username</th><th>Contact</th><th>Email</th><th>Subject</th><th>Grade Level</th><th>Role</th><th>Action</th></tr>
          ) : (
            <tr><th>ID</th><th>Name</th><th>Birthdate</th><th>Specialization</th><th>Skills</th><th>Certifications</th><th>Date Hired</th><th>Address</th><th>Action</th></tr>
          )}
        </thead>
        <tbody>
          {users.map((u) => {
            const name = <button className="pm-link" onClick={() => onView(u)}>{u.fullName}</button>;
            const menu = <ActionMenu items={actions(u)} />;
            return tab === 0 ? (
              <tr key={u.id}>
                <td>{String(u.id).padStart(3, '0')}</td><td>{name}</td><td>{u.username}</td><td>{u.phoneNumber ?? '—'}</td><td>{u.email ?? '—'}</td>
                <td><span className="ellipsis" style={{ display: 'block', maxWidth: 220 }} title={PersonnelController.subjects(u)}>{PersonnelController.subjects(u)}</span></td>
                <td>{PersonnelController.grades(u)}</td><td>{u.roleLabel}</td><td>{menu}</td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{String(u.id).padStart(3, '0')}</td><td>{name}</td><td>{u.birthdate ?? '—'}</td><td>{u.education.specialization ?? '—'}</td>
                <td>{list(u.skills)}</td><td>{list(u.certifications)}</td>
                <td>{u.dateOfAppointment ?? '—'}</td><td><span className="ellipsis" style={{ display: 'block', maxWidth: 200 }}>{u.address ?? '—'}</span></td><td>{menu}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
