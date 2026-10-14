import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { IconButton, InkWell } from '../../components/ui/buttons';
import { CircularProgressIndicator, LinearProgressIndicator, Tooltip } from '../../components/ui/misc';
import { Dialog, showDialog } from '../../components/ui/overlay';
import { AppraisalBadge, Json, SchoolYearFilter, appraisalBadgeFromJson } from '../../models/models';
import { ApiService, errorMessage } from '../../services/apiService';
import { AppTheme, TextStyles, ts, withOpacity } from '../../theme/appTheme';
import { ErrorPanel } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Badges Tab — achievement badges computed by the backend from submission
// timing, special-task ratings and event evaluations for the selected school
// year / term. Personnel see their own; supervisors also get a leaderboard.
// ─────────────────────────────────────────────────────────────────────────────

const kGold = '#D97706';
const kSilver = '#64748B';
const kBronze = '#B45309';

function badgeIcon(key: string): IconName {
  switch (key) {
    case 'schedule': return 'schedule_rounded';
    case 'wb_sunny': return 'wb_sunny_rounded';
    case 'local_fire_department': return 'local_fire_department_rounded';
    case 'verified': return 'verified_rounded';
    case 'star': return 'star_rounded';
    case 'emoji_events': return 'emoji_events_rounded';
    case 'groups': return 'groups_rounded';
    default: return 'workspace_premium_rounded';
  }
}

function badgeColor(b: AppraisalBadge): string {
  if (!b.earned) return '#CBD5E1';
  switch (b.tier) {
    case 'gold': return kGold;
    case 'silver': return kSilver;
    case 'bronze': return kBronze;
    default: return AppTheme.accentBlue;
  }
}

export function BadgesTab({ filter, showOwn, showLeaderboard }: {
  filter: SchoolYearFilter;
  showOwn: boolean;
  showLeaderboard: boolean;
}) {
  const [mine, setMine] = useState<AppraisalBadge[]>([]);
  const [board, setBoard] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [own, leaders] = await Promise.all([
        showOwn ? ApiService.getBadges({ filter }) : Promise.resolve<AppraisalBadge[]>([]),
        showLeaderboard ? ApiService.getBadgeLeaderboard(filter) : Promise.resolve<Json[]>([]),
      ]);
      if (!mounted.current) return;
      setMine(own);
      setBoard(leaders);
      setLoading(false);
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e));
        setLoading(false);
      }
    }
  }, [filter, showOwn, showLeaderboard]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const openPerson = (p: Json) =>
    showDialog((pop) => <PersonBadgesDialog person={p} filter={filter} onClose={() => pop()} />);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgressIndicator />
      </View>
    );
  }
  if (error != null) return <ErrorPanel message={error} onRetry={load} />;

  const earned = mine.filter((b) => b.earned).length;
  const sectionTitle = (title: string, sub: string) => (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={ts({ size: 17, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
      <View style={{ height: 2 }} />
      <Text style={TextStyles.bodySm}>{sub}</Text>
    </View>
  );

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      {showOwn && (
        <>
          {sectionTitle('My badges', `${earned} of ${mine.length} earned this period`)}
          <View style={{ height: 12 }} />
          <BadgeGrid badges={mine} />
          <View style={{ height: 28 }} />
        </>
      )}
      {showLeaderboard && (
        <>
          {sectionTitle('Badge leaderboard', 'Personnel ranked by badges earned this period')}
          <View style={{ height: 12 }} />
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E3E9F3' }}>
            {board.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={TextStyles.bodyMd}>No personnel to show.</Text>
              </View>
            ) : (
              board.map((person, i) => (
                <React.Fragment key={person.id ?? i}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: '#F0F2F6' }} />}
                  <LeaderRow rank={i + 1} person={person} onTap={() => openPerson(person)} />
                </React.Fragment>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function BadgeGrid({ badges }: { badges: AppraisalBadge[] }) {
  const [maxWidth, setMaxWidth] = useState(0);
  const cols = maxWidth >= 1100 ? 4 : maxWidth >= 700 ? 3 : maxWidth >= 440 ? 2 : 1;
  const w = (maxWidth - 14 * (cols - 1)) / cols;
  // Earned first, then closest to earning.
  const sorted = [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.progress / b.target - a.progress / a.target;
  });
  return (
    <View onLayout={(e) => setMaxWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {maxWidth > 0 &&
        sorted.map((b) => (
          <View key={b.code} style={{ width: w }}>
            <BadgeCard badge={b} />
          </View>
        ))}
    </View>
  );
}

function BadgeCard({ badge: b }: { badge: AppraisalBadge }) {
  const color = badgeColor(b);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: b.earned ? '#FFFFFF' : '#F8FAFC',
        borderRadius: 14,
        borderWidth: b.earned ? 1.5 : 1,
        borderColor: b.earned ? withOpacity(color, 0.45) : '#E2E8F0',
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: b.earned ? withOpacity(color, 0.14) : '#F1F5F9',
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={b.earned ? badgeIcon(b.icon) : 'lock_outline_rounded'} color={b.earned ? color : '#94A3B8'} size={26} />
      </View>
      <View style={{ width: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 14, weight: 700, color: b.earned ? AppTheme.textPrimary : AppTheme.textMuted })}>{b.name}</Text>
        <View style={{ height: 3 }} />
        <Text style={TextStyles.caption}>{b.description}</Text>
        <View style={{ height: 10 }} />
        {b.earned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="check_circle_rounded" size={15} color={color} />
            <View style={{ width: 5 }} />
            <Text style={ts({ size: 12, weight: 700, color })}>Earned</Text>
          </View>
        ) : (
          <>
            <LinearProgressIndicator
              value={b.target === 0 ? 0 : b.progress / b.target}
              minHeight={6}
              radius={4}
              backgroundColor="#E2E8F0"
              color={AppTheme.accentBlue}
            />
            <View style={{ height: 4 }} />
            <Text style={TextStyles.caption}>{`${b.progress} / ${b.target}`}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function LeaderRow({ rank, person, onTap }: { rank: number; person: Json; onTap: () => void }) {
  const badges = ((person.badges ?? []) as Json[]).map(appraisalBadgeFromJson);
  const role = (person.role ?? '').toString();
  const grade = person.grade_level?.toString() ?? null;
  const sub = [...(role.length > 0 ? [role[0].toUpperCase() + role.substring(1)] : []), ...(grade != null ? [grade] : [])].join(' · ');
  return (
    <InkWell onPress={onTap} hoverColor="#F6F8FC">
      <View style={{ paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[ts({ size: 14, weight: 800, color: rank <= 3 && badges.length > 0 ? kGold : AppTheme.textLight }), { width: 28 }]}>
          {`${rank}`}
        </Text>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={ts({ size: 14, weight: 600, color: AppTheme.textPrimary })}>
            {(person.full_name ?? '').toString()}
          </Text>
          <Text style={TextStyles.caption}>{sub}</Text>
        </View>
        {badges.length === 0 ? (
          <Text style={TextStyles.caption}>No badges yet</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 4 }}>
            {badges.map((b) => (
              <Tooltip key={b.code} message={b.name}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: withOpacity(badgeColor(b), 0.14),
                    borderWidth: 1.5,
                    borderColor: badgeColor(b),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={badgeIcon(b.icon)} size={15} color={badgeColor(b)} />
                </View>
              </Tooltip>
            ))}
          </View>
        )}
        <View style={{ width: 12 }} />
        <Text style={[ts({ size: 15, weight: 800, color: AppTheme.textPrimary, align: 'right' }), { width: 34 }]}>
          {`${person.earned_count ?? 0}`}
        </Text>
        <Icon name="chevron_right_rounded" color={AppTheme.textLight} />
      </View>
    </InkWell>
  );
}

function PersonBadgesDialog({ person, filter, onClose }: { person: Json; filter: SchoolYearFilter; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const [badges, setBadges] = useState<AppraisalBadge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    ApiService.getBadges({ userId: (person.id as number | null) ?? null, filter })
      .then((b) => {
        if (mounted) setBadges(b);
      })
      .catch((e) => {
        if (mounted) setError(errorMessage(e));
      });
    return () => {
      mounted = false;
    };
  }, [person, filter]);

  return (
    <Dialog radius={16}>
      <View style={{ width: 820, maxWidth: '100%', height: height * 0.85, maxHeight: '100%', padding: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[ts({ size: 18, weight: 700 }), { flex: 1 }]}>{`${person.full_name}'s badges`}</Text>
          <IconButton onPress={onClose} tooltip="Close" icon="close" />
        </View>
        <View style={{ height: 12 }} />
        <View style={{ flex: 1 }}>
          {error != null ? (
            <Text style={ts()}>{error}</Text>
          ) : badges == null ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgressIndicator />
            </View>
          ) : (
            <ScrollView>
              <BadgeGrid badges={badges} />
            </ScrollView>
          )}
        </View>
      </View>
    </Dialog>
  );
}
