import { ReactNode } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { C, FONT } from './theme';

type Weight = keyof typeof FONT;

/** App text: Plus Jakarta Sans at a given size / weight / color. */
export function T({ children, size = 14, weight = 400, color = C.text, style, lines, center, selectable }: {
  children?: ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Truncate after this many lines. */
  lines?: number;
  center?: boolean;
  selectable?: boolean;
}) {
  return (
    <Text
      numberOfLines={lines}
      selectable={selectable}
      style={[{ fontFamily: FONT[weight], fontSize: size, color, lineHeight: Math.round(size * 1.4) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

/** Small grey helper text. */
export const Caption = ({ children, style, lines }: { children?: ReactNode; style?: StyleProp<TextStyle>; lines?: number }) => (
  <T size={12} color={C.muted} style={style} lines={lines}>{children}</T>
);

/** Section heading inside a screen. */
export const H = ({ children, size = 17, style }: { children?: ReactNode; size?: number; style?: StyleProp<TextStyle> }) => (
  <T size={size} weight={700} style={style}>{children}</T>
);
