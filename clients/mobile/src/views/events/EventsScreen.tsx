import { ReactNode, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EventsController } from '@shared/controllers/EventControllers';
import { EventItem } from '@shared/models';
import { CalendarMonth } from '@shared/utils/calendar';
import { useServices, useSession } from '../../core/AppModel';
import { useLiveRefresh, useScreenController } from '../../core/hooks';
import { printProposal } from '../../core/printProposal';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Badge, Banner, Bone, Button, C, Card, IconButton, MenuItem, Row, Screen, T, Tabs } from '../../ui/kit';
import { MonthCalendar } from '../common/MonthCalendar';
import { SchoolYearPicker } from '../common/SchoolYearPicker';

/** /events: proposals by status, approval, drafts, and the month calendar (with DepEd dates). */
export default function EventsScreen() {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const { open } = useLocalSearchParams<{ open?: string }>();
  const [c, s] = useScreenController(() => new EventsController(services, user), [user?.id]);
  useEffect(() => { void c.load(); }, [c]);
  useLiveRefresh(() => void c.load());   // approvals and new proposals show up while open
  // /events?open=12 (notifications, dashboard): go straight to the detail.
  useEffect(() => { if (open) router.push({ pathname: '/event/[id]', params: { id: open } }); }, [open]);

  const show = (e: EventItem) => router.push({ pathname: '/event/[id]', params: { id: String(e.id) } });
  const edit = (e: EventItem) => router.push({ pathname: '/event-form', params: { id: String(e.id) } });
  const print = async (e: EventItem) => { try { await printProposal(e.raw); } catch (err) { fb.error(err); } };
  const run = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); fb.toast(done); } catch (e) { fb.error(e); } };
  const approve = async (e: EventItem) => { try { fb.toast(await c.approve(e), 'success'); } catch (err) { fb.error(err); } };
  const disable = async (e: EventItem) => {
    if (await fb.confirm({ title: 'Confirm Disable', message: `Disable "${e.title}"?`, confirmLabel: 'Disable', danger: true })) await run(() => c.disable(e), 'Event disabled');
  };
  const removeDraft = async (e: EventItem) => {
    const t = e.title.trim() || 'Untitled Draft';
    if (await fb.confirm({ title: 'Delete Draft', message: `Delete "${t}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) await run(() => c.deleteDraft(e), 'Draft deleted');
  };
  const month = CalendarMonth.of(s.month);
  const pendingMenu = (e: EventItem): MenuItem[] => (c.isPrincipal && c.canApprove
    ? [
      { label: 'Approve', icon: 'check-circle', onPress: () => void approve(e) },
      // Sending a proposal back needs a comment: written on the detail page.
      { label: 'Request revisions or reject…', icon: 'corner-up-left', onPress: () => show(e) },
      { label: 'Disable', icon: 'slash', danger: true, onPress: () => void disable(e) },
    ]
    : c.canManage ? [{ label: 'Edit', icon: 'edit-2', onPress: () => edit(e) }] : []);

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => c.load()} style={{ paddingBottom: 96 }}>
        <Banner title="Event Calendar" subtitle="Great things are on the horizon — stay active, stay organized!" />
        <Tabs value={s.tab} onChange={(t) => c.setTab(t)} tabs={[{ value: 0 as const, label: 'All Events' }, ...(!c.isPrincipal ? [{ value: 1 as const, label: 'My Events' }] : [])]} />
        <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
        {s.loading ? [0, 1, 2].map((i) => <Bone key={i} h={74} r={14} />) : (
          <>
            {!s.events.length && <Card><T color={C.muted} center>No events yet.</T></Card>}
            {c.approved.length > 0 && <Section label="Upcoming / Approved Events">{c.approved.map((e) => <EventCard key={e.id} e={e} onTap={() => show(e)} onPrint={() => void print(e)} />)}</Section>}
            {c.completed.length > 0 && <Section label="Completed Events">{c.completed.map((e) => <EventCard key={e.id} e={e} onTap={() => show(e)} onPrint={() => void print(e)} />)}</Section>}
            {c.pending.length > 0 && <Section label="Pending Approval">{c.pending.map((e) => <EventCard key={e.id} e={e} onTap={() => show(e)} onPrint={() => void print(e)} menu={pendingMenu(e)} />)}</Section>}
            {c.returned.length > 0 && <Section label={c.isPrincipal ? 'Returned to Proponents' : 'Returned for Revision'}>{c.returned.map((e) => (
              <EventCard key={e.id} e={e} onTap={() => show(e)} onPrint={() => void print(e)}
                menu={!c.isPrincipal && c.canManage && e.createdBy === user?.id ? [{ label: 'Revise & resubmit', icon: 'edit-2', onPress: () => edit(e) }] : undefined} />
            ))}</Section>}
            {c.disabled.length > 0 && s.tab === 0 && <Section label="Disabled Events">{c.disabled.map((e) => (
              <EventCard key={e.id} e={e} off onTap={() => show(e)} onPrint={() => void print(e)}
                menu={c.canManage ? [{ label: 'Enable', icon: 'rotate-ccw', onPress: () => void run(() => c.enable(e), 'Event enabled') }] : []} />
            ))}</Section>}
            {c.drafts.length > 0 && <Section label="Drafts">{c.drafts.map((e) => (
              <Card key={e.id} flat style={{ gap: 6 }}>
                <Row><T weight={700} style={{ flex: 1 }} lines={1}>{e.title.trim() || 'Untitled Draft'}</T><Badge>Draft</Badge></Row>
                <T size={12.5} color={C.muted}>Continue where you left off.</T>
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onPress={() => edit(e)}>Continue Editing</Button>
                  <IconButton name="trash-2" size={18} label="Delete draft" color={C.red} onPress={() => void removeDraft(e)} />
                </Row>
              </Card>
            ))}</Section>}
          </>
        )}
        <Card>
          <MonthCalendar month={month} selected={s.selectedDay}
            onPrev={() => c.setMonth(new Date(month.prev().year, month.prev().month, 1))}
            onNext={() => c.setMonth(new Date(month.next().year, month.next().month, 1))}
            onSelect={(k) => c.selectDay(k)} details={(k) => c.dayTooltip(k)}
            dots={(k) => [(c.byDay.get(k) ?? []).length ? C.green : '', c.depedOn(k).length ? C.purple : ''].filter(Boolean)}
            legend={[{ color: C.green, label: 'Event' }, { color: C.purple, label: 'DepEd memo' }]} />
        </Card>
      </Screen>
      {c.canManage && (
        <Pressable onPress={() => router.push('/event-form')} accessibilityLabel="Add event"
          style={{ position: 'absolute', right: 18, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dark, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 }}>
          <T size={20} weight={700} color="#fff">+</T><T weight={700} color="#fff">Add Event</T>
        </Pressable>
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <View style={{ gap: 8 }}><T size={13} weight={700} color={C.text2}>{label}</T>{children}</View>;
}

function EventCard({ e, onTap, onPrint, menu, off }: { e: EventItem; onTap: () => void; onPrint: () => void; menu?: MenuItem[]; off?: boolean }) {
  return (
    <Card onPress={onTap} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Row gap={8}>
          <T weight={700} lines={1} color={off ? C.light : C.text} style={{ flexShrink: 1, textDecorationLine: off ? 'line-through' : 'none' }}>{e.title}</T>
          {off ? <Badge tone="red">Disabled</Badge> : <Badge tone={e.isApproved ? 'green' : e.isPending ? 'orange' : e.status === 'rejected' ? 'red' : e.isReturned ? 'orange' : 'gray'}>{e.isPending ? 'Pending' : e.statusLabel}</Badge>}
        </Row>
        <T size={12.5} color={C.muted} lines={2}>{EventsController.description(e)}</T>
        {e.creatorName ? <T size={11} color={C.light}>By {e.creatorName}</T> : null}
      </View>
      <IconButton name="printer" size={18} label="Print proposal" color={C.muted} onPress={onPrint} />
      {menu && <ActionMenu items={menu} />}
    </Card>
  );
}
