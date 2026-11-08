import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ProposalFormController, RowListKey } from '@shared/controllers/EventControllers';
import { hasFormatting, plainToRich, richToPlain } from '@shared/utils/richText';
import { Button, C, Field, Icon, Input, T } from '../../ui/kit';

// Inputs and row editors used by the proposal form steps.
export function StepTitle({ children }: { children: string }) {
  return <T size={16} weight={800}>{children}</T>;
}

export const Note = ({ children }: { children: string }) => <T size={12.5} color="#4a5568">{children}</T>;

/**
 * A rich-text field (bold/italic/size are set on the web) edited as plain text
 * here. Editing a formatted value replaces its formatting, and the field says so.
 */
export function RichPlain({ label, value, onChange, placeholder, multiline, rows }: {
  label?: string; value: string; onChange: (html: string) => void; placeholder?: string; multiline?: boolean; rows?: number;
}) {
  const formatted = hasFormatting(value);
  return (
    <Field label={label} help={formatted ? 'Formatted on the web — editing it here clears that formatting.' : undefined}>
      <Input value={richToPlain(value)} onChangeText={(v) => onChange(plainToRich(v))} placeholder={placeholder} multiline={multiline} rows={rows} />
    </Field>
  );
}

export function AddBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button variant="ghost" size="sm" icon="plus" style={{ alignSelf: 'flex-start' }} onPress={onPress}>{label}</Button>;
}

/** One editable row of a list (activity matrix, budget, committee…) as a card with a remove button. */
export function RowCard({ title, onRemove, children }: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.surface2, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T size={12.5} weight={700} color={C.muted} style={{ flex: 1 }}>{title}</T>
        {onRemove && <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove"><Icon name="minus-circle" size={19} color={C.red} /></Pressable>}
      </View>
      {children}
    </View>
  );
}

/** Rows of [list] with one text field per column: [key, label, placeholder]. */
export function RowList({ list, c, rows, cols, title }: {
  list: RowListKey; c: ProposalFormController; rows: object[]; cols: [string, string, string][]; title: (i: number) => string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <RowCard key={i} title={title(i)} onRemove={() => c.removeRow(list, i)}>
          {cols.map(([k, label, hint]) => (
            <Field key={k} label={label}>
              <Input placeholder={hint} value={(r as Record<string, string>)[k] ?? ''} onChangeText={(v) => c.setRow(list, i, k, v)} />
            </Field>
          ))}
        </RowCard>
      ))}
    </View>
  );
}
