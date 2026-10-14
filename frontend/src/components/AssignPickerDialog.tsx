import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { AssigneeSuggestion, CertificationInfo, User } from '../models/models';
import { errorMessage } from '../services/apiService';
import { AppTheme, TextStyles, densityDy, ts, tsAvatar, tsPlain, withOpacity } from '../theme/appTheme';
import { CredibilityBadge } from './CertificatesPanel';
import { Icon } from './ui/Icon';
import { ElevatedButton, TextButton } from './ui/buttons';
import { Checkbox, TextField } from './ui/inputs';
import { CircleAvatar, CircularProgressIndicator, Tooltip } from './ui/misc';
import { Dialog, showSnackBar } from './ui/overlay';

interface AssignPickerDialogProps {
  users: User[];
  selected: Set<number>;
  onChanged: (ids: Set<number>) => void;
  loadSuggestions?: () => Promise<AssigneeSuggestion[]>;
  /// False when the task has no title/subject/instructions yet, so skills
  /// and certifications can't be matched.
  hasTaskText?: boolean;
  /// Dialog title (default "Select Personnel").
  title?: string;
  /// Extra controls under the title, e.g. the "Assign as" role selector.
  header?: React.ReactNode;
  /// When set, the button assigns right away (e.g. on an existing task) and
  /// the dialog closes with `true` once it succeeds.
  onConfirm?: (ids: Set<number>) => Promise<void>;
  pop: (result?: boolean) => void;
}

/// "Skilled in: ..." -> "skilled in: ..." but leaves acronyms ("BEEd", "NC II") alone.
const lowerFirst = (r: string): string =>
  r.length > 1 && r[1] === r[1].toLowerCase() ? r[0].toLowerCase() + r.substring(1) : r;

function Badge({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: bg, borderRadius: 6 }}>
      <Text style={ts({ size: 11, weight: 600, color: fg })}>{text}</Text>
    </View>
  );
}

/// Personnel picker used when assigning a task. When [loadSuggestions] is
/// given, people are ranked by a fit score out of 100 (competency 60 +
/// workload 30 + life context 10), each row has a small box explaining why,
/// people who are already heavily loaded are flagged "High burden", and
/// selecting one of them shows a warning.
export function AssignPickerDialog({
  users,
  selected,
  onChanged,
  loadSuggestions,
  hasTaskText = true,
  title,
  header,
  onConfirm,
  pop,
}: AssignPickerDialogProps) {
  const size = useWindowDimensions();
  const [local, setLocal] = useState<Set<number>>(() => new Set(selected));
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  // Suggestion per user id, in ranked order. Empty → plain alphabetical list.
  const [ranked, setRanked] = useState<Map<number, AssigneeSuggestion>>(new Map());

  useEffect(() => {
    if (loadSuggestions == null) return;
    let mounted = true;
    setLoading(true);
    loadSuggestions()
      .then((list) => {
        if (mounted) setRanked(new Map(list.map((s) => [s.user.id, s])));
      })
      .catch(() => {
        // Suggestions are an aid only — fall back to the plain list.
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // Suggestions are loaded once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rankedList = [...ranked.values()];
  const firstRankedId = ranked.size > 0 ? [...ranked.keys()][0] : null;

  /// Users in ranked order (suggested first), then anyone the ranking skipped.
  const ordered = ((): User[] => {
    if (ranked.size === 0) return users;
    const byId = new Map(users.map((u) => [u.id, u]));
    return [
      ...[...ranked.keys()].filter((id) => byId.has(id)).map((id) => byId.get(id)!),
      ...users.filter((u) => !ranked.has(u.id)),
    ];
  })();

  const filtered = ((): User[] => {
    if (search.length === 0) return ordered;
    const q = search.toLowerCase();
    return ordered.filter((u) => {
      const s = ranked.get(u.id);
      return (
        u.fullName.toLowerCase().includes(q) ||
        (s?.user.skills.some((k) => k.toLowerCase().includes(q)) ?? false) ||
        (s?.user.certifications.some((k) => k.toLowerCase().includes(q)) ?? false)
      );
    });
  })();

  const hasMatches = rankedList.some((s) => s.isMatch);

  /// Select everyone whose profile matches the task, skipping anyone with a
  /// high burden; if that leaves nobody, select the top-ranked person.
  const autoSelect = () => {
    const ok = rankedList.filter((s) => !s.isHighBurden);
    const matches = ok.filter((s) => s.isMatch).map((s) => s.user.id);
    const ids = matches.length > 0 ? matches : [ok.length > 0 ? ok[0].user.id : firstRankedId!];
    setLocal((prev) => new Set([...prev, ...ids]));
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm!(local);
      pop(true);
    } catch (e) {
      setBusy(false);
      showSnackBar(errorMessage(e), { backgroundColor: AppTheme.redColor });
    }
  };

  /// Selected people who already carry a high burden.
  const burdenedSelection = [...local]
    .filter((id) => ranked.get(id)?.isHighBurden ?? false)
    .map((id) => ranked.get(id)!);

  const offHours = ranked.size === 0 ? [] : rankedList[0].offHours;

  const toggle = (id: number) =>
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /// Certifications worth showing for this task: the ones matching it, then
  /// related ones, then any others that are verified or awaiting review (max 4).
  const certsFor = (s: AssigneeSuggestion): CertificationInfo[] => {
    const all = s.user.certificationDetails.filter((c) => c.credibility !== 'rejected');
    const fits = (c: CertificationInfo) =>
      s.matchedCertifications.includes(c.name) || s.relatedCertifications.includes(c.name);
    const matched = all.filter((c) => s.matchedCertifications.includes(c.name));
    const related = all.filter((c) => s.relatedCertifications.includes(c.name));
    const others = all.filter((c) => !fits(c));
    return [...matched, ...related, ...others].slice(0, 4);
  };

  /// One plain sentence: why they fit, then what weighs against them.
  const whySentence = (s: AssigneeSuggestion, reasons: string[]): string => {
    const fit =
      reasons.length === 0
        ? 'Nothing in their profile matches this task.'
        : `Fits because of ${reasons.map(lowerFirst).join('; ')}.`;
    const against =
      s.loadFactors.length === 0 ? ' No current workload.' : ` Weighing against: ${s.loadFactors.join(', ')}.`;
    return fit + against;
  };

  const fitPill = (s: AssigneeSuggestion) => {
    const score = s.fitCompetency + s.fitWorkload + s.fitLifeContext;
    const [fg, bg] =
      score >= 60
        ? ['#15803D', AppTheme.greenBg]
        : score >= 35 ? [AppTheme.accentBlue, AppTheme.blueBg] : [AppTheme.textMuted, '#F3F4F6'];
    return <Badge text={`Fit ${Math.round(score)}/100`} fg={fg} bg={bg} />;
  };

  const burdenPill = (s: AssigneeSuggestion) => (
    <Tooltip message={s.loadFactors.join(' · ')}>
      {s.isHighBurden ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, backgroundColor: AppTheme.redBg, borderRadius: 6 }}>
          <Icon name="warning_amber_rounded" size={12} color={AppTheme.redColor} />
          <View style={{ width: 3 }} />
          <Text style={ts({ size: 11, weight: 700, color: AppTheme.redColor })}>High burden</Text>
        </View>
      ) : (
        <Badge text="Moderate load" fg="#B45309" bg={AppTheme.amberBg} />
      )}
    </Tooltip>
  );

  const certChip = (c: CertificationInfo, matched: boolean, key: number) => (
    <Tooltip
      key={key}
      message={[c.issuerLabel, c.category, matched ? 'fits this task' : null].filter((x): x is string => x != null).join(' · ')}
      style={{ maxWidth: '100%' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 6,
          paddingTop: 2,
          paddingRight: 3,
          paddingBottom: 2,
          backgroundColor: '#FFFFFF',
          borderRadius: 7,
          borderWidth: 1,
          borderColor: matched ? withOpacity(AppTheme.greenColor, 0.6) : AppTheme.borderColor,
        }}
      >
        <Icon name="workspace_premium_outlined" size={12} color={matched ? AppTheme.greenColor : AppTheme.textMuted} />
        <View style={{ width: 3 }} />
        <Text numberOfLines={1} style={[ts({ size: 11, weight: 600, color: AppTheme.textPrimary }), { flexShrink: 1 }]}>
          {c.name}
        </Text>
        <View style={{ width: 4 }} />
        <CredibilityBadge credibility={c.credibility} authenticity={c.authenticity} compact />
      </View>
    </Tooltip>
  );

  /// The small "why" box under each person: the three fit parts, then the
  /// reasons they fit and what weighs against them.
  const whyBox = (s: AssigneeSuggestion, reasons: string[], certs: CertificationInfo[]) => {
    const part = (label: string, v: number, max: number) => `${label} ${Math.round(v)}/${max}`;
    return (
      <View
        style={{
          alignSelf: 'stretch',
          paddingHorizontal: 10,
          paddingVertical: 8,
          backgroundColor: AppTheme.bgColor,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: s.isHighBurden ? withOpacity(AppTheme.redColor, 0.35) : AppTheme.borderColor,
        }}
      >
        <Text style={ts({ size: 11, weight: 700, color: AppTheme.textPrimary })}>
          {[
            part('Competency', s.fitCompetency, 60),
            part('Workload', s.fitWorkload, 30),
            part('Life context', s.fitLifeContext, 10),
          ].join('  ·  ')}
        </Text>
        <View style={{ height: 4 }} />
        <Text style={[TextStyles.bodySm, { fontSize: 11.5 }]}>{whySentence(s, reasons)}</Text>
        {certs.length > 0 && (
          <>
            <View style={{ height: 6 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {certs.map((c, i) =>
                certChip(c, s.matchedCertifications.includes(c.name) || s.relatedCertifications.includes(c.name), i),
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  const row = (u: User) => {
    const checked = local.has(u.id);
    const s = ranked.get(u.id) ?? null;
    const isTop = s != null && s.isMatch && firstRankedId === u.id;
    // Certifications are shown as chips with their credibility, so drop the
    // text reasons that repeat them ("Certified (verified): ...").
    const reasons =
      s?.reasons.filter((r) => !r.startsWith('Certified (') && !r.startsWith('Related certification')) ?? [];
    const certs = s == null ? [] : certsFor(s);
    const hasDetail = s != null;
    return (
      <Pressable key={u.id} onPress={() => toggle(u.id)} style={{ cursor: 'pointer' } as ViewStyle}>
        {({ hovered }: { hovered?: boolean }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: hasDetail ? 'flex-start' : 'center',
              minHeight: (hasDetail ? 88 : 72) + densityDy,
              paddingLeft: 16,
              paddingRight: 24,
              paddingVertical: hasDetail ? 12 : 8,
              backgroundColor: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
            }}
          >
            <CircleAvatar radius={18} backgroundColor={AppTheme.sidebarActive}>
              <Text style={tsAvatar(13, 700, '#FFFFFF')}>{u.initials}</Text>
            </CircleAvatar>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4 }}>
                <Text numberOfLines={1} style={TextStyles.labelMd}>{u.fullName}</Text>
                {s != null && fitPill(s)}
                {s != null && s.isMatch && (
                  <Badge
                    text={isTop ? 'Best fit' : 'Match'}
                    fg={isTop ? AppTheme.greenColor : AppTheme.accentBlue}
                    bg={isTop ? AppTheme.greenBg : AppTheme.blueBg}
                  />
                )}
                {s != null && s.burden !== 'low' && burdenPill(s)}
              </View>
              <Text style={TextStyles.bodySm}>
                {`${u.roleLabel}${u.gradeLevel != null ? ` · ${u.gradeLevel}` : ''}`}
              </Text>
              {s != null && (
                <>
                  <View style={{ height: 6 }} />
                  {whyBox(s, reasons, certs)}
                </>
              )}
            </View>
            <View style={{ width: 16 }} />
            <View pointerEvents="none">
              <Checkbox value={checked} onChanged={() => toggle(u.id)} activeColor={AppTheme.accentBlue} />
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  const w = size.width < 620 ? size.width - 48 : 580.0;
  const h = Math.min(Math.max(size.height * 0.82, 420.0), 760.0);

  return (
    <Dialog backgroundColor="#FFFFFF" radius={20} insetPadding={{ horizontal: 24, vertical: 24 }}>
      <View style={{ width: w, height: h, maxHeight: '100%' }}>
        <View style={{ paddingLeft: 20, paddingTop: 20, paddingRight: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={TextStyles.heading3}>{title ?? 'Select Personnel'}</Text>
          <View style={{ flex: 1 }} />
          {onConfirm == null ? (
            <TextButton
              onPress={() => {
                onChanged(local);
                pop();
              }}
              foregroundColor={AppTheme.accentBlue}
              textStyle={tsPlain({ weight: 600, size: 14 })}
            >
              {`Done (${local.size})`}
            </TextButton>
          ) : (
            <>
              <TextButton onPress={busy ? null : () => pop(false)}>Cancel</TextButton>
              <View style={{ width: 4 }} />
              <ElevatedButton onPress={busy || local.size === 0 ? null : confirm}>
                {busy ? (
                  <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" />
                ) : (
                  `Assign${local.size === 0 ? '' : ` (${local.size})`}`
                )}
              </ElevatedButton>
            </>
          )}
        </View>
        {header != null && (
          <View style={{ paddingLeft: 20, paddingTop: 12, paddingRight: 20, alignItems: 'flex-start' }}>{header}</View>
        )}
        {loadSuggestions != null && (
          <View
            style={{
              marginLeft: 20,
              marginTop: 10,
              marginRight: 20,
              paddingLeft: 12,
              paddingTop: 8,
              paddingRight: 8,
              paddingBottom: 8,
              backgroundColor: AppTheme.blueBg,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Icon name="auto_awesome" size={16} color={AppTheme.accentBlue} />
            <View style={{ width: 8 }} />
            <Text style={[TextStyles.bodySm, { flex: 1 }]}>
              {loading
                ? 'Finding the best fit for this task...'
                : [
                    !hasTaskText
                      ? 'Add a title or instructions first so skills and certifications ' +
                        'can be matched. For now people are ranked by workload only.'
                      : hasMatches
                        ? 'Best fit first: fit score = competency (60) + workload (30) + life context (10).'
                        : "No one's skills or certifications match the words in this " +
                          'task; ranked by workload and life context.',
                    ...(offHours.length > 0
                      ? [
                          `This task is ${offHours.join(', ')}, so people with children ` +
                            'or family care lose life-context points unless they opted in.',
                        ]
                      : []),
                  ].join(' ')}
            </Text>
            <View style={{ width: 8 }} />
            {loading ? (
              <CircularProgressIndicator size={16} strokeWidth={2} />
            ) : ranked.size > 0 ? (
              <Tooltip
                message={
                  hasMatches
                    ? 'Select everyone whose profile matches, skipping high-burden people'
                    : 'Select the top-ranked person without a high burden'
                }
              >
                <TextButton
                  onPress={autoSelect}
                  icon="bolt"
                  iconSize={16}
                  foregroundColor={AppTheme.accentBlue}
                  textStyle={tsPlain({ size: 13, weight: 600 })}
                >
                  Auto-select
                </TextButton>
              </Tooltip>
            ) : null}
          </View>
        )}
        <View style={{ paddingLeft: 20, paddingTop: 8, paddingRight: 20, paddingBottom: 12 }}>
          <TextField
            value={search}
            onChangeText={setSearch}
            decoration={{
              hintText: 'Search by name or skill...',
              hintStyle: TextStyles.bodyMd,
              prefixIcon: <Icon name="search" size={18} color={AppTheme.textMuted} />,
              filled: true,
              fillColor: AppTheme.bgColor,
              contentPadding: [0, 10],
            }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        <View style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={TextStyles.bodyMd}>No personnel found</Text>
            </View>
          ) : (
            <ScrollView>{filtered.map(row)}</ScrollView>
          )}
        </View>
        {burdenedSelection.length > 0 && (
          <View
            style={{
              marginLeft: 16,
              marginTop: 8,
              marginRight: 16,
              marginBottom: 14,
              padding: 12,
              backgroundColor: AppTheme.redBg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: withOpacity(AppTheme.redColor, 0.4),
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Icon name="warning_amber_rounded" color={AppTheme.redColor} size={20} />
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[TextStyles.labelMd, { color: AppTheme.redColor }]}>
                {burdenedSelection.length === 1
                  ? `High burden: ${burdenedSelection[0].user.fullName}`
                  : `High burden: ${burdenedSelection.length} selected people`}
              </Text>
              <View style={{ height: 2 }} />
              {burdenedSelection.map((p) => (
                <Text key={p.user.id} style={TextStyles.bodySm}>
                  {`${burdenedSelection.length > 1 ? `${p.user.fullName}: ` : ''}${p.loadFactors.join(', ')}`}
                </Text>
              ))}
              <View style={{ height: 2 }} />
              <Text style={TextStyles.bodySm}>
                Consider someone with a lighter load, or keep them if this task needs them.
              </Text>
            </View>
          </View>
        )}
      </View>
    </Dialog>
  );
}
