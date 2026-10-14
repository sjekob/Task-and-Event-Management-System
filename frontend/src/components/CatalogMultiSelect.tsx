import React from 'react';
import { Text, View } from 'react-native';
import { fontFamily, tsField } from '../theme/appTheme';
import { DropdownField, DropdownItem, InputDecoration } from './ui/inputs';
import { Chip } from './ui/misc';

/// One pickable catalog entry (a skill or a certification).
export interface CatalogOption {
  name: string;
  /// category header it is listed under
  group?: string | null;
  /// secondary line, e.g. the certification's issuer
  detail?: string | null;
}

/// Multi-select dropdown over a fixed catalog: entries are listed under their
/// category headers, each pick is added as a removable chip, and entries
/// already picked drop out of the list. There is no free-text entry.
export function CatalogMultiSelect({ label, selected, options, decoration, onChanged }: {
  label: string;
  selected: string[];
  options: CatalogOption[];
  decoration: InputDecoration;
  onChanged: (selected: string[]) => void;
}) {
  const taken = new Set(selected.map((e) => e.toLowerCase()));
  const groups = new Map<string, CatalogOption[]>();
  for (const o of options) {
    if (taken.has(o.name.toLowerCase())) continue;
    const key = o.group ?? 'Other';
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }

  const items: DropdownItem<string | null>[] = [];
  for (const [group, entries] of groups) {
    items.push({
      value: null,
      enabled: false,
      label: (
        <Text style={{ fontFamily: fontFamily(700), fontSize: 11, color: '#94A3B8', letterSpacing: 0.5 }}>
          {group.toUpperCase()}
        </Text>
      ),
    });
    for (const o of entries) {
      items.push({
        value: o.name,
        label: (
          <View style={{ paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
            <Text numberOfLines={1} style={tsField({ size: 14 })}>{o.name}</Text>
            {o.detail != null && (
              <Text numberOfLines={1} style={tsField({ size: 11, color: '#757575' })}>{o.detail}</Text>
            )}
          </View>
        ),
      });
    }
  }
  const remaining = items.filter((i) => i.value != null).length;

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <DropdownField<string | null>
        style={{ alignSelf: 'stretch' }}
        isExpanded
        freeItemHeight
        menuMaxHeight={360}
        value={null}
        decoration={{ ...decoration, labelText: label }}
        hint={options.length === 0 ? 'Loading list...' : remaining === 0 ? `All ${label.toLowerCase()} added` : 'Select to add'}
        textStyle={tsField({ size: 14 })}
        items={items}
        onChanged={
          remaining === 0
            ? null
            : (v) => {
                if (v != null) onChanged([...selected, v]);
              }
        }
      />
      {selected.length > 0 && (
        <>
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {selected.map((item) => (
              <Chip
                key={item}
                label={<Text style={tsField({ size: 12, height: 1.43, spacing: 0.1 })}>{item}</Text>}
                backgroundColor="#EFF4FA"
                side={{ color: '#D0DCEB' }}
                compact
                onDeleted={() => onChanged(selected.filter((e) => e !== item))}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
