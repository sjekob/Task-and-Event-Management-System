import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { PersonnelController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { AuditHistory } from '../../ui/Audit';
import { CertificatesPanel } from '../../ui/CertificatesPanel';
import { Button } from '../../ui/kit';

// Read-only details of one person, with certificates and change history.
export function PersonnelDetail({ c, user: u, onClose }: { c: PersonnelController; user: User; onClose: () => void }) {
  const assignment = PersonnelController.assignmentLabel(u);
  const skills = PersonnelController.groupedSkills(u);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" style={{ maxWidth: 700, overflow: 'hidden' }}>
        <div className="row" style={{ background: '#6b7a92', color: '#fff', padding: '18px 12px 18px 24px' }}>
          <span className="grow" style={{ fontSize: 18, fontWeight: 700 }}>User Details</span>
          <button className="icon-btn-plain" style={{ color: '#fff' }} onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <div className="modal-body" style={{ padding: '24px 28px 8px' }}>
          <Sec title="Basic Information">
            <Two l={<F label="ID" value={u.id > 0 ? String(u.id).padStart(3, '0') : '—'} />} r={<F label="Name" value={u.fullName || '—'} />} />
            <Two l={<F label="Username" value={u.username} />} r={<F label="Role" value={u.roleLabel} />} />
            <F label="Status" value={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? '#16a34a' : '#dc2626'} />
          </Sec>
          <Sec title="Contact Information">
            <Two l={<F label="Email" value={u.email ?? '—'} />} r={<F label="Contact Number" value={u.phoneNumber ?? '—'} />} />
            <F label="Address" value={u.address ?? '—'} />
          </Sec>
          <Sec title="Academic Information">
            {u.isDean && u.deanGradeLevel && <F label="Department" value={u.deanGradeLevel} />}
            {assignment && <F label="Assignment" value={assignment} />}
            <F label="Subject-Grade Assignments" value={PersonnelController.subjectAssignments(u)} />
          </Sec>
          <Sec title="Personal Information">
            <Two l={<F label="Birthdate" value={u.birthdate ?? '—'} />} r={<F label="Date Hired" value={u.dateOfAppointment ?? '—'} />} />
          </Sec>
          <Sec title="Educational Background">
            <Two l={<F label="Highest Educational Attainment" value={u.education.highestAttainment ?? '—'} />} r={<F label="Undergraduate Degree" value={u.education.undergraduateDegree ?? '—'} />} />
            <Two l={<F label="Area of Specialization" value={u.education.specialization ?? '—'} />} r={<F label="Postgraduate Program Focus" value={u.education.postgraduateFocus ?? '—'} />} />
          </Sec>
          <Sec title="Certifications & Eligibility">
            {/* The principal/registrar verifies or rejects uploads here (never their own). */}
            <CertificatesPanel userId={u.id} canReview={c.canReviewCertificates && !c.isMe(u)} />
          </Sec>
          <Sec title="Skills">
            {skills.length ? skills.map((g) => <F key={g.category} label={g.category} value={g.items} />) : <F label="None on file" value="—" />}
          </Sec>
          {c.canViewAudit && <Sec title="Change History"><AuditHistory entityType="user" entityId={u.id} /></Sec>}
        </div>
        <div style={{ padding: '8px 24px 18px' }}><Button style={{ background: '#6b7a92', padding: '12px 28px' }} onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

export function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>{title}</div>
      <div className="col gap-16" style={{ gap: 18 }}>{children}</div>
    </div>
  );
}

export function Two({ l, r }: { l: ReactNode; r: ReactNode }) {
  return <div className="grid-2" style={{ gap: 24 }}>{l}{r}</div>;
}

export function F({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--light)' }}>{label}</div>
      <div style={{ fontSize: 15, marginTop: 4, color: color ?? 'var(--text)', fontWeight: color ? 600 : 400, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
