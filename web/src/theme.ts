import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** TaskNet palette (same values as the mobile app and the old Flutter theme). */
export const colors = {
  bg: '#DCE6F5',
  card: '#FFFFFF',
  dark: '#1A1A2E',
  accent: '#2563EB',
  textPrimary: '#1A1A2E',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  green: '#22C55E',
  greenBg: '#DCFCE7',
  red: '#EF4444',
  redBg: '#FEE2E2',
  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  blueBg: '#DBEAFE',
  border: '#E5E7EB',
  sidebarActive: '#8FAAD4',
};

const brand: MantineColorsTuple = [
  '#eef3ff', '#dce4f5', '#b6c6e8', '#8da7dc', '#6b8cd1', '#5579cb',
  '#2563EB', '#1D4ED8', '#1e40af', '#1e3a8a',
];

const ink: MantineColorsTuple = [
  '#f2f2f7', '#e1e1ea', '#c0c0d3', '#9d9dbb', '#7f7fa7', '#6c6c9b',
  '#3a3a5c', '#2a2a46', '#1A1A2E', '#101020',
];

export const theme = createTheme({
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: '700' },
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand, ink },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Paper: { defaultProps: { radius: 'lg', shadow: 'xs' } },
    Card: { defaultProps: { radius: 'lg', shadow: 'xs', padding: 'lg' } },
    Modal: { defaultProps: { radius: 'lg', centered: true } },
  },
});
