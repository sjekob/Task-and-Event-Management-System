import { useState } from 'react';
import { CalendarDays, ClipboardList, TrendingUp, Trophy, Users } from 'lucide-react';
import { AppraisalAnalytics, AppraisalController } from '@shared/controllers/AppraisalControllers';
import { Stat, TONE } from './common';

// Analytics tab: school-wide performance (principal/admin).
export function AnalyticsTab({ c }: { c: AppraisalController }) {
  const a = AppraisalAnalytics.compute(c.state.tasks.items, c.state.events.items);
  // Department or Individual performance (Lok's slide toggle).
  const [mode, setMode] = useState<'department' | 'individual'>('department');
  const list = mode === 'department' ? a.departments : a.individuals;
  return (
    <div className="col gap-16">
      <div className="grid-4">
        <Stat value={a.overallAvg > 0 ? `${a.overallAvg.toFixed(1)}%` : '—'} label="Overall Performance" sub="Real-time avg" icon={<Trophy size={22} />} color="#10b981" bg="#ecfdf5" />
        <Stat value={String(a.uniquePersonnel)} label="Total Personnel" sub="In your scope" icon={<Users size={22} />} color="#3b82f6" bg="#eff6ff" />
        <Stat value={String(a.evaluatedCount)} label="Special Tasks" sub="Evaluated tasks" icon={<ClipboardList size={22} />} color="#f59e0b" bg="#fef3c7" />
        <Stat value={String(a.eventEvalCount)} label="Events Evaluated" sub="Real-time count" icon={<CalendarDays size={22} />} color="#8b5cf6" bg="#ede9fe" />
      </div>
      <div className="ap-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Monthly Performance Trend</div>
        <div className="row" style={{ height: 180, alignItems: 'stretch' }}>
          <div className="col between" style={{ fontSize: 11, color: 'var(--muted)', paddingBottom: 22 }}><span>100%</span><span>50%</span><span>0%</span></div>
          <div className="row grow" style={{ justifyContent: 'space-evenly', alignItems: 'flex-end' }}>
            {a.monthly.map((m) => (
              <div key={m.month} className="col" style={{ alignItems: 'center', gap: 6 }}>
                <div title={m.avg ? `${m.avg}%` : 'No data'} style={{ width: 32, height: m.avg ? Math.max(20, Math.min(140, (m.avg / 100) * 140)) : 30, borderRadius: 4, background: m.avg ? 'var(--dark)' : '#eeeeee' }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="ap-card" style={{ padding: 20 }}>
          <div className="row between gap-12 wrap" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{mode === 'department' ? 'Department' : 'Individual'} Performance</span>
            <div className="ap-slide" role="radiogroup" aria-label="Show performance by">
              <span className="ap-slide-thumb" style={{ transform: mode === 'individual' ? 'translateX(100%)' : undefined }} />
              <button role="radio" aria-checked={mode === 'department'} className={mode === 'department' ? 'on' : ''} onClick={() => setMode('department')}>Department</button>
              <button role="radio" aria-checked={mode === 'individual'} className={mode === 'individual' ? 'on' : ''} onClick={() => setMode('individual')}>Individual</button>
            </div>
          </div>
          {!list.length ? <div className="body-md">No data yet.</div> : list.map((d) => {
            const col = TONE[AppraisalAnalytics.deptTone(d.avg)];
            const sub = mode === 'individual'
              ? [d.dept, `${d.count} rated item${d.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
              : `${d.count} rated item${d.count === 1 ? '' : 's'}`;
            return (
              <div key={d.name} style={{ marginBottom: 16 }}>
                <div className="row">
                  <div className="grow"><div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div></div>
                  <span className="row gap-4" style={{ color: col, fontSize: 13, fontWeight: 700 }}><TrendingUp size={14} />{d.avg.toFixed(1)}%</span>
                </div>
                <div className="progress mt-8" style={{ background: '#eeeeee' }}><div style={{ width: `${Math.min(100, d.avg)}%`, background: col }} /></div>
              </div>
            );
          })}
        </div>
        <div className="ap-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top Performers</div>
          {!a.performers.length ? <div className="body-md">No data yet.</div> : a.performers.map((p, i) => (
            <div key={p.name} className="row gap-10" style={{ marginBottom: 12 }}>
              <span className="avatar" style={{ width: 26, height: 26, fontSize: 10, background: AppraisalAnalytics.rankColor(i + 1) }}>#{i + 1}</span>
              <div className="grow"><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.count} rated item{p.count !== 1 ? 's' : ''}</div></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: TONE[AppraisalAnalytics.performerTone(p.avg)] }}>{p.avg.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
