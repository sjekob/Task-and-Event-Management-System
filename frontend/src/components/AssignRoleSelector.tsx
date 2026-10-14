import React from 'react';
import { Text, View } from 'react-native';
import { AppTheme, ts } from '../theme/appTheme';
import { InkWell } from './ui/buttons';

export function assignRoleLabel(role: string): string {
  switch (role) {
    case 'teacher': return 'Teacher';
    case 'dean': return 'Dean';
    case 'coordinator': return 'Coordinator';
    case 'registrar': return 'Registrar';
    case 'principal': return 'Principal';
    default: return role;
  }
}

/// "Assign as" choice chips. Renders nothing when there is only one option.
export function AssignRoleSelector({ options, value, onChanged }: {
  options: string[];
  value: string | null;
  onChanged: (role: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((r) => (
        <View key={r} accessibilityRole="button" accessibilityLabel={`Assign as ${assignRoleLabel(r)}`} accessibilityState={{ selected: r === value }}>
          <InkWell onPress={() => onChanged(r)} radius={8}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: r === value ? AppTheme.darkBanner : '#FFFFFF',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: r === value ? AppTheme.darkBanner : AppTheme.borderColor,
              }}
            >
              <Text style={ts({ size: 13, weight: 600, color: r === value ? '#FFFFFF' : AppTheme.textMuted })}>
                {assignRoleLabel(r)}
              </Text>
            </View>
          </InkWell>
        </View>
      ))}
    </View>
  );
}
