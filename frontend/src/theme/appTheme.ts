import { Platform, TextStyle } from 'react-native';

// ── Core Colors (matching the HTML design exactly) ──
export const AppTheme = {
  bgColor: '#DCE6F5',
  sidebarColor: '#B8C8E8',
  sidebarActive: '#8FAAD4',
  cardColor: '#FFFFFF',
  darkBanner: '#1A1A2E',
  accentBlue: '#2563EB',
  accentHover: '#1D4ED8',
  textPrimary: '#1A1A2E',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  greenColor: '#22C55E',
  greenBg: '#DCFCE7',
  redColor: '#EF4444',
  redBg: '#FEE2E2',
  amberColor: '#F59E0B',
  amberBg: '#FEF3C7',
  blueBg: '#DBEAFE',
  borderColor: '#E5E7EB',
  logoutBtn: '#2D3748',

  // ── Shadows ──
  cardShadow: '0px 2px 8px rgba(0,0,0,0.08)',
  shadowLg: '0px 8px 24px rgba(0,0,0,0.12)',
} as const;

/// The Material 3 colour roles derived from
/// ColorScheme.fromSeed(accentBlue), with primary and surface overridden.
/// Material widgets (dialogs, menus, pickers, chips) read their defaults here.
export const Scheme = {
  primary: AppTheme.accentBlue,
  onPrimary: '#FFFFFF',
  primaryContainer: '#DBE1FF',
  onPrimaryContainer: '#324478',
  secondary: '#595E72',
  secondaryContainer: '#DDE1F9',
  onSecondaryContainer: '#414659',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  surface: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F4F3FA',
  surfaceContainer: '#EEEDF4',
  surfaceContainerHigh: '#E8E7EF',
  surfaceContainerHighest: '#E3E2E9',
  onSurface: '#1A1B21',
  onSurfaceVariant: '#45464F',
  outline: '#757680',
  outlineVariant: '#C5C6D0',
  inverseSurface: '#2F3036',
  inverseOnSurface: '#F1F0F7',
  inversePrimary: '#B4C5FF',
} as const;

export type FontWeight = 400 | 500 | 600 | 700 | 800;

const FAMILY: Record<FontWeight, string> = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
};

export const fontFamily = (weight: FontWeight = 400): string => FAMILY[weight];

export interface TextSpec {
  size?: number;
  weight?: FontWeight;
  color?: string;
  /// Line-height multiplier (text height). `null` uses the
  /// font's own metrics, as inside buttons and input fields.
  height?: number | null;
  spacing?: number;
  italic?: boolean;
  decoration?: TextStyle['textDecorationLine'];
  align?: TextStyle['textAlign'];
}

/// Builds a text style the way Material resolves one inside a Material
/// surface: anything left out falls back to the theme's bodyMedium
/// (14px, regular, muted, 1.43 line height, 0.25 letter spacing).
export function ts(spec: TextSpec = {}): TextStyle {
  const size = spec.size ?? 14;
  const height = spec.height === undefined ? 1.43 : spec.height;
  const style: TextStyle = {
    fontFamily: FAMILY[spec.weight ?? 400],
    fontSize: size,
    color: spec.color ?? AppTheme.textMuted,
    letterSpacing: spec.spacing ?? 0.25,
  };
  if (height != null) style.lineHeight = size * height;
  if (spec.italic) style.fontStyle = 'italic';
  if (spec.decoration) style.textDecorationLine = spec.decoration;
  if (spec.align) style.textAlign = spec.align;
  return style;
}

/// Text style inside a Material button, tab or input: no inherited letter
/// spacing and the font's natural line height.
export function tsPlain(spec: TextSpec = {}): TextStyle {
  return ts({ height: null, spacing: 0, ...spec });
}

/// Text style of a TextField: whatever is left out falls back to the theme's
/// bodyLarge (16px, primary text colour, 1.5 line height, 0.5 letter spacing).
export function tsField(spec: TextSpec = {}): TextStyle {
  return ts({ size: 16, color: AppTheme.textPrimary, height: 1.5, spacing: 0.5, ...spec });
}

/// Text inside a CircleAvatar. It is styled from the primary text theme,
/// which the app never switched to Plus Jakarta Sans, so it renders in the
/// platform's default font (titleMedium: 1.5 line height, 0.15 spacing).
export function tsAvatar(size: number, weight: FontWeight, color: string): TextStyle {
  return { fontSize: size, fontWeight: `${weight}`, color, letterSpacing: 0.15, lineHeight: size * 1.5 };
}

// ── Text Styles (Figma typography spec) ──
// H3 → 32px Semi Bold | H4 → 26px | S1 → 18px | S2 → 16px
// B1/B3 Regular, B2/B4 Medium | C1 Regular, C2/C3 Medium | Label Medium 12px
export const TextStyles = {
  heading1: ts({ size: 26, weight: 600, color: AppTheme.textPrimary, height: 1.31 }),
  heading2: ts({ size: 20, weight: 600, color: AppTheme.textPrimary, height: 1.4 }),
  heading3: ts({ size: 16, weight: 600, color: AppTheme.textPrimary, height: 1.5 }),
  subtitle1: ts({ size: 18, weight: 600, color: AppTheme.textPrimary, height: 1.56 }),
  subtitle2: ts({ size: 16, weight: 600, color: AppTheme.textPrimary, height: 1.5 }),
  bodyLg: ts({ size: 16, weight: 400, color: AppTheme.textPrimary, height: 1.5 }),
  bodyMd: ts({ size: 14, weight: 400, color: AppTheme.textMuted, height: 1.43 }),
  bodySm: ts({ size: 12, weight: 400, color: AppTheme.textLight, height: 1.33 }),
  labelMd: ts({ size: 14, weight: 500, color: AppTheme.textPrimary, height: 1.43 }),
  labelSm: ts({ size: 12, weight: 500, color: AppTheme.textMuted, height: 1.33 }),
  caption: ts({ size: 12, weight: 400, color: AppTheme.textLight, height: 1.33 }),
  captionMd: ts({ size: 12, weight: 500, color: AppTheme.textMuted, height: 1.33 }),
  captionSm: ts({ size: 10, weight: 500, color: AppTheme.textMuted, height: 1.4 }),
} as const;

/// `color.withOpacity(o)` for #RRGGBB colours.
export function withOpacity(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/// Desktop platforms (and web on a desktop OS) get a compact visual
/// density, which trims 8px off the height of buttons, inputs and list tiles.
/// Phones and tablets keep the standard density.
export const isCompactDensity: boolean =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '');

export const densityDy: number = isCompactDensity ? -8 : 0;

export const MOBILE_BREAKPOINT = 768;
