/** TaskNet palette (same values as the web app). */
export const colors = {
  bg: '#DCE6F5',
  card: '#FFFFFF',
  dark: '#1A1A2E',
  accent: '#2563EB',
  text: '#1A1A2E',
  muted: '#6B7280',
  light: '#9CA3AF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  red: '#DC2626',
  redBg: '#FEE2E2',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  blue: '#1D4ED8',
  blueBg: '#DBEAFE',
  border: '#E5E7EB',
  avatar: '#8FAAD4',
  maroon: '#8B0000',
};

export const TONE_COLORS: Record<string, { fg: string; bg: string }> = {
  green: { fg: colors.green, bg: colors.greenBg },
  red: { fg: colors.red, bg: colors.redBg },
  amber: { fg: colors.amber, bg: colors.amberBg },
  blue: { fg: colors.blue, bg: colors.blueBg },
  gray: { fg: '#4B5563', bg: '#F3F4F6' },
  violet: { fg: '#6D28D9', bg: '#EDE9FE' },
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 999 };
