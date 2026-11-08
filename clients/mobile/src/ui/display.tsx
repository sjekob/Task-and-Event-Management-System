import { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { Button } from './controls';
import { FeatherName, Icon } from './icons';
import { T } from './text';
import { C, shadow, Tone, TONES } from './theme';

export function Card({ children, onPress, style, flat }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  const base: ViewStyle = { backgroundColor: C.card, borderRadius: 14, padding: 16, ...(flat ? { borderWidth: 1, borderColor: C.border } : shadow) };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }, style]}>{children}</Pressable>;
}

/** Dark page banner with a title and subtitle. */
export function Banner({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.dark, borderRadius: 16, padding: 20, gap: 4 }}>
      <T size={22} weight={800} color="#fff">{title}</T>
      {subtitle ? <T size={13} color="rgba(255,255,255,0.72)">{subtitle}</T> : null}
      {children}
    </View>
  );
}

export function Badge({ tone = 'gray', children, icon }: { tone?: Tone; children: ReactNode; icon?: FeatherName }) {
  const t = TONES[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <T size={11.5} weight={600} color={t.fg}>{children}</T>
    </View>
  );
}

export function Spinner({ color = C.accent }: { color?: string }) {
  return <ActivityIndicator color={color} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
      <Spinner />
      {label ? <T size={13} color={C.muted}>{label}</T> : null}
    </View>
  );
}

export function Empty({ icon = 'inbox', title, children }: { icon?: FeatherName; title: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <Icon name={icon} size={40} color={C.light} />
      <T weight={600} center>{title}</T>
      {typeof children === 'string' ? <T size={13} color={C.muted} center>{children}</T> : children}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ backgroundColor: C.redBg, borderRadius: 12, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="alert-circle" size={18} color={C.redDark} />
        <T weight={600} color={C.redDark} style={{ flex: 1 }}>{message}</T>
      </View>
      {onRetry && <Button variant="danger" size="sm" icon="refresh-cw" onPress={onRetry} style={{ alignSelf: 'flex-start' }}>Retry</Button>}
    </View>
  );
}

export function Avatar({ url, initials, size = 40, bg = C.sidebarActive }: { url?: string | null; initials: string; size?: number; bg?: string }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.border }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size * 0.4} weight={700} color="#fff">{initials}</T>
    </View>
  );
}

/** Skeleton placeholder block. */
export function Bone({ w = '100%', h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#e8edf5' }, style]} />;
}

export function Progress({ value, color = C.accent }: { value: number; color?: string }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: '#e8edf5', overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, height: 6, backgroundColor: color }} />
    </View>
  );
}

export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => <View style={[{ height: 1, backgroundColor: C.border }, style]} />;

/** Label + value pair used in detail cards. */
export function Info({ label, value, icon }: { label: string; value?: ReactNode; icon?: FeatherName }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      {icon && <Icon name={icon} size={16} color={C.muted} />}
      <View style={{ flex: 1 }}>
        <T size={11.5} color={C.muted}>{label}</T>
        {typeof value === 'string' || typeof value === 'number' ? <T size={14} weight={600}>{value}</T> : value}
      </View>
    </View>
  );
}

/** Tinted square holding an icon. */
export function IconTile({ name, tone = 'blue', size = 40 }: { name: FeatherName; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.48} color={t.fg} />
    </View>
  );
}
