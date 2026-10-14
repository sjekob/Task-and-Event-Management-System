import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AppBanner } from '../components/commonWidgets';
import { Icon } from '../components/ui/Icon';
import { FilledButton, IconButton, InkWell, TextButton } from '../components/ui/buttons';
import { InputDecorator, TextField } from '../components/ui/inputs';
import { CircularProgressIndicator, useIsMobile } from '../components/ui/misc';
import { AlertDialog, Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { showDatePicker, themePickerColors } from '../components/ui/pickers';
import { SchoolYear, tryParseDate } from '../models/models';
import { ApiService, errorMessage } from '../services/apiService';
import { AppTheme, TextStyles, ts } from '../theme/appTheme';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(iso: string): string {
  const d = tryParseDate(iso);
  return d == null ? iso : `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function statusStyle(status: string): [string, string, string] {
  switch (status) {
    case 'current':
      return ['Current', '#15803D', AppTheme.greenBg];
    case 'archived':
      return ['Archived', '#92400E', AppTheme.amberBg];
    default:
      return ['Upcoming', AppTheme.accentBlue, AppTheme.blueBg];
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ padding: 18, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E3E9F3' }}>
      {children}
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const [label, fg, bg] = statusStyle(status);
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={ts({ size: 11.5, weight: 700, color: fg })}>{label}</Text>
    </View>
  );
}

function YearCard({ year, onEdit, onDelete }: { year: SchoolYear; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, backgroundColor: '#EEF2FA', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={year.status === 'archived' ? 'inventory_2_outlined' : 'school_outlined'} color={AppTheme.darkBanner} size={20} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={ts({ size: 16, weight: 700, color: AppTheme.textPrimary })}>{`S.Y. ${year.name}`}</Text>
            <View style={{ width: 10 }} />
            <StatusChip status={year.status} />
          </View>
          <View style={{ height: 2 }} />
          <Text style={TextStyles.bodyMd}>{`${fmt(year.startDate)} – ${fmt(year.endDate)}`}</Text>
        </View>
        <IconButton tooltip={`Edit S.Y. ${year.name}`} onPress={onEdit} icon="edit_outlined" size={20} color={AppTheme.textMuted} />
        <IconButton tooltip={`Remove S.Y. ${year.name}`} onPress={onDelete} icon="delete_outline" size={20} color={AppTheme.textMuted} />
      </View>
      <View style={{ height: 14 }} />
      {year.terms.length === 0 ? (
        <Text style={TextStyles.bodySm}>No terms set — add quarters/terms to filter appraisals by term.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {year.terms.map((t) => (
            <View
              key={t.id}
              style={{
                width: 220,
                padding: 12,
                backgroundColor: t.status === 'current' ? '#F0FDF4' : '#F8FAFC',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: t.status === 'current' ? '#86EFAC' : '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text numberOfLines={1} style={[ts({ size: 13, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>{t.name}</Text>
                <StatusChip status={t.status} />
              </View>
              <View style={{ height: 4 }} />
              <Text style={TextStyles.caption}>{`${fmt(t.startDate)} – ${fmt(t.endDate)}`}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

interface TermDraft {
  name: string;
  start: Date | null;
  end: Date | null;
}

const TERM_NAMES = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];

function DateBox({ label, value, fallback, onPicked }: {
  label: string;
  value: Date | null;
  /// Where the calendar opens when no date is set yet.
  fallback: Date | null;
  onPicked: (d: Date) => void;
}) {
  return (
    <InkWell
      radius={8}
      onPress={async () => {
        const d = await showDatePicker({
          initialDate: value ?? fallback ?? new Date(),
          firstDate: new Date(2015, 0, 1),
          lastDate: new Date(2040, 0, 1),
          colors: themePickerColors,
        });
        if (d != null) onPicked(d);
      }}
    >
      <InputDecorator
        focused={false}
        hasValue
        decoration={{
          labelText: label,
          isDense: true,
          suffixIcon: <Icon name="calendar_today_outlined" size={16} color={AppTheme.textMuted} />,
        }}
      >
        <Text style={ts({ size: 13, color: value == null ? AppTheme.textLight : AppTheme.textPrimary })}>
          {value == null ? 'Select date' : fmt(iso(value))}
        </Text>
      </InputDecorator>
    </InkWell>
  );
}

function SchoolYearDialog({ existing, pop }: { existing: SchoolYear | null; pop: (saved: boolean) => void }) {
  const { width, height } = useWindowDimensions();
  const [name, setName] = useState(existing?.name ?? '');
  const [start, setStart] = useState<Date | null>(existing != null ? tryParseDate(existing.startDate) : null);
  const [end, setEnd] = useState<Date | null>(existing != null ? tryParseDate(existing.endDate) : null);
  const [terms, setTerms] = useState<TermDraft[]>(() =>
    (existing?.terms ?? []).map((t) => ({ name: t.name, start: tryParseDate(t.startDate), end: tryParseDate(t.endDate) })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const narrow = width < 600;

  const setTerm = (i: number, change: Partial<TermDraft>) =>
    setTerms((prev) => prev.map((t, j) => (j === i ? { ...t, ...change } : t)));

  const addTerm = () => {
    const prevEnd = terms.length > 0 ? terms[terms.length - 1].end : null;
    setTerms([
      ...terms,
      {
        name: terms.length < TERM_NAMES.length ? TERM_NAMES[terms.length] : `Term ${terms.length + 1}`,
        start:
          prevEnd != null
            ? new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1)
            : terms.length === 0
              ? start
              : null,
        end: null,
      },
    ]);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || start == null || end == null) {
      setError('Enter the school year name and both dates.');
      return;
    }
    for (const t of terms) {
      if (t.name.trim().length === 0 || t.start == null || t.end == null) {
        setError('Give every term a name, a start date and an end date.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await ApiService.saveSchoolYear(
        {
          name: trimmed,
          start_date: iso(start),
          end_date: iso(end),
          terms: terms.map((t) => ({ name: t.name.trim(), start_date: iso(t.start as Date), end_date: iso(t.end as Date) })),
        },
        existing?.id,
      );
      if (mounted.current) pop(true);
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e));
        setSaving(false);
      }
    }
  };

  const termRow = (i: number) => {
    const t = terms[i];
    const nameField = (
      <TextField value={t.name} onChangeText={(v) => setTerm(i, { name: v })} decoration={{ labelText: 'Term name', isDense: true }} />
    );
    const startBox = <DateBox label="Starts" value={t.start} fallback={start} onPicked={(d) => setTerm(i, { start: d })} />;
    const endBox = <DateBox label="Ends" value={t.end} fallback={start} onPicked={(d) => setTerm(i, { end: d })} />;
    const remove = (
      <IconButton
        tooltip={`Remove ${t.name}`}
        onPress={() => setTerms((prev) => prev.filter((_, j) => j !== i))}
        icon="close"
        size={18}
        color={AppTheme.textMuted}
      />
    );
    if (narrow) {
      return (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>{nameField}</View>
            {remove}
          </View>
          <View style={{ height: 8 }} />
          {startBox}
          <View style={{ height: 8 }} />
          {endBox}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 170 }}>{nameField}</View>
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>{startBox}</View>
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>{endBox}</View>
        {remove}
      </View>
    );
  };

  return (
    <Dialog radius={16} style={{ width: '100%', maxWidth: 680, maxHeight: height * 0.88 }}>
      <View style={{ paddingLeft: 24, paddingTop: 22, paddingRight: 24, paddingBottom: 18, flexShrink: 1 }}>
        <Text style={ts({ size: 18, weight: 700 })}>{existing == null ? 'Add school year' : `Edit S.Y. ${existing.name}`}</Text>
        <View style={{ height: 16 }} />
        <ScrollView style={{ flexShrink: 1 }}>
          <TextField
            value={name}
            onChangeText={setName}
            decoration={{ labelText: 'School year', hintText: 'e.g. 2026-2027', isDense: true }}
          />
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <DateBox label="Starts" value={start} fallback={start} onPicked={setStart} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <DateBox label="Ends" value={end} fallback={start} onPicked={setEnd} />
            </View>
          </View>
          <View style={{ height: 20 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[ts({ size: 14, weight: 700 }), { flex: 1 }]}>Terms</Text>
            <TextButton onPress={addTerm} icon="add" iconSize={16}>Add term</TextButton>
          </View>
          <Text style={TextStyles.bodySm}>Terms must fall inside the school year and must not overlap.</Text>
          <View style={{ height: 10 }} />
          {terms.map((_, i) => (
            <View key={i} style={{ paddingBottom: 12 }}>{termRow(i)}</View>
          ))}
        </ScrollView>
        {error != null && (
          <>
            <View style={{ height: 8 }} />
            <Text style={ts({ color: AppTheme.redColor, size: 13 })}>{error}</Text>
          </>
        )}
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <TextButton onPress={() => pop(false)}>Cancel</TextButton>
          <View style={{ width: 8 }} />
          <FilledButton onPress={saving ? null : save} backgroundColor={AppTheme.darkBanner}>
            {saving ? (
              <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" />
            ) : existing == null ? (
              'Add school year'
            ) : (
              'Save changes'
            )}
          </FilledButton>
        </View>
      </View>
    </Dialog>
  );
}

/// Principal/admin page for setting when each school year and its terms start
/// and end. Tasks, events and appraisal records dated in a school year that
/// has ended are archived: lists show the current year by default, and older
/// years stay viewable from each page's school-year selector.
export default function SchoolYearsScreen() {
  const isMobile = useIsMobile();
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const y = await ApiService.getSchoolYears();
      if (mounted.current) {
        setYears(y);
        setLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e));
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, []);

  const edit = async (year: SchoolYear | null = null) => {
    const saved = await showDialog<boolean>((pop) => <SchoolYearDialog existing={year} pop={pop} />);
    if (saved === true) {
      load();
      if (mounted.current) {
        showSnackBar(year == null ? 'School year added.' : 'School year updated.', { backgroundColor: '#16A34A' });
      }
    }
  };

  const remove = async (year: SchoolYear) => {
    const ok = await showDialog<boolean>((pop) => (
      <AlertDialog
        title={`Remove S.Y. ${year.name}?`}
        content={
          'Only the calendar entry is removed. Tasks, events and appraisal records ' +
          'are kept; they just stop being grouped under this school year.'
        }
        actions={
          <>
            <TextButton onPress={() => pop(false)}>Keep it</TextButton>
            <FilledButton backgroundColor={AppTheme.redColor} onPress={() => pop(true)}>{`Remove S.Y. ${year.name}`}</FilledButton>
          </>
        }
      />
    ));
    if (ok !== true) return;
    try {
      await ApiService.deleteSchoolYear(year.id);
      load();
    } catch (e) {
      if (mounted.current) showSnackBar(errorMessage(e), { backgroundColor: AppTheme.redColor });
    }
  };

  const side = isMobile ? 16 : 24;
  return (
    <ScrollView contentContainerStyle={{ paddingLeft: side, paddingTop: 8, paddingRight: side, paddingBottom: 24 }}>
      <AppBanner
        title="School Year"
        subtitle={
          'Set when each school year and term starts and ends. Records from ' +
          'school years that have ended are archived automatically.'
        }
      />
      <View style={{ height: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[ts({ size: 18, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>School years</Text>
        <FilledButton onPress={() => edit()} backgroundColor={AppTheme.darkBanner} icon="add" iconSize={18}>
          Add school year
        </FilledButton>
      </View>
      <View style={{ height: 12 }} />
      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <CircularProgressIndicator />
        </View>
      ) : error != null ? (
        <Card>
          <Text style={TextStyles.bodyMd}>{error}</Text>
        </Card>
      ) : years.length === 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="info_outline" size={24} color={AppTheme.textMuted} />
            <View style={{ width: 12 }} />
            <Text style={[TextStyles.bodyMd, { flex: 1 }]}>
              No school year set up yet, so nothing is archived. Add the current school year and its terms to start
              grouping tasks, events and appraisals by year.
            </Text>
          </View>
        </Card>
      ) : (
        years.map((y) => (
          <View key={y.id} style={{ paddingBottom: 12 }}>
            <YearCard year={y} onEdit={() => edit(y)} onDelete={() => remove(y)} />
          </View>
        ))
      )}
    </ScrollView>
  );
}
