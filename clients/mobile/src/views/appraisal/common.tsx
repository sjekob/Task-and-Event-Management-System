import { memo, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { statusChip } from '@shared/controllers/AppraisalControllers';
import { Bone, Button, C, Card, Empty, FeatherName, Icon, Row, Select, T } from '../../ui/kit';

// Building blocks shared by the appraisal tabs.
export const TONE = { green: '#16a34a', orange: '#ea580c', red: '#ef4444', blue: '#3b82f6', yellow: '#ca8a04', text: C.text };

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Empty icon="alert-circle" title="Failed to load data">
      <T size={13} color={C.muted} center>{message}</T>
      <Button icon="refresh-cw" onPress={onRetry}>Retry</Button>
    </Empty>
  );
}

export const TabSkeleton = () => <View style={{ gap: 12 }}><Bone h={86} r={14} /><Bone h={86} r={14} /><Bone h={260} r={14} /></View>;

export const Stat = memo(function Stat({ value, label, sub, icon, color, bg, valueColor }: {
  value: string; label: string; sub?: string; icon: FeatherName; color: string; bg: string; valueColor?: string;
}) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, flexGrow: 1, flexBasis: '45%' }}>
      <View style={{ flex: 1 }}>
        <T size={24} weight={800} color={valueColor ?? C.text}>{value}</T>
        <T size={12} color={C.muted}>{label}</T>
        {sub ? <T size={11} color={C.muted}>{sub}</T> : null}
      </View>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={color} /></View>
    </Card>
  );
});

/** Wrapping grid of stat cards. */
export const StatGrid = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;

/** A filter dropdown with an "All" entry that resets it. */
export function FilterSelect({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string | null; onSelect: (v: string | null) => void }) {
  return (
    <View style={{ minWidth: 150, flexGrow: 1 }}>
      <Select<string | null> value={selected} placeholder={label} title={label} disabled={!options.length}
        options={[{ value: null, label }, ...options.map((o) => ({ value: o, label: o }))]} onChange={onSelect} />
    </View>
  );
}

export function Chip({ status }: { status: string }) {
  const c = statusChip(status);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: `${c.color}1f`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
      {c.icon ? <Icon name="check-circle" size={11} color={c.color} /> : null}
      <T size={11.5} weight={600} color={c.color}>{c.label}</T>
    </View>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <Row gap={onChange ? 6 : 0}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Pressable key={v} disabled={!onChange} onPress={() => onChange?.(v)} accessibilityLabel={`${v} star${v > 1 ? 's' : ''}`} hitSlop={4}>
          <T size={size} color={v <= value ? '#fbbf24' : '#cbd5e1'} style={{ lineHeight: size + 4 }}>★</T>
        </Pressable>
      ))}
    </Row>
  );
}

export function Mini({ label, value, icon }: { label: string; value: string; icon: FeatherName }) {
  return (
    <Row gap={8} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, flexGrow: 1, flexBasis: '30%' }}>
      <Icon name={icon} size={16} color={C.muted} />
      <View><T size={10} color={C.muted}>{label}</T><T size={13.5} weight={700}>{value}</T></View>
    </Row>
  );
}

/** "Label: value" line used in appraisal cards. */
export const Line = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <Row gap={6}><T size={12} color={C.muted} style={{ width: 92 }}>{label}</T><T size={12.5} weight={600} color={color ?? C.text} style={{ flex: 1 }} lines={1}>{value}</T></Row>
);
