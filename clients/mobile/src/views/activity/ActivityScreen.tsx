import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { ActivityController } from '@shared/controllers/ActivityController';
import { EventItem } from '@shared/models';
import { EventFormat } from '@shared/utils/eventFormat';
import { Format } from '@shared/utils/format';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Badge, Banner, Bone, Button, C, Card, Empty, Icon, IconButton, Modal, Row, Screen, T, Tone } from '../../ui/kit';
import { SchoolYearPicker } from '../common/SchoolYearPicker';

export function EventStatusChip({ status }: { status: string }) {
  return <Badge tone={ActivityController.statusTone(status) as Tone}>{ActivityController.statusLabel(status)}</Badge>;
}

/** /activity: every scheduled event, read-only. */
export default function ActivityScreen() {
  const services = useServices();
  const [c, s] = useScreenController(() => new ActivityController(services), []);
  useEffect(() => { void c.load(); }, [c]);
  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title="Activity Calendar" subtitle="View all scheduled events and activities." />
      <Card>
        <Row wrap style={{ marginBottom: 8 }}>
          <T size={16} weight={700} style={{ flex: 1 }}>{c.heading}</T>
          <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
          <IconButton name="refresh-cw" size={18} label="Refresh" onPress={() => void c.load()} />
        </Row>
        {s.loading ? [0, 1, 2, 3].map((i) => <Bone key={i} h={50} style={{ marginBottom: 8 }} />)
          : s.error ? (
            <Empty icon="alert-circle" title="Failed to load events">
              <T size={13} color={C.muted} center>{s.error}</T>
              <Button variant="ghost" onPress={() => void c.load()}>Retry</Button>
            </Empty>
          ) : s.events.length === 0 ? <Empty icon="calendar" title="No events yet" />
          : s.events.map((e) => (
            <Pressable key={e.id} onPress={() => c.open(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.border }}>
              <Icon name="book-open" size={16} color={C.light} />
              <View style={{ flex: 1 }}>
                <T weight={600} lines={1}>{e.title || 'Untitled'}</T>
                <T size={12} color={C.muted} lines={1}>{[e.targetDate ? Format.date(e.targetDate, e.targetDate) : '', e.venue ?? ''].filter(Boolean).join('  ·  ')}</T>
              </View>
              <EventStatusChip status={e.status} />
            </Pressable>
          ))}
      </Card>
      {s.open && <EventDetailDialog event={s.open} onClose={() => c.open(null)} />}
    </Screen>
  );
}

/** Read-only proposal details. */
export function EventDetailDialog({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const sec = EventFormat.sections(event.raw);
  const r = event.raw;
  return (
    <Modal title={event.title || 'Event Details'} subtitle={<EventStatusChip status={event.status} />} icon="calendar" onClose={onClose}>
      <Label>Event Information</Label>
      <InfoGrid items={sec.info} />
      {sec.focal.length > 0 && <><Label>Focal Person</Label><InfoGrid items={sec.focal} /></>}
      {sec.blocks.map((b) => (
        <View key={b.title} style={{ gap: 6 }}>
          <Label>{b.title}</Label>
          {b.phases ? b.phases.map((p) => (
            <View key={p.title} style={{ gap: 4 }}><T size={12} weight={500}>{p.title}</T><Block text={p.text} /></View>
          )) : <Block text={b.text} />}
        </View>
      ))}
      {EventFormat.has(r.creator_name) && (
        <Row gap={6} style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10 }}>
          <Icon name="user" size={14} color={C.light} />
          <T size={12} color={C.muted} style={{ flex: 1 }}>
            Created by {String(r.creator_name)}{EventFormat.has(r.creator_role) ? ` (${r.creator_role})` : ''}{EventFormat.has(r.created_at) ? ` · ${Format.date(String(r.created_at))}` : ''}
          </T>
        </Row>
      )}
    </Modal>
  );
}

const Label = ({ children }: { children: string }) => <T size={12.5} weight={600} color={C.accent} style={{ marginTop: 4 }}>{children}</T>;

function InfoGrid({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((i) => (
        <View key={i.label} style={{ width: '47%' }}>
          <T size={11.5} color={C.muted}>{i.label}</T>
          <T size={13.5} weight={600}>{i.value}</T>
        </View>
      ))}
    </View>
  );
}

const Block = ({ text }: { text: string }) => <T size={13} color={C.text2} style={{ backgroundColor: C.bg, borderRadius: 6, padding: 10 }}>{text}</T>;
