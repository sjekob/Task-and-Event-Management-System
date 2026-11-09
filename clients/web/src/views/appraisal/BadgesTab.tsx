import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, Lock, Star, Trophy, Users, Clock, Sun, Flame, BadgeCheck } from 'lucide-react';
import { BadgesController } from '@shared/controllers/AppraisalControllers';
import { AppraisalBadge, BadgeLeader, SchoolYearFilter } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Modal, Spinner } from '../../ui/kit';
import { ErrorPanel } from './common';

// Badges tab: own badges and the supervisors' leaderboard.
export const BADGE_ICON: Record<string, ReactNode> = {
  schedule: <Clock size={26} />, wb_sunny: <Sun size={26} />, local_fire_department: <Flame size={26} />, verified: <BadgeCheck size={26} />,
  star: <Star size={26} />, emoji_events: <Trophy size={26} />, groups: <Users size={26} />,
};

export function badgeIcon(b: AppraisalBadge, size = 26) {
  const el = BADGE_ICON[b.icon] ?? <Award size={size} />;
  return size === 26 ? el : <span style={{ display: 'flex', transform: `scale(${size / 26})` }}>{el}</span>;
}

export function BadgesTab({ showOwn, showBoard, filter }: { showOwn: boolean; showBoard: boolean; filter: SchoolYearFilter }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new BadgesController(services, showOwn, showBoard, filter), []);
  const [person, setPerson] = useState<BadgeLeader | null>(null);
  useEffect(() => { void c.load(filter); }, [c, filter]);
  if (s.loading) return <div className="center-fill"><Spinner /></div>;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.load()} />;
  return (
    <div className="col gap-24" style={{ gap: 28 }}>
      {showOwn && (
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>My badges</div>
          <div className="body-sm mb-12">{s.mine.filter((b) => b.earned).length} of {s.mine.length} earned this period</div>
          <BadgeGrid badges={s.mine} />
        </div>
      )}
      {showBoard && (
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Badge leaderboard</div>
          <div className="body-sm mb-12">Personnel ranked by badges earned this period</div>
          <div className="ap-card" style={{ padding: 0 }}>
            {!s.board.length ? <div className="body-md" style={{ padding: 20 }}>No personnel to show.</div> : s.board.map((p, i) => (
              <button key={p.id} className="row-btn" style={{ padding: '12px 18px' }} onClick={() => setPerson(p)}>
                <span style={{ width: 28, fontSize: 14, fontWeight: 800, color: i < 3 && p.badges.length ? '#d97706' : 'var(--light)' }}>{i + 1}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{p.fullName}</span>
                  <span className="caption">{[p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '', p.gradeLevel ?? ''].filter(Boolean).join(' · ')}</span>
                </span>
                {!p.badges.length ? <span className="caption">No badges yet</span> : (
                  <span className="row gap-4">
                    {p.badges.map((b) => {
                      const col = BadgesController.color(b);
                      return <span key={b.code} title={b.name} className="avatar" style={{ width: 28, height: 28, background: `${col}24`, color: col, border: `1.5px solid ${col}` }}>{badgeIcon(b, 15)}</span>;
                    })}
                  </span>
                )}
                <span style={{ width: 34, textAlign: 'right', fontSize: 15, fontWeight: 800 }}>{p.earnedCount}</span>
                <ChevronRight size={20} color="var(--light)" />
              </button>
            ))}
          </div>
        </div>
      )}
      {person && <PersonBadges c={c} person={person} onClose={() => setPerson(null)} />}
    </div>
  );
}

export function PersonBadges({ c, person, onClose }: { c: BadgesController; person: BadgeLeader; onClose: () => void }) {
  const [badges, setBadges] = useState<AppraisalBadge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { c.personBadges(person.id).then(setBadges).catch((e) => setError(e.message)); }, [c, person.id]);
  return (
    <Modal title={`${person.fullName}'s badges`} size="xwide" onClose={onClose}>
      {error ? <div>{error}</div> : !badges ? <div className="center-fill"><Spinner /></div> : <BadgeGrid badges={badges} />}
    </Modal>
  );
}

export function BadgeGrid({ badges }: { badges: AppraisalBadge[] }) {
  const sorted = useMemo(() => BadgesController.sorted(badges), [badges]);
  return (
    <div className="ap-badges">
      {sorted.map((b) => {
        const col = BadgesController.color(b);
        return (
          <div key={b.code} className="row-top gap-12" style={{ padding: 16, borderRadius: 14, background: b.earned ? '#fff' : 'var(--surface-2)', border: `${b.earned ? 1.5 : 1}px solid ${b.earned ? `${col}73` : 'var(--border)'}` }}>
            <span className="avatar" style={{ width: 52, height: 52, background: b.earned ? `${col}24` : 'var(--surface-3)', color: b.earned ? col : 'var(--light)', border: `2px solid ${col}` }}>
              {b.earned ? badgeIcon(b) : <Lock size={24} />}
            </span>
            <div className="grow">
              <div style={{ fontSize: 14, fontWeight: 700, color: b.earned ? 'var(--text)' : 'var(--muted)' }}>{b.name}</div>
              <div className="caption" style={{ marginTop: 3 }}>{b.description}</div>
              {b.earned ? <div className="row gap-4 mt-8" style={{ color: col, fontSize: 12, fontWeight: 700 }}><CheckCircle2 size={15} />Earned</div> : (
                <div className="mt-8">
                  <div className="progress" style={{ background: 'var(--border)' }}><div style={{ width: `${b.fraction * 100}%` }} /></div>
                  <div className="caption mt-4">{b.progress} / {b.target}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
