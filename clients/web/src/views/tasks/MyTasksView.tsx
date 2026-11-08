import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardList, Search } from 'lucide-react';
import { MyTasksController, StatusFilter } from '@shared/controllers/MyTasksController';
import { TaskCategory } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useInfiniteScroll, useScreenController } from '../../app/hooks';
import { Banner, Bone, Button, Empty, ErrorBox, Spinner } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';
import './tasks.css';

export default function MyTasksView({ category }: { category: TaskCategory }) {
  const services = useServices();
  const navigate = useNavigate();
  const [c, s] = useScreenController(() => new MyTasksController(services, category), [category]);
  useEffect(() => { void c.load(); }, [c]);
  const sentinel = useInfiniteScroll(() => void c.loadMore(), !s.loading && s.hasMore && !s.search);
  const base = category === 'special' ? '/my-special-tasks' : '/my-tasks';
  const tasks = c.filtered;

  return (
    <div className="col gap-16">
      <Banner title={c.title} subtitle={c.subtitle} />
      <div className="search-box">
        <Search size={16} color="var(--light)" />
        <input placeholder="Search tasks..." value={s.search} onChange={(e) => c.setSearch(e.target.value)} />
      </div>
      <div className="row wrap gap-8">
        {(['all', 'pending', 'submitted'] as StatusFilter[]).map((f) => (
          <button key={f} className={`scope-tab ${s.status === f ? 'on' : ''}`} style={{ borderRadius: 20, padding: '8px 16px', fontSize: 12 }}
            onClick={() => c.setStatus(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
        <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
      </div>
      {s.error && <ErrorBox message={s.error} onRetry={() => void c.load()} />}
      {s.loading ? (
        <div className="col gap-8">{[0, 1, 2, 3].map((i) => <Bone key={i} h={84} r={12} />)}</div>
      ) : tasks.length === 0 ? (
        <Empty icon={<ClipboardList size={48} />} title={c.emptyText} />
      ) : (
        <div>
          {tasks.map((t) => {
            const overdue = t.isOverdue;
            const due = MyTasksController.dueText(t);
            return (
              <div key={t.id} className="card clickable pad-16 row-top gap-16" style={{ marginBottom: 10, border: overdue ? '1.5px solid rgba(239,68,68,0.35)' : undefined }}
                onClick={() => navigate(`${base}/${t.id}`)}>
                <span className="att-icon" style={{ width: 42, height: 42, borderRadius: 10, background: t.isSubmitted ? 'var(--green-bg)' : 'var(--blue-bg)', color: t.isSubmitted ? 'var(--green)' : 'var(--accent)' }}>
                  {t.isSubmitted ? <CheckCircle2 size={22} /> : <ClipboardList size={22} />}
                </span>
                <div className="grow">
                  <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{t.title}</div>
                  {t.subject && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', marginTop: 4 }}>{t.subject}</div>}
                  {due && (
                    <div className="row gap-4 mt-4" style={{ fontSize: 11, fontWeight: 500, color: overdue ? 'var(--red)' : 'var(--light)' }}>
                      <CalendarDays size={11} />{due}
                      {overdue && <span className="badge red" style={{ borderRadius: 4, padding: '2px 6px', fontSize: 10, marginLeft: 4 }}>Overdue</span>}
                    </div>
                  )}
                  {t.instructions && <div className="body-md mt-4">{MyTasksController.preview(t)}</div>}
                </div>
                {t.isSubmitted ? <span className="badge green">Submitted</span> : <span className="badge blue">Pending</span>}
              </div>
            );
          })}
          {s.hasMore && !s.search && (
            <div ref={sentinel} className="center-fill" style={{ padding: 16 }}>
              {s.loadingMore ? <Spinner /> : <Button variant="outline-muted" onClick={() => void c.loadMore()}>Load more</Button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
