import { useState, type ReactNode } from 'react';
import {
  Avatar, Badge, Box, Button, Divider, Group, Modal, MultiSelect, NumberInput, Paper, ScrollArea, Select,
  SimpleGrid, Stack, Switch, Text, TextInput, ThemeIcon, Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAddressBook, IconAward, IconBrain, IconBriefcase, IconId, IconSchool, IconUsers,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, flag, formatLongIsoDate, initials, qk, roleLabel, titleCase, useSession, type User,
} from '@tasknet/shared';
import { CertificatesPanel } from '../../components/CertificatesPanel';
import { ErrorState, notifyError, notifySuccess, PageLoader } from '../../components/ui';
import { colors } from '../../theme';

const longDate = formatLongIsoDate;

export function SectionHeader({ icon, title, dense }: { icon: ReactNode; title: string; dense?: boolean }) {
  return (
    <Box pt={dense ? 22 : 36} pb={dense ? 14 : 20}>
      <Group gap={10}>
        <ThemeIcon size={28} radius={8} style={{ background: '#EEF2FA', color: colors.dark }}>{icon}</ThemeIcon>
        <Text fw={700} size="sm">{title}</Text>
      </Group>
      <Divider mt={12} />
    </Box>
  );
}

export function Info({ label, value, span = 1 }: { label: string; value?: string | null; span?: number }) {
  return (
    <Box style={{ gridColumn: `span ${span}` }}>
      <Text size="xs" fw={500} c="#6B7280">{label}</Text>
      <Text size="sm" fw={600} mt={6}>{value?.trim() ? value : '—'}</Text>
    </Box>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={32} verticalSpacing={24}>{children}</SimpleGrid>;
}

export function Chips({ items, empty = 'None added yet' }: { items: string[]; empty?: string }) {
  if (!items.length) return <Text size="sm" c="dimmed">{empty}</Text>;
  return (
    <Group gap={8}>
      {items.map((t) => <Badge key={t} variant="outline" radius="xl" tt="none" fw={500} color="gray" bg="#EFF4FA" c={colors.dark}>{t}</Badge>)}
    </Group>
  );
}

export function ProfilePage() {
  const profile = useQuery({ queryKey: qk.profile, queryFn: api.users.myProfile });
  const [editing, setEditing] = useState(false);
  if (profile.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const p = profile.data;
  const e = p.education ?? {};

  return (
    <Stack gap={14}>
      <Title order={2} fz={20} fw={800}>{roleLabel(p.role)}</Title>
      <Paper p={28} radius="lg">
        <Group gap={16} wrap="nowrap">
          <Avatar size={72} radius="xl" src={p.avatar_url ?? undefined} styles={{ placeholder: { background: colors.sidebarActive } }}>
            <Text c="white" fw={700} fz={24}>{initials(p)}</Text>
          </Avatar>
          <div>
            <Text fw={700} size="lg" lineClamp={2}>{p.full_name}</Text>
            <Text size="sm" c="dimmed">{roleLabel(p.role)}</Text>
          </div>
        </Group>
      </Paper>

      <Paper p={28} radius="lg">
        <Group justify="space-between">
          <Text fw={700}>Personal Information</Text>
          <Button variant="default" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        </Group>
        <SectionHeader icon={<IconId size={16} />} title="Basic Information" />
        <InfoGrid>
          <Info label="First Name" value={p.first_name} />
          <Info label="Middle Name" value={p.middle_name} />
          <Info label="Last Name" value={p.last_name} />
          <Info label="Suffix" value={p.suffix} />
        </InfoGrid>
        <SectionHeader icon={<IconAddressBook size={16} />} title="Contact Information" />
        <InfoGrid>
          <Info label="Email Address" value={p.email} />
          <Info label="Phone Number" value={p.phone_number} />
          <Info label="Address" value={p.address} span={2} />
        </InfoGrid>
        <SectionHeader icon={<IconUsers size={16} />} title="Personal Details" />
        <InfoGrid>
          <Info label="Birthdate" value={longDate(p.birthdate)} />
          <Info label="Number of Children" value={String(p.number_of_children ?? 0)} />
          <Info label="Elderly or Infant Care at Home" value={flag(p.has_elderly_or_infant_care) ? 'Yes' : 'No'} />
          <Info label="Available Beyond Regular Hours" value={flag(p.overtime_opt_in) ? 'Yes, opted in' : 'No'} />
        </InfoGrid>
        <SectionHeader icon={<IconBriefcase size={16} />} title="Employment" />
        <InfoGrid>
          <Info label="Administrative Role" value={roleLabel(p.role)} />
          <Info label="Date of Appointment" value={longDate(p.date_of_appointment)} />
        </InfoGrid>
        <SectionHeader icon={<IconSchool size={16} />} title="Educational Background" />
        <InfoGrid>
          <Info label="Highest Educational Attainment" value={e.highest_attainment} span={2} />
          <Info label="Undergraduate Degree" value={e.undergraduate_degree} span={2} />
          <Info label="Area of Specialization" value={e.specialization} span={2} />
          <Info label="Postgraduate Program Focus" value={e.postgraduate_focus} span={2} />
        </InfoGrid>
        <SectionHeader icon={<IconAward size={16} />} title="Certifications & Eligibility" />
        <CertificatesPanel canUpload />
        <SectionHeader icon={<IconBrain size={16} />} title="Skills" />
        <Text size="xs" c="dimmed" mb={6}>Skills</Text>
        <Chips items={p.skills ?? []} />
      </Paper>

      {!!p.subjects?.length && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={14}>
          {p.subjects.map((s, i) => (
            <Paper key={i} p={16} radius="lg">
              <Text size="xs" c="dimmed">Subject-grade Assignment</Text>
              <Text fw={700} mt={4}>{s.subject}</Text>
              {s.grade_level && <Text size="sm" c="dimmed">{s.grade_level}</Text>}
            </Paper>
          ))}
        </SimpleGrid>
      )}
      {editing && <EditProfileModal profile={p} onClose={() => setEditing(false)} />}
    </Stack>
  );
}

function EditProfileModal({ profile: p, onClose }: { profile: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  const eduOptions = useQuery({ queryKey: qk.personnelMeta('education-options'), queryFn: api.personnel.educationOptions });
  const skillMeta = useQuery({ queryKey: qk.personnelMeta('skills'), queryFn: api.personnel.skills });
  const [f, setF] = useState({
    first_name: p.first_name ?? '', middle_name: p.middle_name ?? '', last_name: p.last_name ?? '', suffix: p.suffix ?? '',
    email: p.email ?? '', phone_number: p.phone_number ?? '', address: p.address ?? '',
    birthdate: p.birthdate ?? null as string | null, date_of_appointment: p.date_of_appointment ?? null as string | null,
    number_of_children: p.number_of_children ?? 0,
  });
  const [edu, setEdu] = useState({
    highest_attainment: p.education?.highest_attainment ?? null,
    undergraduate_degree: p.education?.undergraduate_degree ?? null,
    specialization: p.education?.specialization ?? null,
    postgraduate_focus: p.education?.postgraduate_focus ?? '',
  });
  const [hasCare, setHasCare] = useState(flag(p.has_elderly_or_infant_care));
  const [overtime, setOvertime] = useState(flag(p.overtime_opt_in));
  const [skills, setSkills] = useState<string[]>(p.skills ?? []);
  const [saving, setSaving] = useState(false);

  // Postgraduate focus applies from "With Master's Units" upward (options are ordered lowest first).
  const attainments = eduOptions.data?.highest_attainment ?? [];
  const hasPostgrad = attainments.indexOf(edu.highest_attainment ?? '') >= 1;
  const text = (k: keyof typeof f, label: string, name = false) => (
    <TextInput label={label} value={String(f[k] ?? '')}
      onChange={(e) => setF({ ...f, [k]: name ? titleCase(e.currentTarget.value) : e.currentTarget.value })} />
  );
  const eduSelect = (k: 'highest_attainment' | 'undergraduate_degree' | 'specialization', label: string) => (
    <Select label={label} clearable placeholder="— None —" value={edu[k]} onChange={(v) => setEdu({ ...edu, [k]: v })}
      data={eduOptions.data?.[k] ?? []} searchable />
  );

  const skillGroups = Object.entries((skillMeta.data ?? []).reduce<Record<string, string[]>>((acc, s) => {
    const g = s.category_name ?? 'Other';
    (acc[g] ??= []).push(s.skill_name);
    return acc;
  }, {})).map(([group, items]) => ({ group, items }));

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        number_of_children: Number(f.number_of_children) || 0,
        has_elderly_or_infant_care: hasCare,
        overtime_opt_in: overtime,
        skills, // always sent so entries can be cleared
        education: {
          highest_attainment: edu.highest_attainment ?? '',
          undergraduate_degree: edu.undergraduate_degree ?? '',
          specialization: edu.specialization ?? '',
          postgraduate_focus: hasPostgrad ? edu.postgraduate_focus.trim() : '',
        },
      };
      for (const k of ['first_name', 'middle_name', 'last_name', 'suffix', 'email', 'phone_number', 'address', 'birthdate', 'date_of_appointment'] as const) {
        const v = String(f[k] ?? '').trim();
        if (v) body[k] = v;
      }
      await api.users.updateMyProfile(body);
      await Promise.all([queryClient.invalidateQueries({ queryKey: qk.profile }), refresh()]);
      notifySuccess('Profile updated');
      onClose();
    } catch (e) {
      notifyError(e);
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} size={820} title={<Text fw={700} size="xl">Edit Profile</Text>}
      scrollAreaComponent={ScrollArea.Autosize}>
      <Text size="sm" c="#4B5563">Your education and skills are used to suggest you for matching tasks. Certifications are added by uploading the certificate on your profile.</Text>
      <SectionHeader dense icon={<IconId size={16} />} title="Basic Information" />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{text('first_name', 'First Name', true)}{text('middle_name', 'Middle Name', true)}{text('last_name', 'Last Name', true)}{text('suffix', 'Suffix', true)}</SimpleGrid>
      <SectionHeader dense icon={<IconAddressBook size={16} />} title="Contact Information" />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{text('email', 'Email')}{text('phone_number', 'Phone Number')}</SimpleGrid>
      <Box mt="sm">{text('address', 'Address')}</Box>
      <SectionHeader dense icon={<IconUsers size={16} />} title="Personal Details" />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DatePickerInput label="Birthdate" clearable valueFormat="MMMM D, YYYY" maxDate={new Date()} defaultLevel="decade"
          value={f.birthdate} onChange={(v) => setF({ ...f, birthdate: v })} />
        <NumberInput label="Number of Children" min={0} max={99} value={f.number_of_children}
          onChange={(v) => setF({ ...f, number_of_children: Number(v) || 0 })} />
      </SimpleGrid>
      <Stack mt="md" gap="sm">
        <Switch checked={hasCare} onChange={(e) => setHasCare(e.currentTarget.checked)}
          label="I care for an elderly family member or an infant at home"
          description="Avoids suggesting you for multi-day, weekend or late-evening tasks." />
        <Switch checked={overtime} onChange={(e) => setOvertime(e.currentTarget.checked)}
          label="I can take tasks beyond regular school hours"
          description="Lets the system suggest you for weekend, after-hours and extracurricular tasks even with family commitments." />
      </Stack>
      <SectionHeader dense icon={<IconBriefcase size={16} />} title="Employment" />
      <DatePickerInput label="Date of Appointment" clearable valueFormat="MMMM D, YYYY" maxDate={new Date()}
        value={f.date_of_appointment} onChange={(v) => setF({ ...f, date_of_appointment: v })} />
      <SectionHeader dense icon={<IconSchool size={16} />} title="Educational Background" />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {eduSelect('highest_attainment', 'Highest Educational Attainment')}
        {eduSelect('undergraduate_degree', 'Undergraduate Degree')}
        {eduSelect('specialization', 'Area of Specialization')}
        {hasPostgrad && <TextInput label="Postgraduate Program Focus" value={edu.postgraduate_focus}
          onChange={(e) => setEdu({ ...edu, postgraduate_focus: e.currentTarget.value })} />}
      </SimpleGrid>
      <SectionHeader dense icon={<IconBrain size={16} />} title="Skills" />
      <MultiSelect label="Skills" searchable clearable data={skillGroups} value={skills} onChange={setSkills} />
      <Divider my="lg" />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button color="ink.8" loading={saving} onClick={() => void save()}>Save</Button>
      </Group>
    </Modal>
  );
}
