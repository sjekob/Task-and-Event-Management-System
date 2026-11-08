import { ReactNode, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, Switch as RNSwitch, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Icon, FeatherName } from './icons';
import { Sheet } from './overlays';
import { T } from './text';
import { C, FONT } from './theme';

export type Variant = 'dark' | 'primary' | 'danger' | 'success' | 'outline' | 'outline-muted' | 'ghost' | 'ghost-danger';

const VARIANT: Record<Variant, { bg: string; fg: string; border?: string }> = {
  dark: { bg: C.dark, fg: '#fff' },
  primary: { bg: C.accent, fg: '#fff' },
  danger: { bg: C.red, fg: '#fff' },
  success: { bg: C.greenDark, fg: '#fff' },
  outline: { bg: '#fff', fg: C.accent, border: C.accent },
  'outline-muted': { bg: '#fff', fg: C.text, border: C.borderStrong },
  ghost: { bg: 'transparent', fg: C.accent },
  'ghost-danger': { bg: 'transparent', fg: C.red },
};

export function Button({ children, onPress, variant = 'dark', size, icon, loading, disabled, block, style }: {
  children?: ReactNode; onPress?: () => void; variant?: Variant; size?: 'sm' | 'lg'; icon?: FeatherName;
  loading?: boolean; disabled?: boolean; block?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANT[variant];
  const off = disabled || loading;
  const pad = size === 'sm' ? [6, 10] : size === 'lg' ? [13, 20] : [10, 16];
  return (
    <Pressable onPress={off ? undefined : onPress} accessibilityRole="button" accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9,
        paddingVertical: pad[0], paddingHorizontal: pad[1], backgroundColor: v.bg, borderWidth: v.border ? 1 : 0, borderColor: v.border,
        opacity: off ? 0.5 : pressed ? 0.85 : 1, alignSelf: block ? 'stretch' : 'auto',
      }, style]}>
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 17} color={v.fg} /> : null}
      {typeof children === 'string' ? <T size={size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5} weight={600} color={v.fg}>{children}</T> : children}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = C.text, size = 20, label, style, bg }: {
  name: FeatherName; onPress?: () => void; color?: string; size?: number; label: string; style?: StyleProp<ViewStyle>; bg?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [{ width: size + 18, height: size + 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? (pressed ? '#0000000f' : 'transparent') }, style]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Field({ label, required, help, error, children, style }: {
  label?: string; required?: boolean; help?: string; error?: string | null; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T size={13} weight={600}>{label}{required ? <T size={13} color={C.red}> *</T> : null}</T> : null}
      {children}
      {error ? <T size={12} color={C.red}>{error}</T> : help ? <T size={12} color={C.muted}>{help}</T> : null}
    </View>
  );
}

export const inputStyle = {
  backgroundColor: '#fff', borderWidth: 1, borderColor: C.borderStrong, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
  fontFamily: FONT[400], fontSize: 14, color: C.text,
} as const;

export function Input({ invalid, style, multiline, rows = 4, ...rest }: TextInputProps & { invalid?: boolean; rows?: number }) {
  return (
    <TextInput placeholderTextColor={C.light} multiline={multiline}
      style={[inputStyle, multiline && { minHeight: rows * 21 + 20, textAlignVertical: 'top' }, invalid && { borderColor: C.red }, style]} {...rest} />
  );
}

export interface Option<V> { value: V; label: string; hint?: string }

/** A dropdown: shows the chosen label and opens a sheet of options. */
export function Select<V extends string | number | null>({ value, options, onChange, placeholder = 'Select…', title, disabled }: {
  value: V; options: Option<V>[]; onChange: (v: V) => void; placeholder?: string; title?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable disabled={disabled} onPress={() => setOpen(true)} style={[inputStyle, { flexDirection: 'row', alignItems: 'center', opacity: disabled ? 0.6 : 1 }]}>
        <T style={{ flex: 1 }} color={current ? C.text : C.light} lines={1}>{current?.label ?? placeholder}</T>
        <Icon name="chevron-down" size={18} color={C.muted} />
      </Pressable>
      {open && (
        <Sheet title={title ?? placeholder} onClose={() => setOpen(false)}>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => (
              <Pressable key={String(o.value)} onPress={() => { onChange(o.value); setOpen(false); }}
                style={({ pressed }) => ({ paddingVertical: 13, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? C.surface2 : 'transparent', borderBottomWidth: 1, borderColor: C.border })}>
                <View style={{ flex: 1 }}>
                  <T weight={o.value === value ? 700 : 400}>{o.label}</T>
                  {o.hint ? <T size={12} color={C.muted}>{o.hint}</T> : null}
                </View>
                {o.value === value && <Icon name="check" size={18} color={C.accent} />}
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      )}
    </>
  );
}

export function Switch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <RNSwitch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.accent, false: C.borderStrong }} thumbColor="#fff" />;
}

/** Checkbox (or radio) with a label. */
export function Check({ checked, onChange, label, radio, disabled }: { checked: boolean; onChange: () => void; label?: ReactNode; radio?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onChange} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1, paddingVertical: 4 }}>
      <View style={{
        width: 20, height: 20, borderRadius: radio ? 10 : 5, borderWidth: 1.6, borderColor: checked ? C.accent : C.borderStrong,
        backgroundColor: checked ? C.accent : '#fff', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (radio ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : <Icon name="check" size={14} color="#fff" />)}
      </View>
      {typeof label === 'string' ? <T size={13.5} style={{ flexShrink: 1 }}>{label}</T> : label}
    </Pressable>
  );
}

/** Pill tabs (scrolls sideways when they don't fit). */
export function Tabs<V extends string | number>({ value, onChange, tabs }: { value: V; onChange: (v: V) => void; tabs: { value: V; label: string; count?: number }[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable key={String(t.value)} onPress={() => onChange(t.value)}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: on ? C.dark : '#fff', borderWidth: 1, borderColor: on ? C.dark : C.border }}>
            <T size={13} weight={600} color={on ? '#fff' : C.text2}>{t.label}{t.count !== undefined ? ` (${t.count})` : ''}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Search box with an icon. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0, borderColor: C.border }]}>
      <Icon name="search" size={18} color={C.light} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.light}
        style={{ flex: 1, paddingVertical: 11, fontFamily: FONT[400], fontSize: 14, color: C.text }} />
      {value ? <IconButton name="x" size={16} label="Clear" onPress={() => onChange('')} color={C.muted} /> : null}
    </View>
  );
}
