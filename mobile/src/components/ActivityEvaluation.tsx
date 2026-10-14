import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@tasknet/shared';
import { Button, Card, ErrorView, Field, Loading, Row, T } from './ui';
import { colors } from '@/theme';

const SEX = ['Male', 'Female', 'Prefer not to say'];
const AGE = ['17 and below', '18-24', '25-34', '35-44', '45-54', '55 and above'];

function Chips({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
              borderColor: on ? colors.dark : colors.border, backgroundColor: on ? colors.dark : '#fff' }}>
            <T v="small" style={{ color: on ? '#fff' : colors.text, fontWeight: '600' }}>{o}</T>
          </Pressable>
        );
      })}
    </Row>
  );
}

/**
 * The signed-in attendee's DepEd observation-tool evaluation of one activity
 * (after Time Out). Each indicator is marked Evident / Not Evident.
 */
export function ActivityEvaluation({ eventId, index, onDone }: {
  eventId: number; index: number; onDone: (message: string) => void;
}) {
  const event = useQuery({ queryKey: ['public-event', eventId], queryFn: () => api.appraisal.publicEvent(eventId) });
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [sex, setSex] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [affiliation, setAffiliation] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (event.isPending) return <Loading />;
  if (event.isError) return <ErrorView error={event.error} onRetry={() => event.refetch()} />;
  const e = event.data;
  const opts = (key: 'sex' | 'age_group', fallback: string[]) => e.demographic_options?.[key] ?? fallback;

  const submit = async () => {
    if (!sex || !age) return setError('Please select your sex and age group.');
    if (e.indicators.some((_, i) => marks[i] == null)) return setError('Please mark every indicator as Evident or Not Evident.');
    setError(null);
    setBusy(true);
    try {
      const res = await api.events.evaluateActivity(eventId, index, {
        sex, age_group: age, affiliation: affiliation.trim() || null, comments: comments.trim() || null,
        indicators: e.indicators.map((label, i) => ({ label, evident: marks[i] })),
      });
      onDone(res.special_task ? `${res.message} Your special task was completed.` : res.message || 'Thank you for your evaluation.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit evaluation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 4 }}>
        <T v="h3">Evaluate this activity</T>
        <T v="muted">{e.title}</T>
      </Card>
      <Card style={{ gap: 10 }}>
        <T v="label">Sex</T>
        <Chips options={opts('sex', SEX)} value={sex} onChange={setSex} />
        <T v="label">Age group</T>
        <Chips options={opts('age_group', AGE)} value={age} onChange={setAge} />
        <Field label="Affiliation (optional)" placeholder="School / office" value={affiliation} onChangeText={setAffiliation} />
      </Card>
      <Card style={{ gap: 14 }}>
        <T v="small">Mark each indicator as Evident or Not Evident based on what you observed.</T>
        {e.indicators.map((label, i) => (
          <View key={label} style={{ gap: 8 }}>
            <T style={{ fontSize: 14.5 }}>{i + 1}. {label}</T>
            <Row gap={8}>
              {([true, false] as const).map((v) => {
                const on = marks[i] === v;
                const c = v ? colors.green : colors.red;
                return (
                  <Pressable key={String(v)} onPress={() => setMarks((m) => ({ ...m, [i]: v }))} accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                      borderColor: on ? c : colors.border, backgroundColor: on ? `${c}1A` : '#fff' }}>
                    <T style={{ fontWeight: '700', color: on ? c : colors.muted, fontSize: 14 }}>{v ? 'Evident' : 'Not evident'}</T>
                  </Pressable>
                );
              })}
            </Row>
          </View>
        ))}
        <Field label="Overall comments (optional)" multiline value={comments} onChangeText={setComments} />
      </Card>
      {error && <T style={{ color: colors.red }}>{error}</T>}
      <Button title="Submit evaluation" icon="send" loading={busy} onPress={() => void submit()} />
    </View>
  );
}
