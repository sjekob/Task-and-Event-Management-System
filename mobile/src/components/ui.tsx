import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { initials } from '@tasknet/shared';
import { colors, radius, TONE_COLORS } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ── Feedback ────────────────────────────────────────────────────────────────

function show(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export const notifySuccess = (message: string) => show(message);
export const notifyError = (error: unknown, fallback = 'Something went wrong') =>
  show('Error', error instanceof Error ? error.message : fallback);

/** Resolves true when the person confirms. */
export function confirm(title: string, message: string, action = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: action, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** Scrollable page body with pull-to-refresh. */
export function Screen({ children, onRefresh, padded = true, edges }: {
  children: ReactNode; onRefresh?: () => Promise<unknown>; padded?: boolean; edges?: ('top' | 'bottom')[];
}) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = onRefresh ? async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  } : undefined;
  return (
    <SafeAreaView style={s.screen} edges={edges ?? []}>
      <ScrollView contentContainerStyle={[padded && s.padded]} keyboardShouldPersistTaps="handled"
        refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]}
      accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Gap({ size = 12 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

// ── Text ────────────────────────────────────────────────────────────────────

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'muted' | 'small' | 'label';
export function T({ v = 'body', style, children, ...rest }: TextProps & { v?: Variant; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[s.text, s[v], style]}>{children}</Text>;
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
      <T v="h3">{title}</T>
      {right}
    </Row>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

type ButtonKind = 'primary' | 'outline' | 'danger' | 'ghost' | 'success';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, small, style }: {
  title: string; onPress: () => void; kind?: ButtonKind; icon?: IconName; loading?: boolean; disabled?: boolean;
  small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.dark, fg: '#fff', border: colors.dark },
    success: { bg: colors.green, fg: '#fff', border: colors.green },
    danger: { bg: colors.red, fg: '#fff', border: colors.red },
    outline: { bg: '#fff', fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  }[kind];
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [s.button, small && s.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={palette.fg} size="small" />
        : icon && <Ionicons name={icon} size={small ? 15 : 18} color={palette.fg} />}
      <Text style={[s.buttonText, small && { fontSize: 13 }, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color = colors.text, size = 22 }: {
  icon: IconName; onPress: () => void; label: string; color?: string; size?: number;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityRole="button" hitSlop={10}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field({ label, style, ...props }: ComponentProps<typeof TextInput> & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label && <T v="label">{label}</T>}
      <TextInput placeholderTextColor={colors.light} {...props}
        style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]} />
    </View>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: {
  value: V; options: { value: V; label: string; count?: number }[]; onChange: (v: V) => void;
}) {
  return (
    <View style={s.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: active }}
            style={[s.segmentItem, active && s.segmentActive]}>
            <Text style={[s.segmentText, active && { color: '#fff' }]} numberOfLines={1}>
              {o.label}{o.count != null ? ` (${o.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Display ─────────────────────────────────────────────────────────────────

export function Pill({ label, tone = 'gray', color }: { label: string; tone?: string; color?: string }) {
  const t = color ? { fg: color, bg: `${color}1F` } : TONE_COLORS[tone] ?? TONE_COLORS.gray;
  return (
    <View style={[s.pill, { backgroundColor: t.bg }]}>
      <Text style={[s.pillText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>{initials({ full_name: name })}</Text>
    </View>
  );
}

export function StatTile({ value, label, icon, tone = 'blue' }: { value: ReactNode; label: string; icon: IconName; tone?: string }) {
  const t = TONE_COLORS[tone] ?? TONE_COLORS.gray;
  return (
    <View style={[s.card, { flex: 1, padding: 14, minWidth: 0 }]}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={t.fg} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 8 }}>{value}</Text>
      <T v="small" numberOfLines={1}>{label}</T>
    </View>
  );
}

export function InfoLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <Row gap={6} style={{ marginTop: 4 }}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <T v="small" style={{ flex: 1 }}>{children}</T>
    </Row>
  );
}

export function Loading() {
  return <View style={s.center}><ActivityIndicator size="large" color={colors.dark} /></View>;
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={[s.card, { margin: 16, gap: 10, borderColor: colors.redBg, borderWidth: 1 }]}>
      <Row><Ionicons name="alert-circle" size={20} color={colors.red} /><T v="h3">Couldn&apos;t load this</T></Row>
      <T v="muted">{error instanceof Error ? error.message : 'Unexpected error'}</T>
      {onRetry && <Button title="Try again" kind="outline" small onPress={onRetry} />}
    </View>
  );
}

export function Empty({ title, message, icon = 'file-tray-outline' }: { title: string; message?: string; icon?: IconName }) {
  return (
    <View style={[s.card, { alignItems: 'center', gap: 6, paddingVertical: 28 }]}>
      <Ionicons name={icon} size={34} color={colors.light} />
      <T v="h3">{title}</T>
      {message && <T v="muted" style={{ textAlign: 'center' }}>{message}</T>}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.bg },
  text: { color: colors.text, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '800' },
  h2: { fontSize: 19, fontWeight: '700' },
  h3: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15 },
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12.5, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, minHeight: 46, borderRadius: radius.md, borderWidth: 1,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: 12 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
  },
  segment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.dark },
  segmentText: { fontSize: 13.5, fontWeight: '600', color: colors.muted },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.xl, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
});
