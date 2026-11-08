import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PersonnelController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Avatar, Badge, Banner, Bone, Button, C, Card, Icon, IconButton, MenuItem, Row, Screen, SearchBox, Spinner, T, Tabs } from '../../ui/kit';
import { PersonnelDetail } from './PersonnelDetail';
import { AddUserDialog, EditRoleDialog } from './PersonnelDialogs';
import { SectionsDialog } from './SectionsDialog';

/** /personnel: the user manager (delegation and personal information views). */
export default function PersonnelScreen() {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new PersonnelController(services, user), [user?.id]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [sections, setSections] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  useEffect(() => { c.start(); }, [c]);
  useEffect(() => {
    if (search === s.search) return;
    const t = setTimeout(() => c.search(search), 300);
    return () => clearTimeout(t);
  }, [search, s.search, c]);

  const toggle = async (u: User) => {
    const action = u.isActive ? 'Deactivate' : 'Reactivate';
    if (!await fb.confirm({ title: `Confirm ${action}`, message: `Are you sure you want to ${action.toLowerCase()} ${u.fullName}?`, confirmLabel: action, danger: u.isActive })) return;
    try { await c.toggleStatus(u); fb.toast(`${u.fullName} has been ${u.isActive ? 'deactivated' : 'reactivated'}.`); } catch (e) { fb.error(e); }
  };
  const menu = (u: User, deactivated: boolean): MenuItem[] => [
    ...(c.canWrite && !deactivated ? [{ label: 'Edit', icon: 'edit-2' as const, onPress: () => setEditing(u) }] : []),
    { label: 'View Details', icon: 'eye', onPress: () => setViewing(u) },
    ...(c.canToggleUser(u) ? [{ label: deactivated ? 'Reactivate' : 'Deactivate', icon: (deactivated ? 'user-check' : 'user-x') as 'user-x', danger: !deactivated, onPress: () => void toggle(u) }] : []),
  ];
  const row = (u: User, deactivated: boolean) => (
    <Card key={u.id} onPress={() => setViewing(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, opacity: deactivated ? 0.65 : 1 }}>
      <Avatar url={u.avatarUrl} initials={u.initials} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6}><T weight={700} lines={1} style={{ flexShrink: 1 }}>{u.fullName}</T><Badge>{u.roleLabel}</Badge></Row>
        {s.tab === 0 ? (
          <>
            <T size={12} color={C.muted} lines={1}>{PersonnelController.subjects(u)} · {PersonnelController.grades(u)}</T>
            <T size={12} color={C.muted} lines={1}>{[u.username, u.email, u.phoneNumber].filter(Boolean).join(' · ')}</T>
          </>
        ) : (
          <>
            <T size={12} color={C.muted} lines={1}>{u.education.specialization ?? 'No specialization'}</T>
            <T size={12} color={C.muted} lines={1}>Skills: {u.skills.length ? u.skills.join(', ') : '—'}</T>
          </>
        )}
      </View>
      <ActionMenu items={menu(u, deactivated)} />
    </Card>
  );

  return (
    <Screen onRefresh={() => c.load(true)}>
      <Banner title="User Manager" subtitle="Easily manage user profiles, roles, and permissions." />
      <Tabs value={s.tab} onChange={(t) => c.setTab(t)} tabs={[{ value: 0 as const, label: 'Academic Delegation' }, { value: 1 as const, label: 'Personal Information' }]} />
      <Row>
        <View style={{ flex: 1 }}><SearchBox value={search} onChange={setSearch} placeholder="Search" /></View>
        {c.canWrite && <IconButton name="grid" label="Sections" onPress={() => setSections(true)} />}
        {c.canWrite && <Button icon="plus" onPress={() => setAdding(true)}>Add</Button>}
      </Row>
      {s.loading ? [0, 1, 2, 3].map((i) => <Bone key={i} h={64} r={14} />) : (
        <>
          <T size={13} weight={700} color={C.text2}>Active Users ({c.active.length})</T>
          {c.active.map((u) => row(u, false))}
          {c.inactive.length > 0 && (
            <Pressable onPress={() => setShowInactive((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T size={13} weight={700} color={C.redDark}>Deactivated Accounts ({c.inactive.length})</T>
              <Icon name={showInactive ? 'chevron-up' : 'chevron-down'} size={16} color={C.redDark} />
            </Pressable>
          )}
          {showInactive && c.inactive.map((u) => row(u, true))}
          {s.hasMore && <View style={{ alignItems: 'center' }}>{s.loadingMore ? <Spinner /> : <Button variant="outline-muted" onPress={() => void c.loadMore()}>Load more</Button>}</View>}
        </>
      )}
      {sections && <SectionsDialog onClose={() => { setSections(false); void c.load(true); }} />}
      {adding && <AddUserDialog onClose={(ok) => { setAdding(false); if (ok) { void c.load(true); fb.toast('Personnel added.', 'success'); } }} />}
      {editing && <EditRoleDialog user={editing} onClose={(ok) => { setEditing(null); if (ok) { void c.load(true); fb.toast('Personnel updated.', 'success'); } }} />}
      {viewing && <PersonnelDetail c={c} user={viewing} onClose={() => setViewing(null)} />}
    </Screen>
  );
}
