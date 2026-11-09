import { useEffect, useState } from 'react';
import { Pencil, Plus, School, Search } from 'lucide-react';
import { PersonnelController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useInfiniteScroll, useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Bone, Button, Spinner } from '../../ui/kit';
import './personnel.css';
import { PersonnelDetail } from './PersonnelDetail';
import { AddUserDialog, EditRoleDialog } from './PersonnelDialogs';
import { SectionsDialog } from './SectionsDialog';
import { Collapsible, UserTable } from './PersonnelTable';

export default function PersonnelView() {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new PersonnelController(services, user), [user?.id]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [sections, setSections] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  useEffect(() => { c.start(); }, [c]);
  useEffect(() => {
    if (search === s.search) return;
    const t = setTimeout(() => c.search(search), 300);
    return () => clearTimeout(t);
  }, [search, s.search, c]);
  const sentinel = useInfiniteScroll(() => void c.loadMore(), !s.loading && s.hasMore);

  const toggle = async (u: User) => {
    const action = u.isActive ? 'Deactivate' : 'Reactivate';
    const ok = await fb.confirm({ title: `Confirm ${action}`, message: `Are you sure you want to ${action.toLowerCase()} ${u.fullName}?`, confirmLabel: action, danger: u.isActive });
    if (!ok) return;
    try {
      await c.toggleStatus(u);
      fb.toast(`${u.fullName} has been ${u.isActive ? 'deactivated' : 'reactivated'}.`);
    } catch (e) { fb.error(e); }
  };

  const table = (users: User[], deactivated: boolean) => (
    <UserTable users={users} tab={s.tab} deactivated={deactivated} actions={(u) => [
      { label: 'Edit', icon: <Pencil size={15} />, onClick: () => setEditing(u), hidden: !c.canWrite || deactivated },
      { label: 'View Details', onClick: () => setViewing(u) },
      { label: deactivated ? 'Reactivate' : 'Deactivate', onClick: () => void toggle(u), danger: !deactivated, hidden: !c.canToggleUser(u) },
    ]} onView={setViewing} />
  );

  return (
    <div className="col gap-16">
      <div className="pm-hero">
        <h1>User Manager</h1>
        <div>Easily manage user profiles, roles, and permissions.</div>
      </div>
      <div className="row gap-8">
        <button className={`pm-tab ${s.tab === 0 ? 'on' : ''}`} onClick={() => c.setTab(0)}>Academic Delegation</button>
        <button className={`pm-tab ${s.tab === 1 ? 'on' : ''}`} onClick={() => c.setTab(1)}>Personal Information</button>
      </div>
      <div className="row gap-12">
        <div className="input-icon grow"><Search size={18} /><input className="input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {c.canWrite && <Button variant="outline-muted" icon={<School size={18} />} style={{ height: 44 }} onClick={() => setSections(true)}>Sections</Button>}
        {c.canWrite && <Button icon={<Plus size={18} />} style={{ height: 44, background: 'var(--dark)' }} onClick={() => setAdding(true)}>Add User</Button>}
      </div>
      {s.loading ? (
        <div className="col gap-8"><Bone h={44} />{[0, 1, 2, 3, 4, 5].map((i) => <Bone key={i} h={52} />)}</div>
      ) : (
        <>
          <Collapsible title="Active Users" count={c.active.length} initiallyOpen>{table(c.active, false)}</Collapsible>
          {c.inactive.length > 0 && <Collapsible title="Deactivated Accounts" count={c.inactive.length} deactivated>{table(c.inactive, true)}</Collapsible>}
          {s.hasMore && (
            <div ref={sentinel} className="center-fill" style={{ padding: 16 }}>
              {s.loadingMore ? <Spinner /> : <Button variant="outline-muted" onClick={() => void c.loadMore()}>Load more</Button>}
            </div>
          )}
        </>
      )}
      {sections && <SectionsDialog onClose={() => { setSections(false); void c.load(true); }} />}
      {adding && <AddUserDialog onClose={(ok) => { setAdding(false); if (ok) { void c.load(true); fb.toast('Personnel added.'); } }} />}
      {editing && <EditRoleDialog user={editing} onClose={(ok) => { setEditing(null); if (ok) { void c.load(true); fb.toast('Personnel updated.'); } }} />}
      {viewing && <PersonnelDetail c={c} user={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
