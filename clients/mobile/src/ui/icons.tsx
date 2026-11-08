import { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { IconName } from '@shared/controllers/Navigation';
import { C } from './theme';

export type FeatherName = ComponentProps<typeof Feather>['name'];

/** A Feather icon (the mobile counterpart of the web app's lucide icons). */
export function Icon({ name, size = 20, color = C.text }: { name: FeatherName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

/** Semantic navigation icons → Feather glyphs. */
export const NAV_ICON: Record<IconName, FeatherName> = {
  dashboard: 'grid',
  assignment: 'clipboard',
  star: 'star',
  calendar: 'calendar',
  checkbox: 'check-square',
  starTask: 'award',
  people: 'users',
  appraisal: 'bar-chart-2',
  event: 'flag',
  dateRange: 'book-open',
  history: 'clock',
  advisory: 'book',
};
