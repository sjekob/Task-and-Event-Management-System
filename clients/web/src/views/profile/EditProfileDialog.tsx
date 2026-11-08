import { ReactNode } from 'react';
import { Briefcase, Contact, GraduationCap, IdCard, Brain, Users } from 'lucide-react';
import { EditProfileController, EduKey, ProfileTextField } from '@shared/controllers/ProfileControllers';
import { User } from '@shared/models';
import { useApp } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { CatalogMultiSelect } from '../../ui/CatalogMultiSelect';
import { Button, Field, Modal, Select, TextInput } from '../../ui/kit';

// Edit Profile dialog (owner only).
export function SectionHeader({ icon, title, dense }: { icon: ReactNode; title: string; dense?: boolean }) {
  return (
    <div style={{ padding: `${dense ? 22 : 36}px 0 ${dense ? 14 : 20}px` }}>
      <div className="row gap-10" style={{ gap: 10 }}>
        <span className="att-icon" style={{ width: 28, height: 28, background: '#eef2fa', color: 'var(--dark)' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
      </div>
      <hr className="divider" style={{ margin: '12px 0 0' }} />
    </div>
  );
}

export function EditProfileDialog({ profile, onClose }: { profile: User; onClose: (saved: boolean) => void }) {
  const app = useApp();
  const [c, s] = useScreenController(() => new EditProfileController(app.services, app.session, profile), [profile.id]);
  const today = new Date().toISOString().slice(0, 10);
  const field = (key: ProfileTextField, label: string) => {
    const isDate = EditProfileController.DATE_KEYS.includes(key);
    return (
      <Field label={label}>
        <TextInput value={s.fields[key]} type={isDate ? 'date' : key === 'email' ? 'email' : 'text'}
          max={isDate ? today : undefined} min={isDate ? '1940-01-01' : undefined}
          onChange={(e) => c.setField(key, e.target.value)} />
      </Field>
    );
  };
  const edu = (key: EduKey, label: string) => {
    const opts = s.eduOptions[key] ?? [];
    return (
      <Field label={label}>
        <Select value={s.edu[key] && opts.includes(s.edu[key]!) ? s.edu[key]! : ''} onChange={(e) => c.setEdu(key, e.target.value || null)}>
          <option value="">— None —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
    );
  };
  return (
    <Modal title="Edit Profile" size="wide" onClose={() => onClose(false)}
      subtitle="Your skills and certificates, with how many tasks you have, are used to suggest you for matching tasks. Certifications are added by uploading the certificate on your profile."
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button loading={s.saving} onClick={async () => { if (await c.save()) onClose(true); }}>Save</Button></>}>
      <SectionHeader dense icon={<IdCard size={16} />} title="Basic Information" />
      <div className="grid-2" style={{ gap: 10 }}>{field('first_name', 'First Name')}{field('middle_name', 'Middle Name')}{field('last_name', 'Last Name')}{field('suffix', 'Suffix')}</div>
      <SectionHeader dense icon={<Contact size={16} />} title="Contact Information" />
      <div className="grid-2" style={{ gap: 10 }}>{field('email', 'Email')}{field('phone_number', 'Phone Number')}</div>
      <div className="mt-8">{field('address', 'Address')}</div>
      <SectionHeader dense icon={<Users size={16} />} title="Personal Details" />
      <div className="grid-2" style={{ gap: 10 }}>{field('birthdate', 'Birthdate')}</div>
      <SectionHeader dense icon={<Briefcase size={16} />} title="Employment" />
      {field('date_of_appointment', 'Date of Appointment')}
      <SectionHeader dense icon={<GraduationCap size={16} />} title="Educational Background" />
      <div className="grid-2" style={{ gap: 10 }}>
        {edu('highest_attainment', 'Highest Educational Attainment')}
        {edu('undergraduate_degree', 'Undergraduate Degree')}
        {edu('specialization', 'Area of Specialization')}
        {/* Only for "With Master's Units" and higher. */}
        {c.hasPostgrad ? field('postgraduate_focus', 'Postgraduate Program Focus') : <div />}
      </div>
      <SectionHeader dense icon={<Brain size={16} />} title="Skills" />
      <CatalogMultiSelect label="Skills" selected={s.skills} options={s.skillOptions} onChange={(v) => c.setSkills(v)} />
      {s.error && <div className="alert red mt-12">{s.error}</div>}
    </Modal>
  );
}
