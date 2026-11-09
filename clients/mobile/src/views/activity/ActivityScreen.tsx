import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { ActivityController } from '@shared/controllers/ActivityController';
import { EventItem } from '@shared/models';
import { EventFormat } from '@shared/utils/eventFormat';
import { Format } from '@shared/utils/format';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Badge, Banner, Bone, Button, C, Card, Empty, Icon, IconButton, Modal, Row, Screen, T, Tone } from '../../ui/kit';
import { SchoolYearPicker } from '../common/SchoolYearPicker';
import { FeatherName } from '../../ui/icons';

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

/** Read-only proposal details: overview tiles, then each part laid out for its kind of data (same structure as the web dialog). */
export function EventDetailDialog({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const d = EventFormat.details(event.raw);
  const r = event.raw;
  const date = d.facts.find((f) => f.key === 'date')?.value;
  const venue = d.facts.find((f) => f.key === 'venue')?.value;
  return (
    <Modal title={event.title || 'Event Details'} icon="calendar" onClose={onClose}
      subtitle={(
        <View style={{ gap: 6 }}>
          <EventStatusChip status={event.status} />
          {(date || venue) && (
            <Row gap={12} style={{ flexWrap: 'wrap' }}>
              {date && <Row gap={4}><Icon name="calendar" size={13} color={C.muted} /><T size={12.5} color={C.text2}>{date}</T></Row>}
              {venue && <Row gap={4}><Icon name="map-pin" size={13} color={C.muted} /><T size={12.5} color={C.text2}>{venue}</T></Row>}
            </Row>
          )}
        </View>
      )}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {d.facts.filter((f) => f.key !== 'date' && f.key !== 'venue').map((f) => (
          <Fact key={f.key} icon={FACT_ICON[f.key] ?? 'info'} label={f.label} value={f.value} />
        ))}
        {d.focal.name ? <Fact icon="user" label="Focal Person" value={d.focal.name} sub={[d.focal.role, d.focal.contact].filter(Boolean).join(' · ')} /> : null}
      </View>

      {d.participants.length > 0 && (
        <Section icon="users" title="Participants">
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' }}>
            <TableRow head cells={['Group', 'M', 'F', 'Total']} />
            {d.participants.map((p) => <TableRow key={p.category} cells={[p.category, String(p.male), String(p.female), String(p.total)]} />)}
            {d.totals && <TableRow total cells={['Total', String(d.totals.male), String(d.totals.female), String(d.totals.total)]} />}
          </View>
        </Section>
      )}

      {d.rationale ? <Section icon="book-open" title="Rationale"><T size={13.5} color={C.text2} style={{ lineHeight: 21 }}>{d.rationale}</T></Section> : null}
      {d.objectives.length > 0 && <Section icon="target" title="Objectives"><Bullets items={d.objectives} /></Section>}
      {d.outputs.length > 0 && <Section icon="package" title="Expected Outputs"><Bullets items={d.outputs} check /></Section>}

      {d.phases.length > 0 && (
        <Section icon="list" title="Implementation Phases">
          {d.phases.map((p, i) => (
            <Row key={i} gap={12} style={{ alignItems: 'flex-start', paddingBottom: i < d.phases.length - 1 ? 14 : 0 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12.5} weight={700} color="#fff">{String(i + 1)}</T>
              </View>
              <View style={{ flex: 1, gap: 4, paddingTop: 3 }}>
                <T size={13.5} weight={600}>{p.stage}</T>
                {p.activities.map((a) => <T key={a} size={13} color={C.text2}>•  {a}</T>)}
              </View>
            </Row>
          ))}
        </Section>
      )}

      {d.schedule.length > 0 && (
        <Section icon="clock" title="Activity Matrix">
          {d.schedule.map((g) => (
            <View key={g.day} style={{ gap: 6 }}>
              {g.day ? <T size={12} weight={700} color={C.accent}>{g.day}</T> : null}
              {g.items.map((it, i) => (
                <View key={i} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, gap: 2 }}>
                  <T size={12} weight={600} color={C.muted}>{it.time}</T>
                  <T size={13.5} weight={600}>{it.activity}</T>
                  {it.speaker ? <T size={12.5} color={C.text2}>{it.speaker}</T> : null}
                </View>
              ))}
            </View>
          ))}
        </Section>
      )}

      {d.executives.length > 0 && (
        <Section icon="award" title="Executive Committee">
          {d.executives.map((m) => <Person key={m.name + m.role} name={m.name} role={m.role} />)}
        </Section>
      )}

      {d.groups.length > 0 && (
        <Section icon="users" title="Technical Working Groups">
          {d.groups.map((g) => (
            <View key={g.title} style={{ gap: 6 }}>
              <T size={13} weight={600}>{g.title || 'Group'}</T>
              {g.members.map((m) => <Person key={m.name + m.role} name={m.name} role={m.role} />)}
            </View>
          ))}
        </Section>
      )}

      {(d.monitoring || d.indicators.length > 0) && (
        <Section icon="clipboard" title="Monitoring and Evaluation">
          {d.monitoring ? <T size={13.5} color={C.text2} style={{ lineHeight: 21 }}>{d.monitoring}</T> : null}
          {d.indicators.length > 0 && (
            <View style={{ gap: 4 }}>
              <T size={12} weight={600} color={C.muted}>Evaluation indicators</T>
              {d.indicators.map((x, i) => <T key={x} size={13.5} color={C.text2}>{`${i + 1}.  ${x}`}</T>)}
            </View>
          )}
        </Section>
      )}

      {d.signatories.length > 0 && (
        <Section icon="edit-3" title="Signatories">
          {d.signatories.map((x) => (
            <View key={x.name + x.role} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' }}>
              <T size={11} weight={600} color={C.muted}>{x.role.toUpperCase()}</T>
              <View style={{ alignSelf: 'stretch', marginTop: 14, borderTopWidth: 1, borderColor: C.text2, paddingTop: 6, alignItems: 'center' }}>
                <T size={14} weight={700}>{x.name}</T>
                {x.title ? <T size={12} color={C.text2}>{x.title}</T> : null}
              </View>
            </View>
          ))}
        </Section>
      )}

      {EventFormat.has(r.creator_name) && (
        <Row gap={6} style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10 }}>
          <Icon name="user" size={14} color={C.light} />
          <T size={12} color={C.muted} style={{ flex: 1 }}>
            Proposed by {String(r.creator_name)}{EventFormat.has(r.creator_role) ? ` (${r.creator_role})` : ''}{EventFormat.has(r.created_at) ? ` · ${Format.date(String(r.created_at))}` : ''}
          </T>
        </Row>
      )}
    </Modal>
  );
}

const FACT_ICON: Record<string, FeatherName> = { nature: 'tag', fund: 'briefcase', budget: 'credit-card' };

function Fact({ icon, label, value, sub }: { icon: FeatherName; label: string; value: string; sub?: string }) {
  return (
    <View style={{ width: '48%', flexGrow: 1, flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.surface2 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={15} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={10.5} weight={600} color={C.muted}>{label.toUpperCase()}</T>
        <T size={13.5} weight={600}>{value}</T>
        {sub ? <T size={11.5} color={C.text2}>{sub}</T> : null}
      </View>
    </View>
  );
}

function Section({ icon, title, children }: { icon: FeatherName; title: string; children: React.ReactNode }) {
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 14, gap: 10 }}>
      <Row gap={8}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={14} color={C.accent} />
        </View>
        <T size={14} weight={700}>{title}</T>
      </Row>
      {children}
    </View>
  );
}

function Bullets({ items, check }: { items: string[]; check?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((x) => (
        <Row key={x} gap={8} style={{ alignItems: 'flex-start' }}>
          {check ? <Icon name="check-circle" size={15} color={C.greenDark} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginTop: 7 }} />}
          <T size={13.5} color={C.text2} style={{ flex: 1 }}>{x}</T>
        </Row>
      ))}
    </View>
  );
}

function TableRow({ cells, head, total }: { cells: string[]; head?: boolean; total?: boolean }) {
  return (
    <Row style={{ backgroundColor: head || total ? C.surface2 : C.card, borderTopWidth: head ? 0 : 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 10 }}>
      {cells.map((x, i) => (
        <T key={i} size={head ? 11 : 13} weight={head || total ? 700 : 400} color={head ? C.muted : C.text}
          style={{ flex: i === 0 ? 2 : 1, textAlign: i === 0 ? 'left' : 'right' }}>{head ? x.toUpperCase() : x}</T>
      ))}
    </Row>
  );
}

function Person({ name, role }: { name: string; role: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <Row gap={10} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <T size={12} weight={700} color="#fff">{initials}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T size={13.5} weight={600} lines={1}>{name}</T>
        {role ? <T size={12} color={C.muted} lines={1}>{role}</T> : null}
      </View>
    </Row>
  );
}
