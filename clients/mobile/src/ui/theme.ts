/** TaskNet colors (same tokens as the web app and the Flutter AppTheme). */
export const C = {
  bg: '#dce6f5',
  card: '#ffffff',
  dark: '#1a1a2e',
  sidebarActive: '#8faad4',
  accent: '#2563eb',
  text: '#1a1a2e',
  text2: '#4b5563',
  muted: '#6b7280',
  light: '#9ca3af',
  green: '#22c55e',
  greenDark: '#15803d',
  greenBg: '#dcfce7',
  red: '#ef4444',
  redDark: '#b91c1c',
  redBg: '#fee2e2',
  amber: '#f59e0b',
  amberDark: '#b45309',
  amberBg: '#fef3c7',
  blueBg: '#dbeafe',
  blueDark: '#1d4ed8',
  purple: '#7c3aed',
  purpleBg: '#ede9fe',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  surface2: '#f8fafc',
  softBlue: '#eef2fa',
};

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' | 'orange' | 'dark';

export const TONES: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: C.greenDark, bg: C.greenBg },
  red: { fg: C.redDark, bg: C.redBg },
  amber: { fg: '#92400e', bg: C.amberBg },
  blue: { fg: C.accent, bg: C.blueBg },
  gray: { fg: C.muted, bg: '#f1f5f9' },
  purple: { fg: C.purple, bg: C.purpleBg },
  orange: { fg: '#ea580c', bg: '#ffedd5' },
  dark: { fg: '#fff', bg: C.dark },
};

export const FONT = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
