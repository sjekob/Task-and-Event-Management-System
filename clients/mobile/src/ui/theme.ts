/** TaskNet colors (same tokens as the web app and the Flutter AppTheme). */
export const C = {
  bg: '#e0dbd2',
  card: '#ffffff',
  dark: '#5a1120',
  sidebarActive: '#D92243',
  accent: '#D92243',
  text: '#2B2220',
  text2: '#5B4E48',
  muted: '#7D6F68',
  light: '#A99B92',
  green: '#22c55e',
  greenDark: '#15803d',
  greenBg: '#dcfce7',
  red: '#ef4444',
  redDark: '#b91c1c',
  redBg: '#fee2e2',
  amber: '#f59e0b',
  amberDark: '#b45309',
  amberBg: '#fef3c7',
  blueBg: '#FCE8EC',
  blueDark: '#1d4ed8',
  purple: '#7c3aed',
  purpleBg: '#ede9fe',
  border: '#E9E3DA',
  borderStrong: '#D5CCBF',
  surface2: '#FAF8F5',
  softBlue: '#FDF0DC',
  sidebar: '#252525',
  accentBg: '#FCE8EC',
  accentDark: '#A11A33',
  orange: '#F69D39',
  orangeSoft: '#FEEBD3',
  surface3: '#F3EFE9',
};

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' | 'orange' | 'dark';

export const TONES: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: C.greenDark, bg: C.greenBg },
  red: { fg: C.redDark, bg: C.redBg },
  amber: { fg: '#92400e', bg: C.amberBg },
  blue: { fg: C.accent, bg: C.blueBg },
  gray: { fg: C.muted, bg: C.surface3 },
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
  shadowColor: '#2B2220',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

/** Dialogs and sheets: clearly above the page. */
export const shadowLg = {
  shadowColor: '#2B2220',
  shadowOpacity: 0.28,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: -6 },
  elevation: 16,
};
