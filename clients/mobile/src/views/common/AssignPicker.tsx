import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AssignPickerController, AssignPickerOptions, describeCredibility } from '@shared/controllers/AssignPickerController';
import { AssigneeSuggestion, User } from '@shared/models';
import { useScreenController } from '../../core/hooks';
import { Avatar, Button, C, Check, Empty, Icon, Modal, Row, SearchBox, Spinner, T, Tone, TONES } from '../../ui/kit';

const CRED_ICON = { verified: 'check-circle', pending: 'clock', doubtful: 'alert-triangle', rejected: 'slash', more: 'more-horizontal' } as const;

/** Verified / Pending review / Pending · doubtful / Rejected. */
export function CredibilityBadge({ credibility, authenticity, compact }: { credibility: string; authenticity?: string | null; compact?: boolean }) {
  const d = describeCredibility(credibility, authenticity);
  const t = TONES[d.tone as Tone] ?? TONES.gray;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, backgroundColor: t.bg, paddingHorizontal: compact ? 5 : 8, paddingVertical: compact ? 1 : 3 }}>
      <Icon name={CRED_ICON[d.icon]} size={compact ? 11 : 13} color={t.fg} />
      <T size={compact ? 10.5 : 11.5} weight={700} color={t.fg}>{d.label}</T>
    </View>
  );
}

/**
 * Personnel picker for assigning a task: ranked by fit with a "why" box per
 * person, high-burden flags and a warning when one is selected.
 */
export function AssignPickerDialog({ options, onClose, onDone, title, header }: {
  options: AssignPickerOptions; onClose: () => void; onDone?: (ids: Set<number>) => void; title?: string; header?: ReactNode;
}) {
  const [c, s] = useScreenController(() => new AssignPickerController(options), []);
  const confirmMode = !!options.onConfirm;
  const footer = confirmMode ? (
    <>
      <Button variant="outline-muted" onPress={onClose} disabled={s.busy}>Cancel</Button>
      <Button variant="primary" loading={s.busy} disabled={!s.selected.size} onPress={async () => { if (await c.confirm()) onClose(); }}>
        {`Assign${s.selected.size ? ` (${s.selected.size})` : ''}`}
      </Button>
    </>
  ) : <Button variant="primary" onPress={() => { onDone?.(s.selected); onClose(); }}>{`Done (${s.selected.size})`}</Button>;

  return (
    <Modal title={title ?? 'Select Personnel'} onClose={onClose} footer={footer}>
      {header}
      {c.hasSuggestions && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blueBg, borderRadius: 10, padding: 10 }}>
          <Icon name="zap" size={16} color={C.accent} />
          <T size={12} style={{ flex: 1 }}>{c.suggestionText()}</T>
          {s.loading ? <Spinner /> : s.ranked.size > 0 && <Button variant="ghost" size="sm" onPress={() => c.autoSelect()}>Auto-select</Button>}
        </View>
      )}
      <SearchBox value={s.search} onChange={(v) => c.setSearch(v)} placeholder="Search by name or skill..." />
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
      {c.filtered.length === 0 ? <Empty icon="users" title="No personnel found" />
        : c.filtered.map((u) => <PickerRow key={u.id} u={u} s={s.ranked.get(u.id)} checked={s.selected.has(u.id)} top={c.isTop(u.id)} onToggle={() => c.toggle(u.id)} />)}
      {c.burdenedSelection.length > 0 && <BurdenWarning people={c.burdenedSelection} />}
    </Modal>
  );
}

function PickerRow({ u, s, checked, top, onToggle }: { u: User; s?: AssigneeSuggestion; checked: boolean; top: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}>
      <Avatar url={u.avatarUrl} initials={u.initials} size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <Row wrap gap={6}>
          <T weight={600}>{u.fullName}</T>
          {s && <Pill tone={AssignPickerController.fitTone(s)}>{`Fit ${AssignPickerController.fitScore(s)}/100`}</Pill>}
          {s?.isMatch && <Pill tone={top ? 'green' : 'blue'}>{top ? 'Best fit' : 'Match'}</Pill>}
          {s && s.burden !== 'low' && <Pill tone={s.isHighBurden ? 'red' : 'amber'}>{s.isHighBurden ? 'High burden' : 'Moderate load'}</Pill>}
        </Row>
        <T size={12} color={C.muted}>{u.roleLabel}{u.gradeLevel ? ` · ${u.gradeLevel}` : ''}</T>
        {s && (
          <View style={{ backgroundColor: C.bg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: s.isHighBurden ? 'rgba(239,68,68,0.35)' : C.border, gap: 3 }}>
            <T size={11} weight={700}>{AssignPickerController.fitParts(s)}</T>
            <T size={11.5} color={C.text2}>{AssignPickerController.whySentence(s)}</T>
            {AssignPickerController.certsFor(s).length > 0 && (
              <Row wrap gap={4}>
                {AssignPickerController.certsFor(s).map(({ cert, matched }) => (
                  <View key={cert.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 6, paddingRight: 3, paddingVertical: 2, borderRadius: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: matched ? 'rgba(34,197,94,0.6)' : C.border }}>
                    <Icon name="award" size={12} color={matched ? C.green : C.muted} />
                    <T size={11} weight={600} lines={1}>{cert.name}</T>
                    <CredibilityBadge credibility={cert.credibility} authenticity={cert.authenticity} compact />
                  </View>
                ))}
              </Row>
            )}
          </View>
        )}
      </View>
      <Check checked={checked} onChange={onToggle} />
    </Pressable>
  );
}

function Pill({ tone, children }: { tone: Tone; children: string }) {
  const t = TONES[tone];
  return <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: t.bg }}><T size={11} weight={600} color={t.fg}>{children}</T></View>;
}

function BurdenWarning({ people }: { people: AssigneeSuggestion[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: C.redBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
      <Icon name="alert-triangle" size={20} color={C.red} />
      <View style={{ flex: 1, gap: 2 }}>
        <T weight={700} color={C.red}>{people.length === 1 ? `High burden: ${people[0].user.fullName}` : `High burden: ${people.length} selected people`}</T>
        {people.map((p) => <T key={p.user.id} size={12} color={C.text2}>{people.length > 1 ? `${p.user.fullName}: ` : ''}{p.loadFactors.join(', ')}</T>)}
        <T size={12} color={C.text2}>Consider someone with a lighter load, or keep them if this task needs them.</T>
      </View>
    </View>
  );
}

/** "Assign as" choice chips. Renders nothing when there is only one option. */
export function AssignRoleSelector({ options, value, onChange }: { options: string[]; value: string | null; onChange: (r: string) => void }) {
  if (options.length < 2) return null;
  return (
    <Row wrap>
      {options.map((r) => (
        <Button key={r} size="sm" variant={r === value ? 'dark' : 'outline-muted'} onPress={() => onChange(r)}>{r.charAt(0).toUpperCase() + r.slice(1)}</Button>
      ))}
    </Row>
  );
}
