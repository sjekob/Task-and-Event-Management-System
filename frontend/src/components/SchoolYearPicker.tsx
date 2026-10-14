import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SchoolYear, SchoolYearFilter, currentSchoolYear } from '../models/models';
import { ApiService } from '../services/apiService';
import { AppTheme, ts } from '../theme/appTheme';
import { Icon } from './ui/Icon';
import { DropdownButton, DropdownItem } from './ui/inputs';

interface Option {
  filter: SchoolYearFilter;
  label: string;
  note: string | null;
}

const keyOf = (f: SchoolYearFilter): string => `${f.schoolYear}|${f.termId ?? ''}`;

/// Chooses which school year (optionally a term) a list shows. Lists default to
/// the current school year; ended years are "archived" and viewable here.
/// Renders nothing until the principal has set up at least one school year.
export function SchoolYearPicker({ value, onChanged, includeTerms = false }: {
  value: SchoolYearFilter;
  onChanged: (filter: SchoolYearFilter) => void;
  includeTerms?: boolean;
}) {
  const [years, setYears] = useState<SchoolYear[]>([]);

  useEffect(() => {
    let mounted = true;
    ApiService.getSchoolYears()
      .then((y) => {
        if (mounted) setYears(y);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (years.length === 0) return null;
  const current = years.find((y) => y.isDefault) ?? null;
  const options = new Map<string, Option>();
  const add = (filter: SchoolYearFilter, label: string, note: string | null = null) =>
    options.set(keyOf(filter), { filter, label, note });

  add(currentSchoolYear, current != null ? `S.Y. ${current.name}` : 'Current school year', current != null ? 'Current' : null);
  for (const y of years) {
    if (y.id !== current?.id) {
      add(
        { schoolYear: `${y.id}`, termId: null },
        `S.Y. ${y.name}`,
        y.status === 'archived' ? 'Archived' : y.status === 'upcoming' ? 'Upcoming' : null,
      );
    }
    if (includeTerms) {
      for (const t of y.terms) {
        add({ schoolYear: `${y.id}`, termId: t.id }, `   ${t.name} · ${y.name}`, t.status === 'current' ? 'Now' : null);
      }
    }
  }
  add({ schoolYear: 'all', termId: null }, 'All school years');

  const selected = options.has(keyOf(value)) ? keyOf(value) : keyOf(currentSchoolYear);
  const archived = options.get(selected)!.note === 'Archived';

  const items: DropdownItem<string>[] = [...options.entries()].map(([key, o]) => ({
    value: key,
    label: (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={ts({ size: 13 })}>{o.label}</Text>
        {o.note != null && (
          <>
            <View style={{ width: 8 }} />
            <Text style={ts({ size: 11, weight: 600, color: AppTheme.textMuted })}>{o.note}</Text>
          </>
        )}
      </View>
    ),
    selectedLabel: (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon
          name={archived ? 'inventory_2_outlined' : 'event_note_outlined'}
          size={16}
          color={archived ? '#92400E' : AppTheme.textMuted}
        />
        <View style={{ width: 8 }} />
        <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{o.label.trim()}</Text>
        {o.note != null && (
          <>
            <View style={{ width: 6 }} />
            <Text style={ts({ size: 12, color: archived ? '#92400E' : AppTheme.textMuted })}>{`· ${o.note}`}</Text>
          </>
        )}
      </View>
    ),
  }));

  return (
    <View
      style={{
        paddingHorizontal: 12,
        backgroundColor: archived ? AppTheme.amberBg : '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: archived ? AppTheme.amberColor : '#E0E0E0',
      }}
    >
      <DropdownButton<string>
        value={selected}
        isDense
        menuRadius={10}
        icon={<Icon name="expand_more_rounded" size={18} color="#616161" />}
        items={items}
        onChanged={(k) => onChanged(options.get(k)!.filter)}
      />
    </View>
  );
}
