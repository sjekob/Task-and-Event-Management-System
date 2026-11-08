import { Pressable, View } from 'react-native';
import { EditProfileController, EduKey, ProfileTextField } from '@shared/controllers/ProfileControllers';
import { User } from '@shared/models';
import { useApp } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Button, C, DateField, Field, FeatherName, Icon, IconTile, Input, Modal, Row, Select, T } from '../../ui/kit';

export function SectionHeader({ icon, title }: { icon: FeatherName; title: string }) {
  return (
    <View style={{ paddingTop: 14, paddingBottom: 4, borderBottomWidth: 1, borderColor: C.border, marginBottom: 4 }}>
      <Row gap={10}><IconTile name={icon} tone="gray" size={28} /><T size={14} weight={700}>{title}</T></Row>
    </View>
  );
}

/** Edit Profile (owner only). */
export function EditProfileDialog({ profile, onClose }: { profile: User; onClose: (saved: boolean) => void }) {
  const app = useApp();
  const [c, s] = useScreenController(() => new EditProfileController(app.services, app.session, profile), [profile.id]);
  const field = (key: ProfileTextField, label: string) => (
    <Field label={label}>
      {EditProfileController.DATE_KEYS.includes(key)
        ? <DateField value={s.fields[key] || null} onChange={(v) => c.setField(key, v ?? '')} />
        : <Input value={s.fields[key]} keyboardType={key === 'email' ? 'email-address' : key === 'phone_number' ? 'phone-pad' : 'default'}
          autoCapitalize={key === 'email' ? 'none' : 'sentences'} onChangeText={(v) => c.setField(key, v)} />}
    </Field>
  );
  const edu = (key: EduKey, label: string) => {
    const opts = s.eduOptions[key] ?? [];
    return (
      <Field label={label}>
        <Select<string | null> value={s.edu[key] && opts.includes(s.edu[key]!) ? s.edu[key]! : null} title={label}
          options={[{ value: null, label: '— None —' }, ...opts.map((o) => ({ value: o, label: o }))]} onChange={(v) => c.setEdu(key, v)} />
      </Field>
    );
  };
  const taken = new Set(s.skills.map((x) => x.toLowerCase()));
  const remaining = s.skillOptions.filter((o) => !taken.has(o.name.toLowerCase()));

  return (
    <Modal title="Edit Profile" subtitle="Your skills and certificates, with how many tasks you have, are used to suggest you for matching tasks." onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onPress={() => onClose(false)}>Cancel</Button><Button loading={s.saving} onPress={async () => { if (await c.save()) onClose(true); }}>Save</Button></>}>
      <SectionHeader icon="credit-card" title="Basic Information" />
      {field('first_name', 'First Name')}{field('middle_name', 'Middle Name')}{field('last_name', 'Last Name')}{field('suffix', 'Suffix')}
      <SectionHeader icon="phone" title="Contact Information" />
      {field('email', 'Email')}{field('phone_number', 'Phone Number')}{field('address', 'Address')}
      <SectionHeader icon="users" title="Personal Details" />
      {field('birthdate', 'Birthdate')}
      <SectionHeader icon="briefcase" title="Employment" />
      {field('date_of_appointment', 'Date of Appointment')}
      <SectionHeader icon="book" title="Educational Background" />
      {edu('highest_attainment', 'Highest Educational Attainment')}
      {edu('undergraduate_degree', 'Undergraduate Degree')}
      {edu('specialization', 'Area of Specialization')}
      {/* Only for "With Master's Units" and higher. */}
      {c.hasPostgrad && field('postgraduate_focus', 'Postgraduate Program Focus')}
      <SectionHeader icon="cpu" title="Skills" />
      <Select<string | null> value={null} title="Add a skill" placeholder={!s.skillOptions.length ? 'Loading list...' : !remaining.length ? 'All skills added' : 'Select to add'}
        disabled={!remaining.length} options={remaining.map((o) => ({ value: o.name, label: o.name, hint: o.category ?? undefined }))}
        onChange={(v) => { if (v) c.setSkills([...s.skills, v]); }} />
      <Row wrap gap={6}>
        {s.skills.map((x) => (
          <Pressable key={x} onPress={() => c.setSkills(s.skills.filter((y) => y !== x))} accessibilityLabel={`Remove ${x}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff4fa', borderWidth: 1, borderColor: '#d0dceb', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T size={12}>{x}</T><Icon name="x" size={13} color={C.muted} />
          </Pressable>
        ))}
      </Row>
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
    </Modal>
  );
}
