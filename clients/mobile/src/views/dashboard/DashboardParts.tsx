import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Tone } from '@shared/controllers/DashboardController';
import { Format } from '@shared/utils/format';
import { Bone, C, Card, FeatherName, Icon, T } from '../../ui/kit';

// KPI tiles, section cards and row pieces of the dashboard.
export const DASH_TONES: Record<Tone, { fg: string; bg: string; dot: string }> = {
  red: { fg: C.redDark, bg: C.redBg, dot: C.red },
  amber: { fg: C.amberDark, bg: C.amberBg, dot: C.amber },
  blue: { fg: C.accent, bg: C.blueBg, dot: C.accent },
  gray: { fg: C.muted, bg: '#FBEFDB', dot: C.light },
  green: { fg: '#16a34a', bg: C.greenBg, dot: C.green },
};

export function Kpi({ value, label, caption, icon, tone, alert, onPress }: {
  value: number; label: string; caption: string; icon: FeatherName; tone: Tone; alert?: boolean; onPress: () => void;
}) {
  const t = DASH_TONES[tone];
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T size={24} weight={800} color={alert ? t.fg : C.text}>{value}</T>
          <T size={14} weight={600}>{label}</T>
        </View>
        <T size={12} color={C.muted} lines={1}>{caption}</T>
      </View>
      <Icon name="chevron-right" size={20} color={C.light} />
    </Card>
  );
}

export function Section({ icon, title, count, action, onAction, empty, footer, children }: {
  icon: FeatherName; title: string; count: number; action: string; onAction: () => void;
  empty?: { icon: FeatherName; text: string }; footer?: string; children?: ReactNode;
}) {
  return (
    <Card style={{ padding: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={17} />
        </View>
        <T size={15} weight={700} lines={1} style={{ flexShrink: 1 }}>{title}</T>
        {count > 0 && <View style={{ backgroundColor: C.softBlue, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}><T size={12} weight={700}>{count}</T></View>}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onAction} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T size={12.5} weight={600} color={C.text}>{action}</T>
          <Icon name="arrow-right" size={15} color={C.text} />
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: C.border }} />
      {empty ? (
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' }}>
          <Icon name={empty.icon} size={19} color={C.light} />
          <T size={13} color={C.muted} style={{ flex: 1 }}>{empty.text}</T>
        </View>
      ) : <View>{children}</View>}
      {footer ? <T size={12} color={C.muted} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{footer}</T> : null}
    </Card>
  );
}

export function DashRow({ leading, title, meta, trailing, onPress }: { leading: ReactNode; title: string; meta: string; trailing: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? C.surface2 : 'transparent', borderBottomWidth: 1, borderColor: '#FBEFDB' })}>
      {leading}
      <View style={{ flex: 1 }}>
        <T size={14} weight={600} lines={2}>{title}</T>
        {meta ? <T size={12} color={C.muted} lines={1}>{meta}</T> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = DASH_TONES[tone];
  return <View style={{ backgroundColor: t.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}><T size={11.5} weight={600} color={t.fg}>{children}</T></View>;
}

export function StatusDot({ tone }: { tone: Tone }) {
  const c = DASH_TONES[tone].dot;
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, borderWidth: 3, borderColor: `${c}40` }} />;
}

export function MiniProgress({ done, total }: { done: number; total: number }) {
  const complete = done >= total;
  return (
    <View style={{ width: 92, alignItems: 'flex-end', gap: 5 }}>
      <T size={11.5} weight={600} color={complete ? '#16a34a' : C.muted}>{done}/{total} submitted</T>
      <View style={{ width: '100%', height: 5, borderRadius: 3, backgroundColor: C.softBlue, overflow: 'hidden' }}>
        <View style={{ height: 5, width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: complete ? C.green : C.accent }} />
      </View>
    </View>
  );
}

export function DateTile({ date, compact }: { date: Date | null; compact?: boolean }) {
  const size = compact ? 38 : 44;
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }}>
      {date ? (
        <>
          <T size={compact ? 9 : 10} weight={700} color={C.accent} style={{ lineHeight: 12 }}>{Format.months[date.getMonth()].toUpperCase()}</T>
          <T size={compact ? 14 : 16} weight={800} style={{ lineHeight: 19 }}>{date.getDate()}</T>
        </>
      ) : <Icon name="calendar" size={18} color={C.muted} />}
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <Bone h={96} r={16} />
      <Bone h={72} r={14} /><Bone h={72} r={14} /><Bone h={72} r={14} />
      <Bone h={220} r={14} />
    </View>
  );
}
