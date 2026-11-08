import { ReactNode } from 'react';
import { View } from 'react-native';
import { EventItem, Json } from '@shared/models';
import { C, FeatherName, Icon, Row, T } from '../../ui/kit';

// Building blocks of the proposal view on phones.
export function StatusBadge({ e }: { e: EventItem }) {
  const [color, label] = [e.statusColor, e.isPending ? 'Pending' : e.statusLabel];
  return <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: `${color}22`, alignSelf: 'flex-start' }}><T size={12} weight={600} color={color}>{label}</T></View>;
}

export function Meta({ icon, text }: { icon: FeatherName; text: string }) {
  return <Row gap={6}><Icon name={icon} size={15} color="#718096" /><T size={13} color="#4a5568" style={{ flexShrink: 1 }}>{text}</T></Row>;
}

export function Panel({ icon, title, children, roman }: { icon: FeatherName; title: string; children: ReactNode; roman?: string }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 }}>
      <Row gap={8}>
        {roman ? <View style={{ backgroundColor: C.dark, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><T size={11} weight={700} color="#fff">{roman}</T></View> : null}
        <Icon name={icon} size={17} color="#4a5568" />
        <T size={15} weight={700} style={{ flex: 1 }}>{title}</T>
      </Row>
      {children}
    </View>
  );
}

export function FieldText({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <T size={12} weight={500} color="#718096">{label}</T>
      <T size={14} weight={600}>{value}</T>
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return <View style={{ gap: 4 }}>{items.map((l, i) => <Row key={i} gap={6} style={{ alignItems: 'flex-start' }}><T color="#718096">•</T><T size={14} style={{ flex: 1 }}>{l}</T></Row>)}</View>;
}

/** Table rows as stacked cards ("Column: value" per line) — readable on a phone. */
export function RowCards({ rows, cols, footer, raw }: { rows: Json[] | null; cols: [string, string][]; footer?: unknown[]; raw?: unknown }) {
  if (!rows) return raw ? <T size={13.5}>{String(raw)}</T> : null;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 10, gap: 3 }}>
          {cols.map(([k, h]) => (String(r[k] ?? '').trim()
            ? <Row key={k} gap={6} style={{ alignItems: 'flex-start' }}><T size={12} color={C.muted} style={{ width: 110 }}>{h}</T><T size={13} weight={500} style={{ flex: 1 }}>{String(r[k])}</T></Row>
            : null))}
        </View>
      ))}
      {footer && (
        <View style={{ backgroundColor: C.softBlue, borderRadius: 10, padding: 10, gap: 3 }}>
          {cols.map(([, h], i) => (i === 0 ? <T key={h} size={12.5} weight={700}>{String(footer[0] ?? '')}</T>
            : <Row key={h} gap={6}><T size={12} color={C.muted} style={{ width: 110 }}>{h}</T><T size={13} weight={700}>{String(footer[i] ?? '')}</T></Row>))}
        </View>
      )}
    </View>
  );
}
