import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Scheme, fontFamily, tsPlain, withOpacity } from '../../theme/appTheme';
import { Icon } from './Icon';
import { IconButton, TextButton } from './buttons';
import { Dialog, showDialog } from './overlay';

// ── Material 3 date and time pickers (showDatePicker / showTimePicker) ───────

export interface PickerColors {
  primary: string;
  onPrimary: string;
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  fieldFill: string;
  primaryContainer: string;
}

/// `ColorScheme.light(primary: ...)`, the scheme the screens wrap their
/// pickers in.
export function lightPickerColors(primary: string): PickerColors {
  return {
    primary,
    onPrimary: '#FFFFFF',
    surface: '#FFFFFF',
    onSurface: '#000000',
    onSurfaceVariant: '#000000',
    outline: '#000000',
    outlineVariant: withOpacity('#000000', 0.12),
    fieldFill: withOpacity('#000000', 0.08),
    primaryContainer: withOpacity(primary, 0.12),
  };
}

/// The app theme's picker colours, for pickers shown without an override.
export const themePickerColors: PickerColors = {
  primary: Scheme.primary,
  onPrimary: Scheme.onPrimary,
  surface: Scheme.surfaceContainerHigh,
  onSurface: Scheme.onSurface,
  onSurfaceVariant: Scheme.onSurfaceVariant,
  outline: Scheme.outline,
  outlineVariant: Scheme.outlineVariant,
  fieldFill: Scheme.surfaceContainerHighest,
  primaryContainer: Scheme.primaryContainer,
};

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

interface DatePickerOptions {
  initialDate?: Date;
  firstDate: Date;
  lastDate: Date;
  colors: PickerColors;
  helpText?: string;
  /// Days this returns false for are greyed out and cannot be picked.
  selectableDayPredicate?: (day: Date) => boolean;
}

function DatePickerDialog({ opts, pop }: { opts: DatePickerOptions; pop: (d?: Date) => void }) {
  const { colors: c } = opts;
  const first = dateOnly(opts.firstDate);
  const last = dateOnly(opts.lastDate);
  const clamp = (d: Date) => (d < first ? first : d > last ? last : d);
  const [selected, setSelected] = useState(() => clamp(dateOnly(opts.initialDate ?? new Date())));
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [yearMode, setYearMode] = useState(false);
  const today = dateOnly(new Date());

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canPrev = new Date(month.getFullYear(), month.getMonth(), 0) >= first;
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= last;
  const years: number[] = [];
  for (let y = first.getFullYear(); y <= last.getFullYear(); y++) years.push(y);

  return (
    <Dialog backgroundColor={c.surface} radius={28} clip>
      <View style={{ width: 328, maxWidth: '100%' }}>
        {/* Header */}
        <View style={{ paddingLeft: 24, paddingTop: 16, paddingRight: 12, paddingBottom: 12 }}>
          <Text style={tsPlain({ size: 12, weight: 500, color: c.onSurfaceVariant, spacing: 0.5, height: 1.33 })}>
            {opts.helpText ?? 'Select date'}
          </Text>
          <View style={{ height: 36 }} />
          <Text style={tsPlain({ size: 32, color: c.onSurfaceVariant, height: 1.25 })}>
            {`${WEEKDAYS[selected.getDay()]}, ${MONTHS[selected.getMonth()]} ${selected.getDate()}`}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: c.outlineVariant }} />

        {/* Month / year switcher */}
        <View style={styles.monthBar}>
          <Pressable onPress={() => setYearMode((v) => !v)} style={styles.monthToggle}>
            <Text style={tsPlain({ size: 14, weight: 500, color: c.onSurfaceVariant, spacing: 0.1 })}>
              {`${MONTHS_LONG[month.getMonth()]} ${month.getFullYear()}`}
            </Text>
            <Icon name={yearMode ? 'arrow_drop_up' : 'arrow_drop_down'} size={24} color={c.onSurfaceVariant} />
          </Pressable>
          <View style={{ flex: 1 }} />
          {!yearMode && (
            <>
              <IconButton
                icon="chevron_left"
                color={c.onSurfaceVariant}
                tooltip="Previous month"
                onPress={canPrev ? () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)) : null}
              />
              <IconButton
                icon="chevron_right"
                color={c.onSurfaceVariant}
                tooltip="Next month"
                onPress={canNext ? () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)) : null}
              />
            </>
          )}
        </View>

        {yearMode ? (
          <ScrollView style={{ height: 288 }} contentContainerStyle={styles.yearGrid}>
            {years.map((y) => {
              const isSelected = y === month.getFullYear();
              return (
                <Pressable
                  key={y}
                  onPress={() => {
                    setMonth(clamp(new Date(y, month.getMonth(), 1)));
                    setYearMode(false);
                  }}
                  style={styles.yearCell}
                >
                  <View
                    style={[
                      styles.yearPill,
                      isSelected && { backgroundColor: c.primary },
                      !isSelected && y === today.getFullYear() && { borderWidth: 1, borderColor: c.primary },
                    ]}
                  >
                    <Text
                      style={tsPlain({
                        size: 16,
                        color: isSelected ? c.onPrimary : y === today.getFullYear() ? c.primary : c.onSurfaceVariant,
                        spacing: 0.5,
                      })}
                    >
                      {`${y}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ height: 288, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAY_LETTERS.map((d, i) => (
                <View key={i} style={styles.dayCell}>
                  <Text style={tsPlain({ size: 16, color: c.onSurface, spacing: 0.5 })}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: firstWeekday + daysInMonth }, (_, i) => {
                if (i < firstWeekday) return <View key={i} style={styles.dayCell} />;
                const date = new Date(month.getFullYear(), month.getMonth(), i - firstWeekday + 1);
                const enabled = date >= first && date <= last && (opts.selectableDayPredicate?.(date) ?? true);
                const isSelected = sameDay(date, selected);
                const isToday = sameDay(date, today);
                return (
                  <Pressable
                    key={i}
                    disabled={!enabled}
                    onPress={() => setSelected(date)}
                    style={[styles.dayCell, enabled && ({ cursor: 'pointer' } as ViewStyle)]}
                  >
                    {({ hovered }: { hovered?: boolean }) => (
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && { backgroundColor: c.primary },
                          !isSelected && isToday && { borderWidth: 1, borderColor: c.primary },
                          !isSelected && hovered && enabled && { backgroundColor: withOpacity('#000000', 0.08) },
                        ]}
                      >
                        <Text
                          style={tsPlain({
                            size: 16,
                            color: !enabled
                              ? withOpacity('#000000', 0.38)
                              : isSelected ? c.onPrimary : isToday ? c.primary : c.onSurface,
                            spacing: 0.5,
                          })}
                        >
                          {`${date.getDate()}`}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TextButton onPress={() => pop()} foregroundColor={c.primary}>Cancel</TextButton>
          <TextButton onPress={() => pop(selected)} foregroundColor={c.primary}>OK</TextButton>
        </View>
      </View>
    </Dialog>
  );
}

export function showDatePicker(opts: DatePickerOptions): Promise<Date | undefined> {
  return showDialog<Date>((pop) => <DatePickerDialog opts={opts} pop={pop} />);
}

// ── Time picker (text-input entry mode) ──────────────────────────────────────

export interface TimeOfDay {
  hour: number; // 0–23
  minute: number;
}

export const timeOfDayNow = (): TimeOfDay => {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
};

/// `TimeOfDay.hourOfPeriod`, shown as 12 at midnight and noon.
export function formatTimeOfDay(t: TimeOfDay): string {
  const hourOfPeriod = t.hour % 12;
  const h = hourOfPeriod === 0 ? 12 : hourOfPeriod;
  return `${h}:${`${t.minute}`.padStart(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}`;
}

interface TimePickerOptions {
  initialTime: TimeOfDay;
  colors: PickerColors;
  helpText?: string;
}

function TimeField({ value, onChange, label, colors: c, autoFocus, error }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  colors: PickerColors;
  autoFocus?: boolean;
  error: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        autoFocus={autoFocus}
        selectTextOnFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            width: 96,
            height: 72,
            borderRadius: 8,
            textAlign: 'center',
            fontFamily: fontFamily(400),
            fontSize: 45,
            color: error ? '#B00020' : focused ? c.primary : c.onSurface,
            backgroundColor: focused ? c.primaryContainer : c.fieldFill,
            borderWidth: focused || error ? 2 : 0,
            borderColor: error ? '#B00020' : c.primary,
            padding: 0,
          },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
      <View style={{ height: 7 }} />
      <Text style={tsPlain({ size: 12, color: c.onSurfaceVariant, spacing: 0.4, height: 1.33 })}>{label}</Text>
    </View>
  );
}

function TimePickerDialog({ opts, pop }: { opts: TimePickerOptions; pop: (t?: TimeOfDay) => void }) {
  const { colors: c, initialTime } = opts;
  const initialHour = initialTime.hour % 12 === 0 ? 12 : initialTime.hour % 12;
  const [hour, setHour] = useState(`${initialHour}`.padStart(2, '0'));
  const [minute, setMinute] = useState(`${initialTime.minute}`.padStart(2, '0'));
  const [pm, setPm] = useState(initialTime.hour >= 12);
  const [invalid, setInvalid] = useState(false);

  const confirm = () => {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (isNaN(h) || h < 1 || h > 12 || isNaN(m) || m < 0 || m > 59) {
      setInvalid(true);
      return;
    }
    pop({ hour: (h % 12) + (pm ? 12 : 0), minute: m });
  };

  const period = (label: string, isPm: boolean) => {
    const active = pm === isPm;
    return (
      <Pressable
        onPress={() => setPm(isPm)}
        style={[
          styles.period,
          { backgroundColor: active ? c.primaryContainer : 'transparent', cursor: 'pointer' } as ViewStyle,
        ]}
      >
        <Text style={tsPlain({ size: 16, weight: 500, color: active ? c.primary : c.onSurfaceVariant, spacing: 0.15 })}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Dialog backgroundColor={c.surface} radius={28}>
      <View style={{ width: 312, maxWidth: '100%', padding: 24, paddingBottom: 20 }}>
        <Text style={tsPlain({ size: 12, weight: 500, color: c.onSurfaceVariant, spacing: 0.5, height: 1.33 })}>
          {opts.helpText ?? 'Enter time'}
        </Text>
        <View style={{ height: 20 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TimeField value={hour} onChange={setHour} label="Hour" colors={c} autoFocus error={invalid} />
          <View style={{ width: 24, height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={tsPlain({ size: 45, color: c.onSurface })}>:</Text>
          </View>
          <TimeField value={minute} onChange={setMinute} label="Minute" colors={c} error={invalid} />
          <View style={{ width: 12 }} />
          <View style={[styles.periodBox, { borderColor: c.outline }]}>
            {period('AM', false)}
            <View style={{ height: 1, backgroundColor: c.outline }} />
            {period('PM', true)}
          </View>
        </View>
        {invalid && (
          <Text style={[tsPlain({ size: 12, color: '#B00020', spacing: 0.4, height: 1.33 }), { marginTop: 4 }]}>
            Enter a valid time
          </Text>
        )}
        <View style={{ height: 24 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <TextButton onPress={() => pop()} foregroundColor={c.primary}>Cancel</TextButton>
          <TextButton onPress={confirm} foregroundColor={c.primary}>OK</TextButton>
        </View>
      </View>
    </Dialog>
  );
}

export function showTimePicker(opts: TimePickerOptions): Promise<TimeOfDay | undefined> {
  return showDialog<TimeOfDay>((pop) => <TimePickerDialog opts={opts} pop={pop} />);
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingLeft: 16,
    paddingRight: 4,
  },
  monthToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    height: 40,
    cursor: 'pointer',
  } as ViewStyle,
  dayCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  yearCell: {
    width: `${100 / 3}%`,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as ViewStyle,
  yearPill: {
    width: 72,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  periodBox: {
    width: 52,
    height: 72,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  period: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
