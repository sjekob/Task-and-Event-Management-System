import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ProposalFormController, STEP_TITLES } from '@shared/controllers/EventControllers';
import { EventItem, Json } from '@shared/models';
import { useApp } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useDirty, useUnsavedGuard } from '../../core/unsaved';
import { useFeedback } from '../../ui/feedback';
import { Button, C, ErrorBox, Icon, Loading, Screen, T } from '../../ui/kit';
import { BriefStep } from './EventFormBrief';
import { ReturnedCard } from './EventReview';
import { ProposalUploadCard, ReadingCard } from './ProposalExtras';
import { BudgetStep, MatrixStep, MethodologyStep, MonitoringStep, RationaleStep } from './EventFormSteps';
import { SpecialTasksSheet } from './SpecialTasksSheet';

/** /event-form (new) and /event-form?id=… (edit). */
export default function EventFormScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<Json | null | undefined>(id ? undefined : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    app.services.events.get(Number(id)).then((e) => (e ? setExisting(e.raw) : setError('Event not found.'))).catch(() => setError('Event not found.'));
  }, [id, app]);
  if (error) return <Screen><ErrorBox message={error} /></Screen>;
  if (existing === undefined) return <Screen><Loading /></Screen>;
  return <ProposalForm existing={existing} />;
}

const STEPS = [BriefStep, RationaleStep, MethodologyStep, MatrixStep, BudgetStep, MonitoringStep];

function ProposalForm({ existing }: { existing: Json | null }) {
  const app = useApp();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ProposalFormController(app.services, app.session, existing), []);
  // Leaving with unsaved changes asks first (back arrow, Android back, swipe).
  const dirty = useDirty(s.d);
  const guard = useUnsavedGuard(dirty, {
    what: 'event proposal',
    onDiscard: () => c.discard(),
    saveLabel: c.isReturned ? 'Save changes' : 'Save draft',
    saveDraft: c.canSaveAsDraft ? async () => {
      const r = await c.submit(true);
      fb.toast(r.message, r.ok ? 'success' : 'error');
      return r.ok;
    } : undefined,
  });
  const leave = () => { guard.release(); if (router.canGoBack()) router.back(); else router.replace('/events'); };
  const send = async (asDraft = false) => {
    const r = await c.submit(asDraft);
    if (r.ok) { setReview(false); fb.toast(r.message, 'success'); leave(); } else fb.toast(r.message, 'error');
  };
  // Submitting (not saving a draft) first shows the committee's special tasks to confirm.
  const [review, setReview] = useState(false);
  const hasCommittee = s.d.twg.some((g) => g.members.some((m) => m.name.trim()));
  const submit = async (asDraft = false) => {
    if (!asDraft && hasCommittee && !review) { setReview(true); return; }
    await send(asDraft);
  };
  const Step = STEPS[s.step];
  const header = <Stack.Screen options={{ title: c.isEditing ? 'Edit Event' : 'Add New Event' }} />;
  if (s.uploading) return <Screen>{header}<ProposalUploadCard c={c} />{guard.dialog}</Screen>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header}
      {guard.dialog}
      {review && <SpecialTasksSheet c={c} submitting={s.submitting} onClose={() => setReview(false)} onSubmit={() => void send()} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#fff', flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 14 }}>
        {STEP_TITLES.map((t, i) => (
          <Pressable key={t} onPress={() => c.goTo(i)} style={{ alignItems: 'center', gap: 6, flexDirection: 'row' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i < s.step ? '#48bb78' : i === s.step ? '#1e2126' : '#acc2df' }}>
              {i < s.step ? <Icon name="check" size={14} color="#fff" /> : <T size={12} weight={700} color="#fff">{i + 1}</T>}
            </View>
            <T size={12} weight={i === s.step ? 700 : 400} color={i === s.step ? C.text : '#718096'}>{t}</T>
          </Pressable>
        ))}
      </ScrollView>
      <Screen>
        {c.isReturned && existing && <ReturnedCard event={new EventItem(existing)} />}
        <ReadingCard c={c} />
        {!s.d.reading && c.canSaveAsDraft && s.step === 0 && (
          <Button variant="outline-muted" size="sm" icon="upload" style={{ alignSelf: 'flex-start' }} onPress={() => c.showUpload(true)}>Fill from proposal file</Button>
        )}
        <Step c={c} />
      </Screen>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.border }}>
        {s.step > 0 && <Button variant="outline-muted" onPress={() => c.goTo(s.step - 1)}>Back</Button>}
        <View style={{ flex: 1 }} />
        {c.canSaveAsDraft && <Button variant="outline-muted" disabled={s.submitting} onPress={() => void submit(true)}>{c.isReturned ? 'Save' : 'Save Draft'}</Button>}
        <Button loading={s.submitting} onPress={() => (c.isLastStep ? void submit() : c.goTo(s.step + 1))}>
          {!c.isLastStep ? 'Next →' : c.isReturned ? 'Resubmit' : c.isEditing ? 'Save Changes' : 'Submit'}
        </Button>
      </View>
    </View>
  );
}
