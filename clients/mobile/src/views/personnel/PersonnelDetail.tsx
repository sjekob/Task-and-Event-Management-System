import { ReactNode } from 'react';
import { View } from 'react-native';
import { PersonnelController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { C, Modal, T } from '../../ui/kit';
import { AuditHistory } from '../common/Audit';
import { CertificatesPanel } from '../common/CertificatesPanel';

/** Read-only details of one person, with certificates (reviewable) and change history. */
export function PersonnelDetail({ c, user: u, onClose }: { c: PersonnelController; user: User; onClose: () => void }) {
  const assignment = PersonnelController.assignmentLabel(u);
  const skills = PersonnelController.groupedSkills(u);
  return (
    <Modal title="User Details" subtitle={u.fullName} icon="user" onClose={onClose}>
      <Sec title="Basic Information">
        <F label="ID" value={u.id > 0 ? String(u.id).padStart(3, '0') : '—'} />
        <F label="Username" value={u.username} />
        <F label="Role" value={u.roleLabel} />
        <F label="Status" value={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? '#16a34a' : '#dc2626'} />
      </Sec>
      <Sec title="Contact Information">
        <F label="Email" value={u.email ?? '—'} />
        <F label="Contact Number" value={u.phoneNumber ?? '—'} />
        <F label="Address" value={u.address ?? '—'} />
      </Sec>
      <Sec title="Academic Information">
        {u.isDean && u.deanGradeLevel ? <F label="Department" value={u.deanGradeLevel} /> : null}
        {assignment ? <F label="Assignment" value={assignment} /> : null}
        <F label="Subject-Grade Assignments" value={PersonnelController.subjectAssignments(u)} />
      </Sec>
      <Sec title="Personal Information">
        <F label="Birthdate" value={u.birthdate ?? '—'} />
        <F label="Date Hired" value={u.dateOfAppointment ?? '—'} />
      </Sec>
      <Sec title="Educational Background">
        <F label="Highest Educational Attainment" value={u.education.highestAttainment ?? '—'} />
        <F label="Undergraduate Degree" value={u.education.undergraduateDegree ?? '—'} />
        <F label="Area of Specialization" value={u.education.specialization ?? '—'} />
        <F label="Postgraduate Program Focus" value={u.education.postgraduateFocus ?? '—'} />
      </Sec>
      <Sec title="Certifications & Eligibility">
        {/* The principal/registrar verifies or rejects uploads here (never their own). */}
        <CertificatesPanel userId={u.id} canReview={c.canReviewCertificates && !c.isMe(u)} />
      </Sec>
      <Sec title="Skills">
        {skills.length ? skills.map((g) => <F key={g.category} label={g.category} value={g.items} />) : <F label="None on file" value="—" />}
      </Sec>
      {c.canViewAudit && <Sec title="Change History"><AuditHistory entityType="user" entityId={u.id} /></Sec>}
    </Modal>
  );
}

export function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginBottom: 6 }}>
      <T size={16} weight={700} style={{ paddingBottom: 6, borderBottomWidth: 1, borderColor: C.border }}>{title}</T>
      {children}
    </View>
  );
}

export function F({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <T size={12} color={C.light}>{label}</T>
      <T size={14.5} weight={color ? 600 : 400} color={color ?? C.text}>{value}</T>
    </View>
  );
}
