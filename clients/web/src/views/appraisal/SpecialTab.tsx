import { useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, Download, FileText, Filter, Trophy, User as UserIcon, Users } from 'lucide-react';
import { AppraisalController, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { SpecialTask } from '@shared/models';
import { useFeedback } from '../../ui/feedback';
import { printPerformanceSummary } from '../../app/printProposal';
import { Button } from '../../ui/kit';
import { EvaluateSpecialTaskDialog, ViewSpecialTaskDialog } from './SpecialTaskDialogs';
import { Chip, ErrorPanel, FilterDropdown, Stat, TONE, TabSkeleton } from './common';

// Special Tasks tab: rubric ratings of special tasks.
export function SpecialTab({ c }: { c: AppraisalController }) {
  const s = c.state.tasks;
  const fb = useFeedback();
  const [dept, setDept] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<SpecialTask | null>(null);
  const [viewing, setViewing] = useState<SpecialTask | null>(null);
  const [exporting, setExporting] = useState(false);
  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadTasks()} />;
  const cards = SpecialTaskStats.cards(s.items);
  const rows = SpecialTaskStats.filter(s.items, dept, role, person);
  return (
    <div className="col gap-16">
      <div className="grid-4">
        <Stat value={String(cards.evaluated)} label="Total Faculty Evaluated" icon={<CheckCircle2 size={22} />} color="#22c55e" bg="#dcfce7" />
        <Stat value={String(cards.flagged)} label="Flagged Personnel" icon={<AlertCircle size={22} />} color="#ef4444" bg="#fee2e2" />
        <Stat value={String(cards.departments)} label="Departments Monitored" icon={<Users size={22} />} color="#8b5cf6" bg="#ede9fe" />
        <Stat value={cards.avg > 0 ? cards.avg.toFixed(0) : '—'} label="School Avg Compliance / 100" icon={<Trophy size={22} />} color="#9ca3af" bg="#f3f4f6" />
      </div>
      <div className="ap-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Appraisal Coverage — All Evaluation Types</div>
        <div className="grid-4" style={{ gap: 12 }}>
          {[
            [<FileText size={18} />, '#3b82f6', '#eff6ff', 'Special Task Timing', 'Task completion and timeline'],
            [<CalendarDays size={18} />, '#10b981', '#ecfdf5', 'Event Evaluation', 'Multi-stakeholder'],
            [<ClipboardList size={18} />, '#8b5cf6', '#ede9fe', 'Special Task Ratings', 'IPCRF Q / E / T (1-5)'],
            [<AlertCircle size={18} />, '#ef4444', '#fee2e2', 'Escalation Threshold', 'Below 3 stars auto-flags'],
          ].map(([icon, color, bg, title, sub]) => (
            <div key={String(title)} className="row gap-10">
              <span className="att-icon" style={{ width: 34, height: 34, background: bg as string, color: color as string }}>{icon}</span>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="ap-card" style={{ padding: 0 }}>
        <div className="row wrap gap-8" style={{ padding: '16px 20px 14px' }}>
          <span className="grow" style={{ fontSize: 15, fontWeight: 700 }}>Dean Special Task Submissions</span>
          <FilterDropdown icon={<Filter size={14} />} label="By Department" options={SpecialTaskStats.options(s.items, 'assigneeDepartment')} selected={dept} onSelect={setDept} />
          <FilterDropdown icon={<Filter size={14} />} label="By Role" options={SpecialTaskStats.options(s.items, 'assigneeRole')} selected={role} onSelect={setRole} />
          <FilterDropdown label="Select personnel..." options={SpecialTaskStats.options(s.items, 'assigneeName')} selected={person} onSelect={setPerson} />
        </div>
        <div className="table-wrap">
          <table className="table ap-table">
            <thead><tr><th>ID</th><th>PERSONNEL</th><th>DEPARTMENT</th><th>TASK</th><th>ASSIGNED BY</th><th>DUE DATE</th><th>SUBMITTED</th><th style={{ textAlign: 'center' }}>SCORE</th><th>STATUS</th><th style={{ textAlign: 'right' }}>ACTION</th></tr></thead>
            <tbody>
              {rows.map((t) => {
                const done = t.status === 'evaluated' || t.status === 'flagged';
                const tone = TONE[SpecialTaskStats.scoreTone(t.scoreOutOf100, t.status === 'flagged')];
                return (
                  <tr key={SpecialTaskStats.code(t)}>
                    <td className="muted">{SpecialTaskStats.code(t)}</td>
                    <td><span className="row gap-8"><span className="avatar" style={{ width: 28, height: 28, background: 'var(--border)', color: 'var(--muted)' }}><UserIcon size={14} /></span><b style={{ fontWeight: 600 }}>{t.assigneeName ?? '—'}</b></span></td>
                    <td className="muted">{t.assigneeDepartment ?? '—'}</td>
                    <td>
                      <span className="ellipsis" style={{ display: 'block', maxWidth: 240 }}>{t.title}</span>
                      {t.isAutoCredit && <span className="caption" style={{ color: 'var(--green)' }}>Top score: committee task not automated</span>}
                    </td>
                    <td className="muted">{t.assignerName ?? '—'}</td>
                    <td className="muted">{SpecialTaskStats.fmtDate(t.dueDate)}</td>
                    <td style={{ color: done ? '#22c55e' : 'var(--muted)' }}>{done ? SpecialTaskStats.fmtDate(t.submittedDate) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{done ? <span className="ap-chip" style={{ color: tone, background: `${tone}1f`, borderRadius: 6 }}>{t.scoreOutOf100}/100</span> : '—'}</td>
                    <td><Chip status={t.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {done ? <Button size="sm" variant="outline-muted" onClick={() => setViewing(t)}>View</Button>
                        : <Button size="sm" onClick={() => setEvaluating(t)}>Evaluate</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="row wrap gap-16" style={{ padding: 20, borderRadius: 12, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
        <div className="grow">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-dark)' }}>Annual Faculty Performance Summary</div>
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance Evaluation.</div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
          <Button icon={<Download size={16} />} loading={exporting} onClick={async () => {
            setExporting(true);
            try {
              if (!await printPerformanceSummary(() => c.performanceSummary())) fb.toast('Allow pop-ups for this site to export the summary.', 'error');
            } catch (e) { fb.error(e); } finally { setExporting(false); }
          }}>{exporting ? 'Generating PDF…' : 'Export Performance Summary'}</Button>
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>Exports the selected school year as PDF</span>
        </div>
      </div>
      {evaluating && <EvaluateSpecialTaskDialog task={evaluating} onClose={(u) => { setEvaluating(null); if (u) c.replaceTask(u); }} />}
      {viewing && <ViewSpecialTaskDialog task={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
