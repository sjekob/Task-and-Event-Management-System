import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppraisalController, EventAppraisal, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { EventForAppraisal } from '@shared/models';
import { Button, C, Card, Empty, IconButton, Row, T } from '../../ui/kit';
import { DemographicsDialog, EvalLinkDialog, EventRatingDialog } from './EventDialogs';
import { Chip, ErrorPanel, FilterSelect, Line, Stat, StatGrid, TabSkeleton, TONE } from './common';

const LEGEND = [['#16a34a', 'High (≥ 80%)'], ['#ea580c', 'Mid (50-79%)'], ['#ef4444', 'Low (< 50%)']] as const;

/** Events: evidency rates, QR / link to the evaluation, demographics and results. */
export function EventsTab({ c }: { c: AppraisalController }) {
  const s = c.state.events;
  const [title, setTitle] = useState<string | null>(null);
  const [link, setLink] = useState<EventForAppraisal | null>(null);
  const [demo, setDemo] = useState<EventForAppraisal | null>(null);
  const [results, setResults] = useState<EventForAppraisal | null>(null);
  const { cards, rows, titles } = useMemo(() => ({
    cards: EventAppraisal.cards(s.items),
    rows: title ? s.items.filter((e) => e.title === title) : s.items,
    titles: [...new Set(s.items.map((e) => e.title).filter(Boolean))].sort(),
  }), [s.items, title]);

  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadEvents()} />;
  const avgColor = cards.avg == null ? C.muted : TONE[EventAppraisal.rateTone(cards.avg)];
  return (
    <View style={{ gap: 14 }}>
      <StatGrid>
        <Stat value={String(cards.total)} label="Total Events" sub={`${cards.pending} awaiting ratings`} icon="calendar" color={C.muted} bg="#f3f4f6" />
        <Stat value={String(cards.rated)} label="Rated Events" icon="check-square" color="#10b981" bg="#ecfdf5" />
        <Stat value={cards.avg == null ? '—' : `${cards.avg.toFixed(0)}%`} label="Avg Evidency Rate" icon="percent" color={avgColor} bg="#f3f4f6" valueColor={avgColor} />
      </StatGrid>
      <Row wrap gap={12}>
        {LEGEND.map(([col, d]) => <Row key={d} gap={5}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: col }} /><T size={12} color={C.text2}>{d}</T></Row>)}
      </Row>
      <FilterSelect label="All events" options={titles} selected={title} onSelect={setTitle} />
      {!rows.length ? <Empty icon="calendar" title="No events to show." /> : rows.map((e) => (
        <EventCard key={e.id} e={e} onLink={() => setLink(e)} onDemo={() => setDemo(e)} onResults={() => setResults(e)} />
      ))}
      {link && <EvalLinkDialog event={link} onClose={() => setLink(null)} />}
      {demo && <DemographicsDialog event={demo} onClose={() => setDemo(null)} />}
      {results && <EventRatingDialog event={results} onClose={(u) => { setResults(null); if (u) c.replaceEvent(u); }} />}
    </View>
  );
}

const EventCard = memo(function EventCard({ e, onLink, onDemo, onResults }: { e: EventForAppraisal; onLink: () => void; onDemo: () => void; onResults: () => void }) {
  const has = e.evaluations.length > 0;
  const col = has ? TONE[EventAppraisal.rateTone(e.evidencyRate)] : C.muted;
  return (
    <Card style={{ gap: 6 }}>
      <Row><T weight={700} style={{ flex: 1 }}>{e.title}</T><Chip status={EventAppraisal.effectiveStatus(e)} /></Row>
      <Line label="Date" value={SpecialTaskStats.fmtDate(e.targetDate)} />
      <Line label="Organizer" value={e.organizerName ?? '—'} />
      <Line label="Responses" value={String(EventAppraisal.responses(e))} />
      <Line label="Evidency" value={has ? `${e.evidencyRate.toFixed(0)}%` : '—'} color={col} />
      <Row style={{ marginTop: 4 }}>
        <IconButton name="grid" label="Evaluation QR / link" color="#3b82f6" onPress={onLink} />
        <IconButton name="users" label="Evaluator demographics" color={has ? '#3b82f6' : '#bdbdbd'} onPress={onDemo} />
        <View style={{ flex: 1 }} />
        {has ? <Button size="sm" onPress={onResults}>View Results</Button> : <T size={12} color={C.muted}>No Data</T>}
      </Row>
    </Card>
  );
});
