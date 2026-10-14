import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AuditEntry } from '../models/audit';
import { ApiService, errorMessage } from '../services/apiService';
import { AppTheme, TextStyles, ts, withOpacity } from '../theme/appTheme';
import { Icon, IconName } from './ui/Icon';
import { CircularProgressIndicator } from './ui/misc';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatAuditTime(t: Date | null): string {
  if (t == null) return '—';
  const h = t.getHours() % 12 === 0 ? 12 : t.getHours() % 12;
  const m = `${t.getMinutes()}`.padStart(2, '0');
  const s = `${t.getSeconds()}`.padStart(2, '0');
  return `${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()} · ${h}:${m}:${s} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
}

const roleLabel = (r: string | null): string =>
  r == null || r.length === 0 ? '' : `${r[0].toUpperCase()}${r.substring(1)}`;

function valueText(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function iconFor(action: string): [IconName, string] {
  if (action.startsWith('account.deactivate')) return ['person_off_outlined', AppTheme.redColor];
  if (action.startsWith('account')) return ['person_add_alt_outlined', AppTheme.greenColor];
  if (action.startsWith('personnel')) return ['manage_accounts_outlined', AppTheme.accentBlue];
  if (action === 'certificate.verified') return ['verified_outlined', AppTheme.greenColor];
  if (action === 'certificate.rejected') return ['block', AppTheme.redColor];
  if (action.startsWith('certificate')) return ['workspace_premium_outlined', AppTheme.accentBlue];
  if (action.startsWith('school_year')) return ['date_range_outlined', AppTheme.amberColor];
  if (action.startsWith('event')) return ['event_outlined', '#7C3AED'];
  if (action === 'event.evaluate' || action === 'event.public_evaluation') return ['rate_review_outlined', '#7C3AED'];
  if (action === 'task.assign' || action === 'task.unassign') return ['assignment_ind_outlined', AppTheme.accentBlue];
  if (action === 'task.evaluate') return ['rate_review_outlined', AppTheme.accentBlue];
  if (action.startsWith('task')) return ['assignment_outlined', AppTheme.accentBlue];
  if (action === 'report.unsubmit' || action === 'report.missing') return ['assignment_turned_in_outlined', AppTheme.redColor];
  if (action.startsWith('report')) return ['assignment_turned_in_outlined', AppTheme.greenColor];
  if (action.startsWith('comment')) return ['chat_bubble_outline', AppTheme.textMuted];
  if (action.startsWith('template')) return ['library_books_outlined', AppTheme.accentBlue];
  if (action === 'auth.login_failed') return ['lock_outline', AppTheme.redColor];
  if (action.startsWith('auth')) return ['lock_outline', AppTheme.textMuted];
  return ['history', AppTheme.textMuted];
}

export function AuditEntryTile({ entry: e, showEntity = true }: {
  entry: AuditEntry;
  /// Show which record it is about (hidden when listing one record's history).
  showEntity?: boolean;
}) {
  const [icon, color] = iconFor(e.action);
  return (
    <View
      style={{
        marginBottom: 8,
        padding: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: AppTheme.borderColor,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          backgroundColor: withOpacity(color, 0.1),
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={18} color={color} />
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
          <Text style={TextStyles.labelMd}>{e.summary}</Text>
          {showEntity && e.entityLabel != null && <Text style={TextStyles.bodySm}>{`· ${e.entityLabel}`}</Text>}
        </View>
        <View style={{ height: 3 }} />
        <Text style={TextStyles.caption}>
          {[
            formatAuditTime(e.createdAt),
            `by ${e.actorName ?? 'system'}${e.actorRole != null ? ` (${roleLabel(e.actorRole)})` : ''}`,
          ].join('  ·  ')}
        </Text>
        {Object.keys(e.changes).length > 0 && (
          <>
            <View style={{ height: 8 }} />
            {Object.entries(e.changes).map(([key, value]) => (
              <View key={key} style={{ paddingBottom: 3 }}>
                <Text style={ts({ size: 12, color: AppTheme.textPrimary })}>
                  <Text style={ts({ size: 12, weight: 600, color: AppTheme.textPrimary })}>{`${key.replace(/_/g, ' ')}: `}</Text>
                  <Text style={{ color: AppTheme.textMuted, textDecorationLine: 'line-through' }}>
                    {valueText(value.length > 0 ? value[0] : null)}
                  </Text>
                  {'  →  '}
                  {valueText(value.length > 1 ? value[1] : null)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

/// The change history of one record (e.g. a person's account and delegation).
export function AuditHistory({ entityType, entityId }: { entityType: string; entityId: number }) {
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    ApiService.getAuditLog({ entityType, entityId, limit: 50 })
      .then((r) => {
        if (mounted) setItems(r.items);
      })
      .catch((e) => {
        if (mounted) setError(errorMessage(e));
      });
    return () => {
      mounted = false;
    };
  }, [entityType, entityId]);

  if (error != null) return <Text style={TextStyles.bodySm}>{error}</Text>;
  if (items == null) {
    return (
      <View style={{ padding: 8, alignItems: 'center', alignSelf: 'stretch' }}>
        <CircularProgressIndicator size={18} strokeWidth={2} />
      </View>
    );
  }
  if (items.length === 0) return <Text style={TextStyles.bodySm}>No recorded changes yet.</Text>;
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {items.map((e) => (
        <AuditEntryTile key={e.id} entry={e} showEntity={false} />
      ))}
    </View>
  );
}
