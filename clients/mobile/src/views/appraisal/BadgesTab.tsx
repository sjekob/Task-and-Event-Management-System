import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BadgesController } from '@shared/controllers/AppraisalControllers';
import { AppraisalBadge, BadgeLeader, SchoolYearFilter } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { C, Card, FeatherName, Icon, Loading, Modal, Progress, Row, T } from '../../ui/kit';
import { ErrorPanel } from './common';

const BADGE_ICON: Record<string, FeatherName> = {
  schedule: 'clock', wb_sunny: 'sun', local_fire_department: 'zap', verified: 'check-circle', star: 'star', emoji_events: 'award', groups: 'users',
};

/** Own badges and the supervisors' leaderboard. */
export function BadgesTab({ showOwn, showBoard, filter }: { showOwn: boolean; showBoard: boolean; filter: SchoolYearFilter }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new BadgesController(services, showOwn, showBoard, filter), []);
  const [person, setPerson] = useState<BadgeLeader | null>(null);
  useEffect(() => { void c.load(filter); }, [c, filter]);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.load()} />;
  return (
    <View style={{ gap: 20 }}>
      {showOwn && (
        <View style={{ gap: 8 }}>
          <T size={17} weight={700}>My badges</T>
          <T size={12} color={C.muted}>{s.mine.filter((b) => b.earned).length} of {s.mine.length} earned this period</T>
          <BadgeGrid badges={s.mine} />
        </View>
      )}
      {showBoard && (
        <View style={{ gap: 8 }}>
          <T size={17} weight={700}>Badge leaderboard</T>
          <T size={12} color={C.muted}>Personnel ranked by badges earned this period</T>
          <Card style={{ padding: 0 }}>
            {!s.board.length ? <T color={C.muted} style={{ padding: 16 }}>No personnel to show.</T>
              : s.board.map((p, i) => <LeaderRow key={p.id} p={p} rank={i + 1} onPress={() => setPerson(p)} />)}
          </Card>
        </View>
      )}
      {person && <PersonBadges c={c} person={person} onClose={() => setPerson(null)} />}
    </View>
  );
}

const LeaderRow = memo(function LeaderRow({ p, rank, onPress }: { p: BadgeLeader; rank: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: C.border }}>
      <T size={14} weight={800} color={rank <= 3 && p.badges.length ? '#d97706' : C.light} style={{ width: 24 }}>{rank}</T>
      <View style={{ flex: 1 }}>
        <T weight={600} lines={1}>{p.fullName}</T>
        <T size={11.5} color={C.muted}>{[p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '', p.gradeLevel ?? ''].filter(Boolean).join(' · ')}</T>
      </View>
      <Row gap={3}>
        {p.badges.slice(0, 4).map((b) => {
          const col = BadgesController.color(b);
          return <View key={b.code} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${col}24`, borderWidth: 1.5, borderColor: col, alignItems: 'center', justifyContent: 'center' }}><Icon name={BADGE_ICON[b.icon] ?? 'award'} size={12} color={col} /></View>;
        })}
      </Row>
      <T size={15} weight={800}>{p.earnedCount}</T>
      <Icon name="chevron-right" size={18} color={C.light} />
    </Pressable>
  );
});

function PersonBadges({ c, person, onClose }: { c: BadgesController; person: BadgeLeader; onClose: () => void }) {
  const [badges, setBadges] = useState<AppraisalBadge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { c.personBadges(person.id).then(setBadges).catch((e) => setError(e.message)); }, [c, person.id]);
  return (
    <Modal title={`${person.fullName}'s badges`} icon="award" onClose={onClose}>
      {error ? <T color={C.red}>{error}</T> : !badges ? <Loading /> : <BadgeGrid badges={badges} />}
    </Modal>
  );
}

function BadgeGrid({ badges }: { badges: AppraisalBadge[] }) {
  const sorted = useMemo(() => BadgesController.sorted(badges), [badges]);
  return (
    <View style={{ gap: 8 }}>
      {sorted.map((b) => {
        const col = BadgesController.color(b);
        return (
          <Row key={b.code} gap={12} style={{ alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: b.earned ? '#fff' : '#FFFAF2', borderWidth: b.earned ? 1.5 : 1, borderColor: b.earned ? `${col}73` : '#F1E3CC' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: b.earned ? `${col}24` : '#FBEFDB', borderWidth: 2, borderColor: col, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={b.earned ? BADGE_ICON[b.icon] ?? 'award' : 'lock'} size={21} color={b.earned ? col : '#94a3b8'} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <T weight={700} color={b.earned ? C.text : C.muted}>{b.name}</T>
              <T size={12} color={C.muted}>{b.description}</T>
              {b.earned ? <T size={12} weight={700} color={col}>✓ Earned</T> : (
                <View style={{ gap: 3, marginTop: 2 }}><Progress value={b.fraction} /><T size={11.5} color={C.muted}>{b.progress} / {b.target}</T></View>
              )}
            </View>
          </Row>
        );
      })}
    </View>
  );
}
