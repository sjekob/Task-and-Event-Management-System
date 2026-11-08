import { createElement, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Format } from '@shared/utils/format';
import { inputStyle } from './controls';
import { Icon } from './icons';
import { T } from './text';
import { C, FONT } from './theme';

/**
 * A date ("YYYY-MM-DD") or time ("h:mm AM") field. Phones use the native
 * picker; the Expo web preview uses the browser's own input.
 */
export function DateField({ value, onChange, mode = 'date', placeholder, min, clearable }: {
  value: string | null; onChange: (v: string | null) => void; mode?: 'date' | 'time'; placeholder?: string; min?: string | null; clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    const webValue = mode === 'time' && value ? Format.to24h(value) : value ?? '';
    return createElement('input', {
      type: mode, value: webValue, min: mode === 'date' ? min ?? undefined : undefined,
      onChange: (e: { target: { value: string } }) => {
        const v = e.target.value;
        onChange(!v ? null : mode === 'time' ? Format.to12h(v) : v);
      },
      // A DOM input: plain CSS, not React Native style props.
      style: {
        border: `1px solid ${C.borderStrong}`, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: FONT[400],
        color: C.text, background: '#fff', width: '100%', boxSizing: 'border-box', outline: 'none',
      },
    });
  }

  const date = toDate(value, mode);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={17} color={C.muted} />
        <T style={{ flex: 1 }} color={value ? C.text : C.light}>{value ? (mode === 'date' ? Format.longDate(value) ?? value : value) : placeholder ?? (mode === 'date' ? 'Select date' : 'Select time')}</T>
        {clearable && value ? <Pressable hitSlop={8} onPress={() => onChange(null)}><Icon name="x" size={16} color={C.muted} /></Pressable> : null}
      </Pressable>
      {open && (
        <DateTimePicker
          value={date}
          mode={mode}
          minimumDate={mode === 'date' && min ? new Date(`${min}T00:00:00`) : undefined}
          onChange={(e, d) => {
            setOpen(Platform.OS === 'ios');
            if (e.type === 'dismissed' || !d) return;
            onChange(mode === 'date' ? Format.isoDate(d) : Format.to12h(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`));
          }}
        />
      )}
    </View>
  );
}

function toDate(value: string | null, mode: 'date' | 'time'): Date {
  if (!value) return new Date();
  if (mode === 'date') return new Date(`${value}T00:00:00`);
  const [h, m] = Format.to24h(value).split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
