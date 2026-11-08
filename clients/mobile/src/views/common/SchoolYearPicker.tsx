import { useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SchoolYearPickerController } from '@shared/controllers/SchoolYearPickerController';
import { SchoolYearFilter } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { C, Icon, Sheet, T } from '../../ui/kit';

/** Chooses the school year (optionally a term) a list shows; hidden until years exist. */
export function SchoolYearPicker({ value, onChange, includeTerms }: {
  value: SchoolYearFilter; onChange: (f: SchoolYearFilter) => void; includeTerms?: boolean;
}) {
  const services = useServices();
  const [c, s] = useScreenController(() => new SchoolYearPickerController(services, includeTerms), [includeTerms]);
  const options = useMemo(() => c.options(), [c, s.years]);
  const [open, setOpen] = useState(false);
  if (!options.length) return null;
  const selected = c.selected(value)!;
  const archived = selected.note === 'Archived';
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="School year"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 36, borderRadius: 10, borderWidth: 1, borderColor: archived ? C.amber : C.borderStrong, backgroundColor: archived ? C.amberBg : '#fff' }}>
        <Icon name={archived ? 'archive' : 'calendar'} size={15} color={archived ? '#92400e' : C.muted} />
        <T size={12.5} weight={600}>{selected.label}{selected.note ? ` · ${selected.note}` : ''}</T>
        <Icon name="chevron-down" size={15} color={C.muted} />
      </Pressable>
      {open && (
        <Sheet title="School year" onClose={() => setOpen(false)}>
          <ScrollView style={{ maxHeight: 400 }}>
            {options.map((o) => (
              <Pressable key={o.key} onPress={() => { onChange(o.filter); setOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: o.indent ? 18 : 2, borderBottomWidth: 1, borderColor: C.border }}>
                <T style={{ flex: 1 }} weight={o.key === selected.key ? 700 : 400}>{o.label}{o.note ? <T size={12} color={C.muted}>{`  ·  ${o.note}`}</T> : null}</T>
                {o.key === selected.key && <Icon name="check" size={18} color={C.accent} />}
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      )}
    </>
  );
}
