import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Ban, CalendarRange, ClipboardList, Flag, Pencil, RefreshCw, Search } from 'lucide-react';
import { CalendarScanController } from '@shared/controllers/CalendarScanController';
import { TaskListController } from '@shared/controllers/TaskListController';
import { SchoolYearFilter, Task, TaskCategory } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Banner, Bone, Button, Empty } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';
import { DepedTaskDialog } from '../deped/DepedDialogs';
import { CalendarScanButton } from './CalendarScan';
import './tasks.css';

const DOT = { gray: 'var(--light)', green: 'var(--green)', red: 'var(--red)', blue: 'var(--accent)' };

export default function TaskManagerView({ category, advisory = false }: { category: TaskCategory; advisory?: boolean }) {
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new TaskListController(services, category, user, advisory), [category, user?.id, advisory]);
  useEffect(() => { void c.load(); }, [c]);

  const base = c.base;
  const disable = async (t: Task) => {
    if (!(await fb.confirm({ title: 'Confirm Disable', message: 'Are you sure you want to disable the task?', confirmLabel: 'Yes', cancelLabel: 'No' }))) return;
    try { await c.setEnabled(t.id, false); fb.toast('Task disabled'); } catch (e) { fb.error(e); }
  };
  const enable = async (t: Task) => {
    try { await c.setEnabled(t.id, true); fb.toast('Task enabled'); } catch (e) { fb.error(e); }
  };

  const active = c.active;
  const disabled = c.disabled;
  const [depedOpen, setDepedOpen] = useState(false);
  const canDeped = !advisory && category === 'common' && (user?.can('manage_deped_calendar') ?? false);
  const canScan = !advisory && category === 'common';
  const [calendar] = useScreenController(() => new CalendarScanController(services, user), [user?.id]);

  return (
    <div className="col gap-16">
      <Banner title={c.title} subtitle={c.subtitle} />
      <div className="row wrap gap-8">
        {c.canViewAll && (
          <>
            <button className={`scope-tab ${s.scope === 'mine' ? 'on' : ''}`} onClick={() => c.setScope('mine')}>My Created Tasks</button>
            <button className={`scope-tab ${s.scope === 'all' ? 'on' : ''}`} onClick={() => c.setScope('all')}>All Tasks</button>
          </>
        )}
        <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
        {(canDeped || (canScan && calendar.canScan)) && <span style={{ marginLeft: 'auto' }} />}
        {canScan && calendar.canScan && <CalendarScanButton c={calendar} onPosted={() => void c.load()} />}
        {canDeped && <Button variant="ghost" size="sm" icon={<CalendarRange size={16} />} onClick={() => setDepedOpen(true)}>From DepEd calendar</Button>}
      </div>
      {depedOpen && <DepedTaskDialog onClose={() => { setDepedOpen(false); void c.load(); }} />}
      <div className="search-box">
        <Search size={18} color="var(--light)" />
        <input placeholder="Search tasks by title..." value={s.search} onChange={(e) => c.setSearch(e.target.value)} />
      </div>

      {s.error && (
        <div className="alert red" style={{ flexDirection: 'column' }}>
          <div className="row strong"><AlertCircle size={18} />Failed to load tasks</div>
          <div className="text-2">{s.error}</div>
          <Button variant="danger" size="sm" icon={<RefreshCw size={14} />} onClick={() => void c.load()}>Retry</Button>
        </div>
      )}

      {s.loading ? (
        <div className="col gap-8">{[0, 1, 2, 3].map((i) => <Bone key={i} h={78} r={12} />)}</div>
      ) : !s.error && active.length === 0 && disabled.length === 0 ? (
        <Empty icon={<ClipboardList size={48} />} title={s.search ? `No tasks match "${s.search}"` : advisory ? 'No class tasks yet' : 'No tasks in this school year'}>
          {advisory && !s.search && 'When the principal or registrar posts the school calendar, the tasks your subject teachers submit to you appear here. '}
          {!s.search && s.filter.equals(SchoolYearFilter.current) && 'Tasks from earlier school years are archived. Choose a year in the selector above to see them.'}
        </Empty>
      ) : (
        <div>
          {active.length > 0 && <SectionLabel text={category === 'special' ? 'Active special tasks' : 'Active tasks'} count={active.length} />}
          {active.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={() => navigate(`${base}/${t.id}`)}
              menu={t.canEdit ? (
                <ActionMenu items={[
                  { label: 'Edit task', icon: <Pencil size={16} />, onClick: () => navigate(`${base}/${t.id}/edit`) },
                  { label: 'Disable task', icon: <Ban size={16} />, danger: true, onClick: () => void disable(t) },
                ]} />
              ) : null} />
          ))}
          {disabled.length > 0 && (
            <div className="mt-16">
              <SectionLabel text="Disabled" count={disabled.length} />
              {disabled.map((t) => (
                <TaskRow key={t.id} task={t} onOpen={() => navigate(`${base}/${t.id}`)}
                  menu={t.canEdit ? <Button variant="ghost" size="sm" style={{ color: '#16a34a' }} onClick={(e) => { e.stopPropagation(); void enable(t); }}>Enable</Button> : null} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <div className="row gap-8" style={{ margin: '4px 0 10px' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{text}</span>
      <span className="count-pill">{count}</span>
    </div>
  );
}

function TaskRow({ task, onOpen, menu }: { task: Task; onOpen: () => void; menu: React.ReactNode }) {
  const r = TaskListController.rowInfo(task);
  const dot = DOT[r.dot];
  return (
    <div className={`task-row ${r.disabled ? 'disabled' : ''}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="dot" style={{ background: dot, boxShadow: `0 0 0 3px color-mix(in srgb, ${dot} 25%, transparent)` }} />
      <div className="task-row-main">
        <div className="task-row-info">
          <div className="clamp-2" title={task.title} style={{ fontSize: 15.5, fontWeight: 700, overflowWrap: 'anywhere', color: r.disabled ? 'var(--muted)' : 'var(--text)' }}>{task.title}</div>
          <div className="row wrap gap-8 mt-4">
            <span className="row gap-4" style={{ fontSize: 12.5, color: r.overdue ? 'var(--red)' : 'var(--muted)', fontWeight: r.overdue ? 600 : 500 }}>
              <Flag size={14} color={r.overdue ? 'var(--red)' : 'var(--light)'} />{r.due}
            </span>
            {r.overdue && <span className="badge red">Overdue</span>}
            {r.complete && !r.disabled && <span className="badge green">All submitted</span>}
            {r.disabled && <span className="badge gray">Disabled</span>}
          </div>
          {r.instructions && <div className="body-md ellipsis mt-4">{r.instructions}</div>}
        </div>
        {r.total === 0 ? <span className="badge gray">Not assigned</span> : (
          <div className="task-row-progress">
            <span style={{ fontSize: 12.5, fontWeight: 600, color: r.complete ? '#16a34a' : 'var(--muted)' }}>{r.done} of {r.total} submitted</span>
            <div className="progress" style={{ background: 'var(--tint)', width: '100%' }}>
              <div style={{ width: `${(r.done / r.total) * 100}%`, background: r.complete ? 'var(--green)' : 'var(--accent)' }} />
            </div>
          </div>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ minWidth: 8 }}>{menu}</div>
    </div>
  );
}
