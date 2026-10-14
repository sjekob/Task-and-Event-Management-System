import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AuditEntryTile } from '../components/AuditHistory';
import { AppBanner } from '../components/commonWidgets';
import { Icon } from '../components/ui/Icon';
import { TextButton } from '../components/ui/buttons';
import { TextField } from '../components/ui/inputs';
import { Chip, CircularProgressIndicator, useIsMobile } from '../components/ui/misc';
import { AuditEntry } from '../models/audit';
import { ApiService, errorMessage } from '../services/apiService';
import { AppTheme, TextStyles, ts } from '../theme/appTheme';

const CATEGORIES: [string, string | null][] = [
  ['All activity', null],
  ['Accounts', 'account'],
  ['Roles & delegation', 'personnel'],
  ['Certificates', 'certificate'],
  ['School years', 'school_year'],
  ['Events', 'event'],
  ['Tasks', 'task'],
  ['Submissions', 'report'],
  ['Comments', 'comment'],
  ['Sign-ins', 'auth'],
];

const PAGE_SIZE = 50;

/// Principal/admin page listing the audit trail: account and delegation
/// changes, certificate reviews, school-year changes, event approvals and task
/// assignments, each with who did it and when. Entries can't be edited or
/// deleted (enforced by the database).
export default function AuditLogScreen() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All activity');
  const [search, setSearch] = useState('');

  const mounted = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The filters and loaded rows as of the latest change, for loads fired from
  // timers and taps in the same tick.
  const current = useRef({ category: 'All activity', query: '', count: 0 });

  const load = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const r = await ApiService.getAuditLog({
        action: CATEGORIES.find(([label]) => label === current.current.category)?.[1] ?? null,
        query: current.current.query,
        limit: PAGE_SIZE,
        offset: reset ? 0 : current.current.count,
      });
      if (!mounted.current) return;
      setItems((prev) => {
        const next = reset ? r.items : [...prev, ...r.items];
        current.current.count = next.length;
        return next;
      });
      setTotal(r.total);
      setLoading(false);
    } catch (e) {
      if (mounted.current) {
        setLoading(false);
        setError(errorMessage(e));
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    load(true);
    return () => {
      mounted.current = false;
      if (debounce.current != null) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const side = isMobile ? 16 : 24;
  return (
    <ScrollView contentContainerStyle={{ paddingLeft: side, paddingTop: 8, paddingRight: side, paddingBottom: 24 }}>
      <AppBanner
        title="Audit Log"
        subtitle={
          'Everything users do: sign-ins, tasks, submissions, comments, events, accounts, roles, ' +
          'certificate reviews and school years, with who did it and when. ' +
          'Entries cannot be edited or deleted.'
        }
      />
      <View style={{ height: 16 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <View style={{ width: isMobile ? '100%' : 340 }}>
          <TextField
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              if (debounce.current != null) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => {
                current.current.query = v.trim();
                load(true);
              }, 350);
            }}
            // Only `border` is cleared here, so the theme's outline still draws.
            decoration={{
              hintText: 'Search by person or description…',
              hintStyle: TextStyles.bodyMd,
              prefixIcon: <Icon name="search" size={18} color={AppTheme.textMuted} />,
              filled: true,
              fillColor: '#FFFFFF',
              contentPadding: [0, 12],
            }}
          />
        </View>
        {CATEGORIES.map(([c]) => (
          <Chip
            key={c}
            label={c}
            selected={category === c}
            onPress={() => {
              setCategory(c);
              current.current.category = c;
              load(true);
            }}
            labelStyle={ts({ size: 12.5, weight: 600, color: category === c ? '#FFFFFF' : AppTheme.textPrimary })}
            selectedColor={AppTheme.darkBanner}
            backgroundColor="#FFFFFF"
            showCheckmark={false}
            side={{ color: AppTheme.borderColor }}
          />
        ))}
      </View>
      <View style={{ height: 16 }} />
      {error != null ? (
        <Text style={[TextStyles.bodyMd, { color: AppTheme.redColor }]}>{error}</Text>
      ) : items.length === 0 && loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <CircularProgressIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={TextStyles.bodyMd}>No matching activity.</Text>
        </View>
      ) : (
        <>
          <Text style={TextStyles.caption}>{`${total} ${total === 1 ? 'entry' : 'entries'}`}</Text>
          <View style={{ height: 8 }} />
          {items.map((e, i) => (
            <AuditEntryTile key={`${e.id}-${i}`} entry={e} />
          ))}
          {items.length < total && (
            <View style={{ alignItems: 'center' }}>
              <TextButton onPress={loading ? null : () => load()}>{loading ? 'Loading…' : 'Load more'}</TextButton>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
