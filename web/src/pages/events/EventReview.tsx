import { useState, type ReactNode } from 'react';
import { Alert, Box, Button, Group, Stack, Text, Textarea, ThemeIcon, Timeline } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowBackUp, IconCircleCheck, IconCircleX, IconMessage2 } from '@tabler/icons-react';
import { formatDateTime, isReturnedEvent, parseTimestamp, type EventRecord, type EventReview } from '@tasknet/shared';

export type SendBack = 'rejected' | 'revisions_requested';

const DECISION: Record<EventReview['decision'], { label: string; color: string; icon: ReactNode }> = {
  approved: { label: 'Approved', color: 'green', icon: <IconCircleCheck size={14} /> },
  revisions_requested: { label: 'Revisions requested', color: 'orange', icon: <IconArrowBackUp size={14} /> },
  rejected: { label: 'Rejected', color: 'red', icon: <IconCircleX size={14} /> },
};

/** Server timestamps are UTC; show them in local time. */
const when = (s: string) => formatDateTime(parseTimestamp(s), s);

/** The comment form inside the Reject / Request revisions dialog. */
function ReviewForm({ decision, onSubmit, onCancel }: {
  decision: SendBack; onSubmit: (comment: string) => Promise<boolean>; onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const reject = decision === 'rejected';
  const ready = comment.trim().length > 0;
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {reject
          ? 'The proposal goes back to the proponent as rejected. They can still revise it and submit it again.'
          : 'The proposal goes back to the proponent to revise and resubmit.'}
      </Text>
      <Textarea label={reject ? 'Reason for rejecting' : 'What should be revised?'} withAsterisk autosize minRows={4} maxRows={10}
        placeholder={reject ? 'e.g. The date overlaps the Quarter 2 examinations, and the budget has no source of fund.'
          : 'e.g. Add the speakers to the Activity Matrix and itemize the snacks budget.'}
        value={comment} onChange={(e) => setComment(e.currentTarget.value)} maxLength={4000} data-autofocus />
      <Group justify="flex-end" gap="sm" mt={4}>
        <Button variant="default" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button color={reject ? 'red' : 'orange'} disabled={!ready} loading={busy}
          onClick={async () => { setBusy(true); const ok = await onSubmit(comment.trim()); if (!ok) setBusy(false); }}>
          {reject ? 'Reject proposal' : 'Request revisions'}
        </Button>
      </Group>
    </Stack>
  );
}

/** Opens the Reject / Request revisions dialog; `send` returns true on success (closes it). */
export function openReviewModal(e: EventRecord, decision: SendBack, send: (comment: string) => Promise<boolean>) {
  const id = modals.open({
    title: <Text fw={700}>{decision === 'rejected' ? 'Reject proposal' : 'Request revisions'} · {e.title}</Text>,
    size: 'lg',
    children: (
      <ReviewForm decision={decision} onCancel={() => modals.close(id)}
        onSubmit={async (c) => { const ok = await send(c); if (ok) modals.close(id); return ok; }} />
    ),
  });
}

/** The approver's latest comment on a returned proposal, shown to the proponent. */
export function ReturnedBanner({ event, action }: { event: EventRecord; action?: ReactNode }) {
  if (!isReturnedEvent(event.status)) return null;
  const latest = (event.reviews ?? []).find((r) => r.decision === event.status) ?? event.reviews?.[0];
  const rejected = event.status === 'rejected';
  return (
    <Alert color={rejected ? 'red' : 'orange'} variant="light" radius="md"
      icon={rejected ? <IconCircleX size={20} /> : <IconArrowBackUp size={20} />}
      title={<Text fw={700}>{rejected ? 'This proposal was rejected' : 'Revisions requested'}</Text>}>
      <Stack gap={8}>
        {latest?.comment && (
          <Box className="tn-review-quote">
            <Text size="sm" className="tn-prewrap">{latest.comment}</Text>
            <Text size="xs" c="dimmed" mt={6}>
              {latest.reviewer_name ?? 'Approver'} · {when(latest.created_at)}
            </Text>
          </Box>
        )}
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="sm">
            {rejected
              ? 'You can revise the proposal and submit it again for approval.'
              : 'Make the changes, then resubmit the proposal for approval.'}
          </Text>
          {action}
        </Group>
      </Stack>
    </Alert>
  );
}

/** Every decision on the proposal, newest first. */
export function ReviewHistory({ reviews }: { reviews: EventReview[] }) {
  if (!reviews.length) return <Text size="sm" c="dimmed">No review decisions yet.</Text>;
  return (
    <Timeline bulletSize={24} lineWidth={2}>
      {reviews.map((r) => {
        const d = DECISION[r.decision];
        return (
          <Timeline.Item key={r.id} bullet={<ThemeIcon size={24} radius="xl" color={d.color} variant="light">{d.icon}</ThemeIcon>}
            title={<Text size="sm" fw={700} c={`${d.color}.8`}>{d.label}</Text>}>
            <Text size="xs" c="dimmed">{r.reviewer_name ?? 'Approver'} · {when(r.created_at)}</Text>
            {r.comment
              ? <Group gap={6} mt={6} wrap="nowrap" align="flex-start">
                  <IconMessage2 size={14} color="#94A3B8" style={{ flexShrink: 0, marginTop: 3 }} />
                  <Text size="sm" className="tn-prewrap">{r.comment}</Text>
                </Group>
              : null}
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
