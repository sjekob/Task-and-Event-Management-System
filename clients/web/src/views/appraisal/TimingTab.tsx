import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, RefreshCw, SlidersHorizontal, Timer, TrendingUp } from 'lucide-react';
import { AppraisalController, TimingMode, TimingPoints } from '@shared/controllers/AppraisalControllers';
import { IconButton } from '../../ui/kit';
import { ErrorPanel, FilterDropdown, Mini, Stat, TONE, TabSkeleton } from './common';

// Timing Points tab: report-submission compliance (scored server-side).
export function TimingTab({ c }: { c: AppraisalController }) {
  const s = c.state.submissions;
  const [mode, setMode] = useState<TimingMode>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadSubmissions()} />;
  const filtered = TimingPoints.filter(s.items, mode, selected);
  const sum = TimingPoints.summary(filtered);
  const groups = TimingPoints.groups(filtered, mode === 'task');
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div className="col gap-20" style={{ gap: 20 }}>
      <div className="grid-3">
        <Stat value={String(sum.total)} label="Total Reports Submitted" sub="Across all tracked tasks" icon={<ClipboardCheck size={22} />} color="#3b82f6" bg="#eff6ff" />
        <Stat value={`${sum.points} pts`} label="Total Timing Points" sub="Earned from all submissions" icon={<Timer size={22} />} color="#10b981" bg="#ecfdf5" />
        <Stat value={`${sum.compliance.toFixed(1)}%`} label="Compliance Rate" sub="On-Time submissions" icon={<TrendingUp size={22} />} color="#8b5cf6" bg="#f5f3ff" valueColor={TONE[TimingPoints.complianceTone(sum.compliance)]} />
      </div>
      <div className="ap-card" style={{ padding: 0 }}>
        <div className="row wrap gap-8" style={{ padding: '16px 20px 14px' }}>
          <span className="grow" style={{ fontSize: 15, fontWeight: 700 }}>Teacher Submissions &amp; Compliance</span>
          <label className="ap-filter">
            <SlidersHorizontal size={14} />
            <select value={mode} onChange={(e) => { setMode(e.target.value as TimingMode); setSelected(null); }}>
              <option value="all">Show All</option><option value="personnel">By Personnel</option><option value="task">By Task</option>
            </select>
            <ChevronDown size={15} />
          </label>
          {mode !== 'all' && <FilterDropdown label={mode === 'task' ? 'All Tasks' : 'All Personnel'} options={TimingPoints.options(s.items, mode)} selected={selected} onSelect={setSelected} />}
          <IconButton title="Refresh" onClick={() => void c.loadSubmissions()}><RefreshCw size={18} /></IconButton>
        </div>
        <hr className="divider" style={{ margin: 0 }} />
        {!groups.length ? <div className="empty">No report submissions yet.</div> : groups.map((g) => {
          const isOpen = open.has(g.key);
          const tone = TONE[TimingPoints.complianceTone(g.pct)];
          return (
            <div key={g.key} style={{ borderBottom: '1px solid var(--border)' }}>
              <button className="ap-group" onClick={() => toggle(g.key)}>
                <span className="avatar" style={{ width: 32, height: 32, background: '#eff6ff', color: '#3b82f6', fontSize: 13 }}>{g.key.charAt(0).toUpperCase() || '?'}</span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{g.key}</span>
                  {mode !== 'task' && g.dept && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{g.dept}</span>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Subs: {g.subs.length}</span>
                <span className="ap-chip" style={{ color: tone, background: `${tone}1f` }}>{g.pct.toFixed(0)}% Compliant</span>
                {isOpen ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
              </button>
              {isOpen && (
                <div style={{ background: '#fafbfc', padding: '16px 20px 20px' }}>
                  <div className="grid-3" style={{ gap: 12 }}>
                    <Mini label="Total Submissions" value={String(g.subs.length)} icon={<ClipboardList size={16} />} />
                    <Mini label="Avg Timing Points" value={`${g.avgPts.toFixed(1)} / 100`} icon={<Timer size={16} />} />
                    <Mini label="Compliance Rate" value={`${g.pct.toFixed(1)}%`} icon={<TrendingUp size={16} />} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 8px' }}>Submission History</div>
                  <div className="table-wrap">
                    <table className="table ap-table">
                      <thead><tr><th>TASK NAME</th><th>DEADLINE</th><th>SUBMITTED AT</th><th>TIMING STATUS</th><th style={{ textAlign: 'center' }}>POINTS</th><th>RUBRIC SCORES</th></tr></thead>
                      <tbody>
                        {g.subs.map((x, i) => {
                          const col = TONE[TimingPoints.statusTone(x.timing_status)];
                          const rubric = x.content_quality_score != null || x.format_compliance_score != null || x.completeness_score != null;
                          return (
                            <tr key={i}>
                              <td>{String(x.task_name ?? '—')}</td>
                              <td className="muted">{TimingPoints.fmt(x.deadline)}</td>
                              <td className="muted">{TimingPoints.fmt(x.submitted_at)}</td>
                              <td><span className="ap-chip" style={{ color: col, background: `${col}1f`, borderRadius: 6 }}>{String(x.timing_status ?? '—')}</span></td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: col }}>{TimingPoints.points(x)} pts</td>
                              <td style={{ fontSize: 10, color: 'var(--muted)' }}>{rubric ? <>Content: {x.content_quality_score ?? '—'}<br />Format: {x.format_compliance_score ?? '—'}<br />Completeness: {x.completeness_score ?? '—'}</> : <i style={{ color: 'var(--light)' }}>Not scored</i>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
