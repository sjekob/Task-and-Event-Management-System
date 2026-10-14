import React from 'react';
import { Text, View } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { ElevatedButton, Tap } from '../../components/ui/buttons';
import { PopupMenuButton } from '../../components/ui/misc';
import { tryParseDate } from '../../models/models';
import { AppTheme, TextStyles, ts, tsPlain, withOpacity } from '../../theme/appTheme';

// ─────────────────────────────────────────────────────────────────────────────
// Shared small widgets
// ─────────────────────────────────────────────────────────────────────────────

export const GREY = { 100: '#F5F5F5', 200: '#EEEEEE', 300: '#E0E0E0', 400: '#BDBDBD', 500: '#9E9E9E' };
export const AMBER = '#FFC107';
export const RED = '#F44336';

/// "2025-03-15 08:00" → "3/15/2025".
export function fmtSlashDate(raw: string | null): string {
  if (raw == null || raw.length === 0) return '—';
  const dt = tryParseDate(raw.split(' ')[0]);
  if (dt == null) return raw;
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
}

/// Uppercase column heading of the appraisal tables.
export const tableHeadStyle = (size: number, spacing: number) =>
  ts({ size, weight: 700, color: AppTheme.textMuted, spacing });

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ padding: 32, alignItems: 'center' }}>
        <Icon name="error_outline" color={AppTheme.redColor} size={48} />
        <View style={{ height: 12 }} />
        <Text style={ts({ size: 16, weight: 600, color: AppTheme.textPrimary })}>Failed to load data</Text>
        <View style={{ height: 6 }} />
        <Text style={[TextStyles.bodyMd, { textAlign: 'center' }]}>{message}</Text>
        <View style={{ height: 16 }} />
        <ElevatedButton
          onPress={onRetry}
          icon="refresh"
          iconSize={16}
          backgroundColor={AppTheme.darkBanner}
          foregroundColor="#FFFFFF"
          padding={[20, 10]}
          radius={8}
          textStyle={tsPlain({ size: 13, weight: 600 })}
        >
          Retry
        </ElevatedButton>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable filter dropdown
// ─────────────────────────────────────────────────────────────────────────────

export function FilterDropdown({ icon, label, options, selected, onSelect }: {
  icon: IconName | null;
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <PopupMenuButton<string | null>
      onSelected={onSelect}
      enabled={options.length > 0}
      items={[
        { value: null, child: <Text style={ts({ size: 13 })}>All</Text> },
        ...options.map((o) => ({ value: o, child: <Text style={ts({ size: 13 })}>{o}</Text> })),
      ]}
      child={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: GREY[300],
            borderRadius: 8,
          }}
        >
          {icon != null && (
            <>
              <Icon name={icon} size={14} color={AppTheme.textMuted} />
              <View style={{ width: 6 }} />
            </>
          )}
          <Text style={ts({ size: 13, weight: 500, color: selected != null ? AppTheme.textPrimary : AppTheme.textMuted })}>
            {selected ?? label}
          </Text>
          <View style={{ width: 4 }} />
          <Icon name="keyboard_arrow_down" size={15} color={AppTheme.textMuted} />
        </View>
      }
    />
  );
}

export function AppraisalStatCard({ value, label, subLabel, subtitle, valueColor, icon, iconColor, iconBg }: {
  value: string;
  label: string;
  subLabel?: string;
  subtitle?: string;
  valueColor?: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: GREY[200],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 28, weight: 800, color: valueColor ?? AppTheme.textPrimary })}>{value}</Text>
        <Text style={ts({ size: 12, color: AppTheme.textMuted })}>{label}</Text>
        {subLabel != null && <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{subLabel}</Text>}
        {subtitle != null && <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{subtitle}</Text>}
      </View>
      <View style={{ padding: 10, backgroundColor: iconBg, borderRadius: 999 }}>
        <Icon name={icon} color={iconColor} size={22} />
      </View>
    </View>
  );
}

/// A row of equally wide stat cards with 12px gaps.
export function StatRow({ children }: { children: React.ReactNode[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
      {children.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ width: 12 }} />}
          <View style={{ flex: 1 }}>{child}</View>
        </React.Fragment>
      ))}
    </View>
  );
}

export function CoverageCard({ icon, iconColor, iconBg, title, subtitle }: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ padding: 8, backgroundColor: iconBg, borderRadius: 8 }}>
        <Icon name={icon} color={iconColor} size={18} />
      </View>
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{title}</Text>
        <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function StatusChip({ status }: { status: string }) {
  let color: string;
  let label: string;
  let hasIcon = false;
  switch (status.toLowerCase()) {
    case 'evaluated': color = '#22C55E'; label = 'Evaluated'; hasIcon = true; break;
    case 'flagged': color = '#EF4444'; label = 'Flagged'; break;
    case 'not_submitted': color = '#EF4444'; label = 'Not Submitted'; break;
    case 'pending': color = '#F59E0B'; label = 'Pending'; break;
    case 'pending_approval': color = '#F59E0B'; label = 'Pending Approval'; break;
    case 'awaiting_ratings': color = '#F59E0B'; label = 'Awaiting Ratings'; break;
    case 'approved': color = '#3B82F6'; label = 'Approved'; break;
    case 'draft': color = GREY[500]; label = 'Draft'; break;
    case 'disabled': color = '#EF4444'; label = 'Disabled'; break;
    case 'completed': color = '#22C55E'; label = 'Completed'; hasIcon = true; break;
    case 'ongoing': color = '#3B82F6'; label = 'Ongoing'; break;
    default: color = GREY[500]; label = status;
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: withOpacity(color, 0.12),
        borderRadius: 20,
      }}
    >
      {hasIcon && (
        <>
          <Icon name="check_circle" size={12} color={color} />
          <View style={{ width: 4 }} />
        </>
      )}
      <Text numberOfLines={1} style={[ts({ size: 11, weight: 700, color }), { flexShrink: 1 }]}>{label}</Text>
    </View>
  );
}

export function ScoreBadge({ score, flagged }: { score: number; flagged: boolean }) {
  const [bg, fg] =
    flagged || score < 50 ? ['#FEE2E2', '#DC2626'] : score < 75 ? ['#FEF9C3', '#CA8A04'] : ['#DCFCE7', '#16A34A'];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: bg, borderRadius: 6 }}>
      <Text style={ts({ size: 12, weight: 700, color: fg })}>{`${score}/100`}</Text>
    </View>
  );
}

export function ActionBtn({ label, dark, onTap }: { label: string; dark: boolean; onTap: () => void }) {
  return (
    <Tap onPress={onTap}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: dark ? AppTheme.darkBanner : GREY[200],
          borderRadius: 7,
        }}
      >
        <Text style={ts({ size: 12, weight: 600, color: dark ? '#FFFFFF' : AppTheme.textPrimary })}>{label}</Text>
      </View>
    </Tap>
  );
}

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={ts({ size: 12, color: AppTheme.textMuted, weight: 400 })}>{label}</Text>
      <View style={{ height: 2 }} />
      <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>{value}</Text>
    </View>
  );
}

export function StarRatingRow({ label, value, onChanged }: {
  label: string;
  value: number;
  onChanged: (value: number) => void;
}) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{label}</Text>
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Tap key={v} onPress={() => onChanged(v)}>
            <View style={{ paddingRight: 6 }}>
              <Icon
                name={v <= value ? 'star_rounded' : 'star_outline_rounded'}
                color={v <= value ? AMBER : GREY[400]}
                size={28}
              />
            </View>
          </Tap>
        ))}
      </View>
    </View>
  );
}

export function EvalReadRow({ label, score }: { label: string; score: number }) {
  return (
    <View style={{ paddingBottom: 4, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
      <Text style={[ts({ size: 13, color: AppTheme.textPrimary }), { flex: 1 }]}>{label}</Text>
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Icon
            key={v}
            name={v <= score ? 'star_rounded' : 'star_outline_rounded'}
            color={v <= score ? AMBER : GREY[300]}
            size={20}
          />
        ))}
      </View>
    </View>
  );
}

/// The white bordered card used throughout the appraisal tabs.
export const panelStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: GREY[200],
} as const;

/// Material `Divider(height: 1)` in its default colour.
export const HairDivider = () => <View style={{ height: 1, backgroundColor: '#C5C6D0', alignSelf: 'stretch' }} />;
