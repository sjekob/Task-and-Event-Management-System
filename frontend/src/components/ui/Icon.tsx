import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { IconName, iconGlyphs } from './iconGlyphs';

export type { IconName } from './iconGlyphs';

export const ICON_FONT = 'MaterialIcons';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/// A Material icon drawn from the bundled Material Icons font, so every
/// icon name renders its exact glyph.
export function Icon({ name, size = 24, color = 'rgba(0,0,0,0.87)', style }: IconProps) {
  return (
    <Text
      allowFontScaling={false}
      selectable={false}
      style={[
        {
          fontFamily: ICON_FONT,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
          textAlign: 'center',
        },
        style,
      ]}
    >
      {String.fromCodePoint(iconGlyphs[name])}
    </Text>
  );
}
