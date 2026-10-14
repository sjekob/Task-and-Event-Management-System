import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AppTheme, Scheme, densityDy, isCompactDensity, tsPlain, withOpacity } from '../../theme/appTheme';
import { Icon, IconName } from './Icon';

export type Insets = { left?: number; top?: number; right?: number; bottom?: number };
/// `[horizontal, vertical]` or explicit edges.
export type Padding = [number, number] | Insets;

function resolvePadding(p: Padding): Required<Insets> {
  if (Array.isArray(p)) return { left: p[0], right: p[0], top: p[1], bottom: p[1] };
  return { left: p.left ?? 0, top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0 };
}

type Variant = 'elevated' | 'filled' | 'outlined' | 'text';

export interface ButtonProps {
  /// A null/undefined handler disables the button.
  onPress?: (() => void) | null;
  children?: React.ReactNode;
  /// Leading icon (the `.icon` constructors). Its size defaults to 18.
  icon?: IconName | React.ReactNode;
  iconSize?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  disabledBackgroundColor?: string;
  disabledForegroundColor?: string;
  padding?: Padding;
  radius?: number;
  side?: { color: string; width?: number };
  /// `minimumSize`; pass `{ width: 0, height: 0 }` for Size.zero.
  minimumSize?: { width?: number; height?: number };
  elevation?: number;
  /// MaterialTapTargetSize.shrinkWrap: no 48px touch padding on phones.
  shrinkWrap?: boolean;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  /// Stretch the label row across the button (a button inside SizedBox(width: infinity)).
  expand?: boolean;
  tooltip?: string;
  /// VisualDensity.compact set on the button itself, whatever the platform.
  compact?: boolean;
}

const ELEVATION_SHADOW: Record<number, string> = {
  1: '0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
  2: '0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
  3: '0px 1px 3px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)',
};

function BaseButton({ variant, ...p }: ButtonProps & { variant: Variant }) {
  const disabled = p.onPress == null;
  const hasIcon = p.icon != null;

  const defaults = {
    elevated: { bg: AppTheme.darkBanner, fg: '#FFFFFF', radius: 8, weight: 600 as const, spacing: 0 },
    filled: { bg: Scheme.primary, fg: Scheme.onPrimary, radius: 999, weight: 500 as const, spacing: 0.1 },
    outlined: { bg: 'transparent', fg: Scheme.primary, radius: 999, weight: 600 as const, spacing: 0 },
    text: { bg: 'transparent', fg: Scheme.primary, radius: 999, weight: 600 as const, spacing: 0 },
  }[variant];

  const fg = disabled
    ? p.disabledForegroundColor ?? withOpacity(Scheme.onSurface, 0.38)
    : p.foregroundColor ?? defaults.fg;
  const solid = variant === 'elevated' || variant === 'filled';
  const bg = disabled
    ? p.disabledBackgroundColor ?? (solid ? withOpacity(Scheme.onSurface, 0.12) : 'transparent')
    : p.backgroundColor ?? defaults.bg;

  const defaultPadding: Padding =
    variant === 'text'
      ? hasIcon ? { left: 12, right: 16 } : [12, 0]
      : hasIcon ? { left: 16, right: 24 } : [24, 0];
  const pad = resolvePadding(p.padding ?? defaultPadding);
  // Visual density shrinks the vertical padding and the minimum size.
  const dy = p.compact ? -8 : densityDy;
  const padTop = Math.max(0, pad.top + dy);
  const padBottom = Math.max(0, pad.bottom + dy);
  const minWidth = Math.max(0, (p.minimumSize?.width ?? 64) + dy);
  const minHeight = Math.max(0, (p.minimumSize?.height ?? 40) + dy);

  const side =
    p.side ??
    (variant === 'outlined'
      ? { color: disabled ? withOpacity(Scheme.onSurface, 0.12) : Scheme.outline, width: 1 }
      : undefined);
  const elevation = disabled ? 0 : p.elevation ?? (variant === 'elevated' ? 1 : 0);
  const overlayBase = solid ? (variant === 'filled' ? Scheme.onPrimary : '#FFFFFF') : AppTheme.accentBlue;
  const [hoverAlpha, pressAlpha] = variant === 'elevated' ? [0.14, 0.22] : variant === 'filled' ? [0.08, 0.1] : [0.08, 0.16];

  const labelStyle = [
    tsPlain({ size: 14, weight: defaults.weight, color: fg, spacing: defaults.spacing }),
    variant === 'filled' && { lineHeight: 14 * 1.43 },
    p.textStyle,
    // The button's foreground colour always colours a plain string label.
    { color: fg },
  ];

  const button = (
    <Pressable
      disabled={disabled}
      onPress={p.onPress ?? undefined}
      accessibilityRole="button"
      {...(p.tooltip && Platform.OS === 'web' ? ({ title: p.tooltip } as object) : null)}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderRadius: p.radius ?? defaults.radius,
          paddingLeft: pad.left,
          paddingRight: pad.right,
          paddingTop: padTop,
          paddingBottom: padBottom,
          minWidth,
          minHeight,
        },
        side && { borderColor: side.color, borderWidth: side.width ?? 1 },
        elevation > 0 && { boxShadow: ELEVATION_SHADOW[Math.min(3, Math.ceil(elevation))] },
        !disabled && styles.clickable,
        p.expand && { alignSelf: 'stretch' },
        isCompactDensity || p.shrinkWrap ? p.style : null,
      ]}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
        <>
          {(hovered || pressed) && !disabled && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: p.radius ?? defaults.radius,
                  backgroundColor: withOpacity(overlayBase, pressed ? pressAlpha : hoverAlpha),
                },
              ]}
            />
          )}
          {hasIcon && (
            <View style={{ marginRight: 8 }}>
              {typeof p.icon === 'string' ? (
                <Icon name={p.icon as IconName} size={p.iconSize ?? 18} color={fg} />
              ) : (
                p.icon
              )}
            </View>
          )}
          {typeof p.children === 'string' || typeof p.children === 'number' ? (
            <Text style={labelStyle} numberOfLines={1}>{p.children}</Text>
          ) : (
            p.children
          )}
        </>
      )}
    </Pressable>
  );

  // On phones Material pads the tap target to 48px around the visual button.
  if (isCompactDensity || p.shrinkWrap) return button;
  return <View style={[styles.tapTarget, p.expand && { alignSelf: 'stretch' }, p.style]}>{button}</View>;
}

export const ElevatedButton = (p: ButtonProps) => <BaseButton variant="elevated" {...p} />;
export const FilledButton = (p: ButtonProps) => <BaseButton variant="filled" {...p} />;
export const OutlinedButton = (p: ButtonProps) => <BaseButton variant="outlined" {...p} />;
export const TextButton = (p: ButtonProps) => <BaseButton variant="text" {...p} />;

// ── IconButton ───────────────────────────────────────────────────────────────

interface IconButtonProps {
  icon: IconName | React.ReactNode;
  onPress?: (() => void) | null;
  size?: number;
  color?: string;
  /// Padding around the icon (default 8).
  padding?: number;
  /// `constraints` minimum width/height (default 40).
  minSize?: number;
  tooltip?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  /// VisualDensity.compact set on the button itself, whatever the platform.
  compact?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 24,
  color,
  padding = 8,
  minSize = 40,
  tooltip,
  backgroundColor,
  style,
  compact,
}: IconButtonProps) {
  const disabled = onPress == null;
  const fg = disabled ? withOpacity(Scheme.onSurface, 0.38) : color ?? Scheme.onSurfaceVariant;
  const dy = compact ? -8 : densityDy;
  const side = Math.max(size + 2 * Math.max(0, padding + dy), Math.max(0, minSize + dy));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress ?? undefined}
      accessibilityRole="button"
      accessibilityLabel={tooltip}
      {...(tooltip && Platform.OS === 'web' ? ({ title: tooltip } as object) : null)}
      style={[
        styles.iconButton,
        { width: side, height: side, borderRadius: side / 2, backgroundColor },
        !disabled && styles.clickable,
        style,
      ]}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
        <>
          {(hovered || pressed) && !disabled && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: side / 2, backgroundColor: withOpacity(Scheme.onSurfaceVariant, pressed ? 0.1 : 0.08) },
              ]}
            />
          )}
          {typeof icon === 'string' ? <Icon name={icon as IconName} size={size} color={fg} /> : icon}
        </>
      )}
    </Pressable>
  );
}

// ── InkWell / GestureDetector ────────────────────────────────────────────────

interface InkWellProps {
  onPress?: (() => void) | null;
  onLongPress?: () => void;
  children?: React.ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  hoverColor?: string;
  tooltip?: string;
  disabled?: boolean;
}

/// Material `InkWell`: a tappable area with the theme's hover/press tint.
export function InkWell({ onPress, onLongPress, children, radius = 0, style, hoverColor, tooltip, disabled }: InkWellProps) {
  const off = disabled || onPress == null;
  return (
    <Pressable
      disabled={off}
      onPress={onPress ?? undefined}
      onLongPress={onLongPress}
      {...(tooltip && Platform.OS === 'web' ? ({ title: tooltip } as object) : null)}
      style={[{ borderRadius: radius }, !off && styles.clickable, style]}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
        <>
          {children}
          {(hovered || pressed) && !off && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: radius, backgroundColor: pressed ? 'rgba(0,0,0,0.1)' : hoverColor ?? 'rgba(0,0,0,0.04)' },
              ]}
            />
          )}
        </>
      )}
    </Pressable>
  );
}

interface TapProps {
  onPress?: (() => void) | null;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /// Show the pointer cursor on web (MouseRegion with SystemMouseCursors.click).
  pointer?: boolean;
}

/// A tap target with no visual feedback.
export function Tap({ onPress, children, style, pointer = false }: TapProps) {
  return (
    <Pressable
      disabled={onPress == null}
      onPress={onPress ?? undefined}
      style={[style, pointer && onPress != null ? styles.clickable : styles.plain]}
    >
      {children}
    </Pressable>
  );
}

// ── Hover wrapper for custom (non-Material) tappable buttons ──
// Adds a pointer cursor + subtle scale/dim on hover for web & desktop.
export function HoverScale({
  children,
  onPress,
  scale = 1.03,
  style,
}: {
  children: React.ReactNode;
  onPress?: (() => void) | null;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const enabled = onPress != null;
  const anim = useRef(new Animated.Value(1)).current;
  const [, setHovered] = useState(false);
  const animate = (to: number) =>
    Animated.timing(anim, { toValue: to, duration: 120, useNativeDriver: true }).start();
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress ?? undefined}
      onHoverIn={() => { setHovered(true); animate(scale); }}
      onHoverOut={() => { setHovered(false); animate(1); }}
      style={[style, enabled ? styles.clickable : styles.plain]}
    >
      <Animated.View style={{ transform: [{ scale: anim }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tapTarget: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clickable: { cursor: 'pointer' } as ViewStyle,
  plain: { cursor: 'auto' } as ViewStyle,
});
