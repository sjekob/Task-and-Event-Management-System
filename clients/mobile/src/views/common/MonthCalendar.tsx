import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CalendarMonth } from '@shared/utils/calendar';
import { C, IconButton, Sheet, T } from '../../ui/kit';

export interface CalendarLegend { color: string; label: string }

/**
 * A month grid with colored dots per day. Tapping a day with something on it
 * shows [details] for that day (phones have no hover).
 */
export function MonthCalendar({ month, onPrev, onNext, dots, details, legend, selected, onSelect }: {
  month: CalendarMonth;
  onPrev: () => void;
  onNext: () => void;
  /** Dot colors for a day key "YYYY-MM-DD". */
  dots: (key: string) => string[];
  /** Text shown when a day is tapped (null = nothing to show). */
  details?: (key: string) => string | null;
  legend?: CalendarLegend[];
  /** Highlighted day; [onSelect] is told about every tap. */
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const [open, setOpen] = useState<{ key: string; text: string } | null>(null);
  const tap = (key: string) => {
    onSelect?.(key);
    const text = details?.(key);
    if (text) setOpen({ key, text });
  };
  const cells = month.cells();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T size={15} weight={700} style={{ flex: 1 }}>{month.title}</T>
        <IconButton name="chevron-left" label="Previous month" onPress={onPrev} />
        <IconButton name="chevron-right" label="Next month" onPress={onNext} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <T key={i} size={11} weight={600} color={C.light} center style={{ width: `${100 / 7}%` }}>{d}</T>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const colors = dots(cell.key);
          const sel = selected === cell.key;
          return (
            <Pressable key={cell.key} onPress={() => tap(cell.key)} style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? C.dark : cell.isToday ? '#acc2df' : 'transparent' }}>
                <T size={13} weight={sel || cell.isToday ? 700 : 400} color={sel || cell.isToday ? '#fff' : C.text}>{cell.day}</T>
                <View style={{ position: 'absolute', bottom: 3, flexDirection: 'row', gap: 2 }}>
                  {colors.map((c, j) => <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />)}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      {legend && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
          {legend.map((l) => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.color }} />
              <T size={11.5} color={C.muted}>{l.label}</T>
            </View>
          ))}
        </View>
      )}
      {open && (
        <Sheet title={open.key} onClose={() => setOpen(null)}>
          <T size={13.5} style={{ lineHeight: 21 }}>{open.text}</T>
        </Sheet>
      )}
    </View>
  );
}
