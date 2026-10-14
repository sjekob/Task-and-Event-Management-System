import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Box, Button, Center, CloseButton, Collapse, Divider, Group, Loader, Menu, Modal, Paper,
  PasswordInput, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Title,
  Tooltip, UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconChevronDown, IconChevronUp, IconDots, IconLock, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, ASSIGNABLE_ACCOUNT_ROLES, COORDINATOR_TYPE_GROUPS, isActive, qk, roleLabel, useSession, useUser, type User,
} from '@tasknet/shared';
import { AuditHistory } from '../../components/AuditHistory';
import { CertificatesPanel } from '../../components/CertificatesPanel';
import { ErrorState, notifyError, notifySuccess, PageBanner } from '../../components/ui';

const ROW_BORDER = '#D0DCEB';
const TABLE_HEAD = '#C8D6E5';
const DEACT = '#9AA5B4';
const LINK = '#4A7FA5';
const PAGE = 30;

export function PersonnelPage() {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('delegation');
  const [search, setSearch] = useState('');
  const [query] = useDebouncedValue(search.trim(), 300);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const canWrite = can('manage_personnel');
  const canToggle = can('deactivate_personnel');

  const pages = useInfiniteQuery({
    queryKey: qk.personnel({ query }),
    queryFn: ({ pageParam }) => api.personnel.page({ search: query, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.items.length : undefined),
  });
  const people = pages.data?.pages.flatMap((p) => p.items) ?? [];
  const active = people.filter((u) => isActive(u));
  const inactive = people.filter((u) => !isActive(u));
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.allPersonnel });

  const toggle = (u: User) => {
    const action = isActive(u) ? 'deactivate' : 'reactivate';
    const Cap = action[0].toUpperCase() + action.slice(1);
    modals.openConfirmModal({
      title: `Confirm ${Cap}`,
      children: <Text size="sm">Are you sure you want to {action} {u.full_name}?</Text>,
      labels: { confirm: Cap, cancel: 'Cancel' },
      confirmProps: { color: isActive(u) ? 'red' : 'green' },
      onConfirm: async () => {
        try {
          await api.personnel.toggleStatus(u.id);
          await refresh();
          notifySuccess(`${u.full_name} has been ${isActive(u) ? 'deactivated' : 'reactivated'}.`);
        } catch (e) {
          notifyError(e);
        }
      },
    });
  };

  const table = (users: User[], deactivated: boolean) => (
    <UserTable users={users} tab={tab} deactivated={deactivated} canWrite={canWrite} canToggle={canToggle}
      onView={setViewing} onEdit={setEditing} onToggle={toggle} />
  );

  return (
    <Stack gap="md">
      <PageBanner title="User Manager" subtitle="Easily manage user profiles, roles, and permissions." />
      <SegmentedControl w="fit-content" value={tab} onChange={setTab} color="#6B7A92"
        data={[{ value: 'delegation', label: 'Academic Delegation' }, { value: 'personal', label: 'Personal Information' }]} />
      <Group wrap="nowrap">
        <TextInput style={{ flex: 1 }} size="md" placeholder="Search" leftSection={<IconSearch size={18} />}
          value={search} onChange={(e) => setSearch(e.currentTarget.value)} aria-label="Search personnel" />
        {canWrite && <Button size="md" color="#2D3748" leftSection={<IconPlus size={18} />} onClick={() => setAdding(true)}>Add User</Button>}
      </Group>
      {pages.isError ? <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
        : pages.isPending ? <Center p={40}><Loader /></Center> : (
          <>
            <Section title="Active Users" count={active.length} defaultOpen>{table(active, false)}</Section>
            {inactive.length > 0 && <Section title="Deactivated Accounts" count={inactive.length} deactivated>{table(inactive, true)}</Section>}
            {pages.hasNextPage && (
              <Center><Button variant="default" loading={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>Load more</Button></Center>
            )}
          </>
        )}
      {adding && <AddUserModal onClose={(added) => { setAdding(false); if (added) { void refresh(); notifySuccess('Personnel added.'); } }} />}
      {editing && <EditRoleModal user={editing} onClose={(saved) => { setEditing(null); if (saved) { void refresh(); notifySuccess('Personnel updated.'); } }} />}
      {viewing && <DetailModal user={viewing} onClose={() => setViewing(null)} onChanged={refresh} />}
    </Stack>
  );
}

function Section({ title, count, children, defaultOpen = false, deactivated = false }: {
  title: string; count: number; children: ReactNode; defaultOpen?: boolean; deactivated?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <UnstyledButton w="100%" onClick={() => setOpen(!open)} px={14} py={11} aria-expanded={open}
        style={{ background: deactivated ? '#E8ECF0' : TABLE_HEAD, borderRadius: 8, border: `1px solid ${ROW_BORDER}` }}>
        <Group justify="space-between">
          <Text fw={600} size="sm" c={deactivated ? DEACT : undefined}>{title} ({count})</Text>
          {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}><Box mt={12}>{children}</Box></Collapse>
    </div>
  );
}

function UserTable({ users, tab, deactivated, canWrite, canToggle, onView, onEdit, onToggle }: {
  users: User[]; tab: string; deactivated: boolean; canWrite: boolean; canToggle: boolean;
  onView: (u: User) => void; onEdit: (u: User) => void; onToggle: (u: User) => void;
}) {
  const me = useUser();
  if (!users.length) return null;
  const c = deactivated ? DEACT : undefined;
  const cell = (v?: string | number | null) => <Text size="sm" c={c} truncate maw={220}>{v == null || v === '' ? '—' : v}</Text>;
  const listCell = (items: string[] = []) => (
    <Tooltip label={items.join('\n') || '—'} multiline disabled={!items.length}><Text size="sm" c={c} truncate maw={200}>{items.length ? items.join(', ') : '—'}</Text></Tooltip>
  );
  const head = tab === 'delegation'
    ? ['Name', 'Username', 'Contact', 'Email', 'Subject', 'Grade Level', 'Role', 'Action']
    : ['Name', 'Birthdate', 'Specialization', 'Skills', 'Certifications', 'Children', 'Date Hired', 'Address', 'Action'];
  return (
    <Paper radius="lg" style={{ border: `1px solid ${ROW_BORDER}`, overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing={12} horizontalSpacing={16} highlightOnHover>
          <Table.Thead bg={TABLE_HEAD}><Table.Tr>{head.map((h) => <Table.Th key={h}>{h}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>
            {users.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td><UnstyledButton onClick={() => onView(u)}><Text size="sm" c={deactivated ? DEACT : LINK}>{u.full_name}</Text></UnstyledButton></Table.Td>
                {tab === 'delegation' ? (
                  <>
                    <Table.Td>{cell(u.username)}</Table.Td>
                    <Table.Td>{cell(u.phone_number)}</Table.Td>
                    <Table.Td>{cell(u.email)}</Table.Td>
                    <Table.Td>{cell(u.subjects?.[0]?.subject)}</Table.Td>
                    <Table.Td>{cell(u.grade_level)}</Table.Td>
                    <Table.Td>{cell(roleLabel(u.role))}</Table.Td>
                  </>
                ) : (
                  <>
                    <Table.Td>{cell(u.birthdate)}</Table.Td>
                    <Table.Td>{cell(u.education?.specialization)}</Table.Td>
                    <Table.Td>{listCell(u.skills)}</Table.Td>
                    <Table.Td>{listCell(u.certifications)}</Table.Td>
                    <Table.Td>{cell(u.number_of_children ?? 0)}</Table.Td>
                    <Table.Td>{cell(u.date_of_appointment)}</Table.Td>
                    <Table.Td>{cell(u.address)}</Table.Td>
                  </>
                )}
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target><ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${u.full_name}`}><IconDots size={20} /></ActionIcon></Menu.Target>
                    <Menu.Dropdown>
                      {canWrite && !deactivated && <Menu.Item onClick={() => onEdit(u)}>Edit</Menu.Item>}
                      <Menu.Item onClick={() => onView(u)}>View Details</Menu.Item>
                      {/* Nobody deactivates themselves; principal/admin accounts only by principal/admin. */}
                      {canToggle && me.id !== u.id && (canWrite || (u.role !== 'principal' && u.role !== 'admin')) && (
                        <Menu.Item c={deactivated ? '#4A6FA5' : 'red'} onClick={() => onToggle(u)}>{deactivated ? 'Reactivate' : 'Deactivate'}</Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Text size="xs" c="#9CA3AF">{label}</Text>
      <Text mt={4}>{value?.trim() ? value : '—'}</Text>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Box mt={24} mb={16}><Title order={4} fz={18}>{children}</Title><Divider mt={8} /></Box>;
}

function DetailModal({ user: u, onClose, onChanged }: { user: User; onClose: () => void; onChanged: () => void }) {
  const me = useUser();
  const { can } = useSession();
  const subjects = u.subjects?.length ? u.subjects.map((s) => (s.grade_level ? `${s.subject} (${s.grade_level})` : s.subject)).join(', ') : '—';
  const assignment = u.role === 'coordinator' ? u.coordinator_type || 'Coordinator'
    : u.role === 'dean' ? (u.dean_grade_level ? `Dean — ${u.dean_grade_level}` : 'Dean') : null;
  const groups = new Map<string, string[]>();
  for (const s of u.skill_details ?? []) groups.set(s.category ?? 'Other', [...(groups.get(s.category ?? 'Other') ?? []), s.name]);
  const keys = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  const e = u.education ?? {};
  return (
    <Modal opened onClose={onClose} size={700} padding={0} withCloseButton={false} scrollAreaComponent={ScrollArea.Autosize}>
      <Group justify="space-between" px={24} py={18} bg="#6B7A92">
        <Text c="white" fw={700} size="lg">User Details</Text>
        <CloseButton c="white" onClick={onClose} aria-label="Close" />
      </Group>
      <Box px={28} pb={20}>
        <SectionTitle>Basic Information</SectionTitle>
        <SimpleGrid cols={2} spacing={24} verticalSpacing={18}>
          <Field label="ID" value={String(u.id).padStart(3, '0')} />
          <Field label="Name" value={u.full_name} />
          <Field label="Username" value={u.username} />
          <Field label="Role" value={roleLabel(u.role)} />
          <div><Text size="xs" c="#9CA3AF">Status</Text><Text mt={4} fw={600} c={isActive(u) ? '#16A34A' : '#DC2626'}>{isActive(u) ? 'Active' : 'Inactive'}</Text></div>
        </SimpleGrid>
        <SectionTitle>Contact Information</SectionTitle>
        <SimpleGrid cols={2} spacing={24} verticalSpacing={18}>
          <Field label="Email" value={u.email} />
          <Field label="Contact Number" value={u.phone_number} />
        </SimpleGrid>
        <Box mt={18}><Field label="Address" value={u.address} /></Box>
        <SectionTitle>Academic Information</SectionTitle>
        <Stack gap={18}>
          {u.role === 'dean' && u.department && <Field label="Department" value={u.department} />}
          {assignment && <Field label="Assignment" value={assignment} />}
          <Field label="Subject-Grade Assignments" value={subjects} />
        </Stack>
        <SectionTitle>Personal Information</SectionTitle>
        <SimpleGrid cols={2} spacing={24} verticalSpacing={18}>
          <Field label="Birthdate" value={u.birthdate} />
          <Field label="Date Hired" value={u.date_of_appointment} />
          <Field label="Number of Children" value={String(u.number_of_children ?? 0)} />
        </SimpleGrid>
        <SectionTitle>Educational Background</SectionTitle>
        <SimpleGrid cols={2} spacing={24} verticalSpacing={18}>
          <Field label="Highest Educational Attainment" value={e.highest_attainment} />
          <Field label="Undergraduate Degree" value={e.undergraduate_degree} />
          <Field label="Area of Specialization" value={e.specialization} />
          <Field label="Postgraduate Program Focus" value={e.postgraduate_focus} />
        </SimpleGrid>
        <SectionTitle>Certifications & Eligibility</SectionTitle>
        {/* The principal/registrar reviews uploads here (never their own; enforced server-side). */}
        <CertificatesPanel userId={u.id} canReview={can('review_certificates') && me.id !== u.id} onChanged={onChanged} />
        <SectionTitle>Skills</SectionTitle>
        <Stack gap={18}>
          {keys.length ? keys.map((k) => <Field key={k} label={k} value={groups.get(k)!.join(', ')} />) : <Field label="None on file" value="—" />}
        </Stack>
        {can('view_audit') && (<><SectionTitle>Change History</SectionTitle><AuditHistory entityType="user" entityId={u.id} /></>)}
        <Button mt="lg" color="#6B7A92" onClick={onClose}>Close</Button>
      </Box>
    </Modal>
  );
}

function AddUserModal({ onClose }: { onClose: (added: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const ok = email.trim() && username.trim() && password.length >= 6;

  const submit = async () => {
    setSaving(true);
    try {
      const u = username.trim();
      await api.personnel.create({ email: email.trim(), username: u, password, first_name: u, last_name: '', role: 'teacher' });
      onClose(true);
    } catch (e) {
      notifyError(e);
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={() => onClose(false)} size={420} title={<Text fw={700} size="xl">Add New User</Text>}>
      <Stack>
        <TextInput label="Email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <TextInput label="Username" placeholder="Username" required value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
        <PasswordInput label="Password" placeholder="Password" required description="Min. 6 characters" value={password}
          error={password && password.length < 6 ? 'Min. 6 characters' : undefined} onChange={(e) => setPassword(e.currentTarget.value)} />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={() => onClose(false)}>Cancel</Button>
          <Button color="#2D3748" loading={saving} disabled={!ok} onClick={() => void submit()}>Create User</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface SubjectRow { gradeLevelId: string | null; subject: string | null }

function EditRoleModal({ user: u, onClose }: { user: User; onClose: (saved: boolean) => void }) {
  const gradeLevels = useQuery({ queryKey: qk.personnelMeta('grade-levels'), queryFn: api.personnel.gradeLevels });
  const subjectsMeta = useQuery({ queryKey: qk.personnelMeta('subjects'), queryFn: api.personnel.subjects });
  const [role, setRole] = useState<string>(u.role);
  const [deanGrade, setDeanGrade] = useState<string | null>(u.dean_grade_level_id ?? u.grade_level_id ? String(u.dean_grade_level_id ?? u.grade_level_id) : null);
  const [coordType, setCoordType] = useState<string | null>(u.coordinator_type ?? null);
  const [alsoTeaching, setAlsoTeaching] = useState(!!u.also_teaching);
  const [appointment, setAppointment] = useState<string | null>(u.date_of_appointment ?? null);
  const [rows, setRows] = useState<SubjectRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const levels = gradeLevels.data ?? [];
  // Seed the subject rows once grade levels are known (the API sends names).
  const subjectRows: SubjectRow[] = rows ?? (gradeLevels.data ? (u.subjects?.length ? u.subjects.map((s) => ({
    gradeLevelId: s.grade_level_id != null ? String(s.grade_level_id)
      : levels.find((g) => g.grade_level === s.grade_level)?.id != null ? String(levels.find((g) => g.grade_level === s.grade_level)!.id) : null,
    subject: s.subject,
  })) : [{ gradeLevelId: null, subject: null }]) : []);
  const setRow = (i: number, patch: Partial<SubjectRow>) => setRows(subjectRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const levelData = levels.map((g) => ({ value: String(g.id), label: g.grade_level }));
  const teachesToo = role === 'dean' || role === 'coordinator' || role === 'registrar';

  const submit = async () => {
    setSaving(true);
    try {
      await api.personnel.update(u.id, {
        role,
        ...(appointment ? { date_of_appointment: appointment } : {}),
        ...(role === 'dean' && deanGrade ? { dean_grade_level_id: Number(deanGrade) } : {}),
        ...(role === 'coordinator' && coordType ? { coordinator_type: coordType } : {}),
        ...(teachesToo ? { also_teaching: alsoTeaching } : {}),
      });
      await api.personnel.updateSubjects(u.id, subjectRows.filter((r) => r.subject)
        .map((r) => ({ grade_level_id: r.gradeLevelId ? Number(r.gradeLevelId) : null, subject: r.subject! })));
      onClose(true);
    } catch (e) {
      notifyError(e);
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={() => onClose(false)} size={560} title={<Group gap={8}><IconPencil size={20} /><Text fw={700}>Edit Role & Assignment</Text></Group>}>
      <Stack gap="sm">
        <Text size="sm" fw={700} c="#6B7A92">Role Assignment</Text>
        <SimpleGrid cols={2}>
          <Select label="Administrative Role" allowDeselect={false} value={role} onChange={(v) => v && setRole(v)}
            data={ASSIGNABLE_ACCOUNT_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))} />
          <DatePickerInput label="Date of Appointment" placeholder="Select a date" clearable maxDate={new Date()}
            valueFormat="MMM D, YYYY" value={appointment} onChange={setAppointment} />
        </SimpleGrid>
        {role === 'dean' && <Select label="Grade Level Handled" clearable placeholder="— None —" data={levelData} value={deanGrade} onChange={setDeanGrade} />}
        {role === 'coordinator' && (
          <Select label="Coordinator Type" placeholder="Select type" searchable value={coordType} onChange={setCoordType}
            data={Object.entries(COORDINATOR_TYPE_GROUPS).map(([group, items]) => ({ group, items }))} />
        )}
        {teachesToo && (
          <Paper withBorder p="sm" radius="md">
            <Switch checked={alsoTeaching} onChange={(e) => setAlsoTeaching(e.currentTarget.checked)} label="Also teaching personnel"
              description="Adds a Teacher identity to this account, selectable at login." labelPosition="left" styles={{ body: { justifyContent: 'space-between' } }} />
          </Paper>
        )}
        <Text size="sm" fw={700} c="#6B7A92" mt="md">Subject-Grade Assignment</Text>
        {!gradeLevels.data ? <Center><Loader size="sm" /></Center> : subjectRows.map((r, i) => (
          <Group key={i} wrap="nowrap" gap={8} align="flex-end">
            <Select label="Grade Level" clearable placeholder="— None —" style={{ flex: 2 }} data={levelData} value={r.gradeLevelId} onChange={(v) => setRow(i, { gradeLevelId: v })} />
            <Select label="Subject" placeholder="Select subject" style={{ flex: 3 }} searchable
              data={(subjectsMeta.data ?? []).map((s) => s.subject_name)} value={r.subject} onChange={(v) => setRow(i, { subject: v })} />
            <CloseButton mb={6} disabled={subjectRows.length <= 1} aria-label="Remove subject" onClick={() => setRows(subjectRows.filter((_, j) => j !== i))} />
          </Group>
        ))}
        <Button variant="subtle" w="fit-content" size="compact-sm" leftSection={<IconPlus size={16} />}
          onClick={() => setRows([...subjectRows, { gradeLevelId: null, subject: null }])}>Add Subject</Button>
        <Group wrap="nowrap" align="flex-start" gap={8} p={12} mt="md" style={{ background: '#F1F5F9', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <IconLock size={16} color="#6B7280" />
          <Text size="xs" c="dimmed">Personal information — education, skills, certifications and family details — can only be edited by {u.full_name} in their own profile.</Text>
        </Group>
        <SimpleGrid cols={2} mt="md">
          <Button variant="outline" color="#2D3748" onClick={() => onClose(false)}>Cancel</Button>
          <Button color="#2D3748" loading={saving} onClick={() => void submit()}>Save Changes</Button>
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}
