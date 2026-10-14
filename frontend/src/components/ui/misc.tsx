import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MOBILE_BREAKPOINT, Scheme, densityDy, ts, withOpacity } from '../../theme/appTheme';
import { Icon, IconName } from './Icon';
import { labelLarge } from './inputs';
import { measureAnchor, showPopup } from './overlay';

/// `MediaQuery.of(context).size.width < 768`.
export function useIsMobile(): boolean {
  return useWindowDimensions().width < MOBILE_BREAKPOINT;
}

// ── CircularProgressIndicator ────────────────────────────────────────────────

interface SpinnerProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  /// Determinate progress 0..1; omit for the spinning indicator.
  value?: number;
  trackColor?: string;
}

export function CircularProgressIndicator({ size = 36, strokeWidth = 4, color = Scheme.primary, value, trackColor }: SpinnerProps) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (value != null) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1333, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, value]);

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const arc = value != null ? Math.max(0, Math.min(1, value)) * c : c * 0.7;
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [
          { rotate: value != null ? '-90deg' : spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        {trackColor != null && (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        )}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap={value != null ? 'butt' : 'square'}
        />
      </Svg>
    </Animated.View>
  );
}

// ── LinearProgressIndicator ──────────────────────────────────────────────────

interface LinearProgressProps {
  value: number;
  minHeight?: number;
  backgroundColor?: string;
  color?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function LinearProgressIndicator({
  value,
  minHeight = 4,
  backgroundColor = Scheme.secondaryContainer,
  color = Scheme.primary,
  radius = 0,
  style,
}: LinearProgressProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={[{ height: minHeight, backgroundColor, borderRadius: radius, overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────────

/// Material `Divider`: a 1px line centred in [height] of vertical space.
export function Divider({ height = 16, thickness = 1, color = Scheme.outlineVariant, indent = 0 }: {
  height?: number;
  thickness?: number;
  color?: string;
  indent?: number;
}) {
  return (
    <View style={{ height, justifyContent: 'center', marginLeft: indent }}>
      <View style={{ height: thickness, backgroundColor: color }} />
    </View>
  );
}

export function VerticalDivider({ width = 16, thickness = 1, color = Scheme.outlineVariant, style }: {
  width?: number;
  thickness?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width, alignItems: 'center', alignSelf: 'stretch' }, style]}>
      <View style={{ width: thickness, flex: 1, backgroundColor: color }} />
    </View>
  );
}

// ── CircleAvatar ─────────────────────────────────────────────────────────────

export function CircleAvatar({ radius = 20, backgroundColor = Scheme.primaryContainer, children, style }: {
  radius?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { width: radius * 2, height: radius * 2, borderRadius: radius, backgroundColor, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── PopupMenuButton ──────────────────────────────────────────────────────────

export interface PopupMenuEntry<T> {
  value: T;
  child: React.ReactNode;
  enabled?: boolean;
  /// Row height (PopupMenuItem.height, default 48).
  height?: number;
  /// Horizontal padding of the row (default 12).
  padding?: number;
}

interface PopupMenuButtonProps<T> {
  items: PopupMenuEntry<T>[];
  onSelected: (value: T) => void;
  /// Icon for the default icon-button trigger.
  icon?: React.ReactNode;
  /// Custom trigger instead of the icon button.
  child?: React.ReactNode;
  radius?: number;
  /// Padding of the icon button (default 8; EdgeInsets.zero → 0).
  padding?: number;
  tooltip?: string;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  menuColor?: string;
  /// Shift the menu down from the trigger (PopupMenuButton.offset.dy).
  offsetY?: number;
}

export function PopupMenu<T>({ items, onSelect, radius = 4, color = Scheme.surfaceContainer }: {
  items: PopupMenuEntry<T>[];
  onSelect: (value: T) => void;
  radius?: number;
  color?: string;
}) {
  return (
    <View style={[styles.menu, { borderRadius: radius, backgroundColor: color }]}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {items.map((item, i) => {
          const enabled = item.enabled ?? true;
          return (
            <Pressable
              key={i}
              disabled={!enabled}
              onPress={() => onSelect(item.value)}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.menuItem,
                item.height != null && { minHeight: item.height },
                item.padding != null && { paddingHorizontal: item.padding },
                enabled && ({ cursor: 'pointer' } as ViewStyle),
                hovered && enabled && { backgroundColor: withOpacity(Scheme.onSurface, 0.08) },
                !enabled && { opacity: 0.38 },
              ]}
            >
              {typeof item.child === 'string' ? <Text style={labelLarge()}>{item.child}</Text> : item.child}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function PopupMenuButton<T>({
  items,
  onSelected,
  icon,
  child,
  radius,
  padding = 8,
  tooltip,
  enabled = true,
  style,
  menuColor,
  offsetY,
}: PopupMenuButtonProps<T>) {
  const ref = useRef<View>(null);
  const open = async () => {
    const anchor = await measureAnchor(ref);
    const picked = await showPopup<{ value: T }>(
      anchor,
      (close) => <PopupMenu items={items} onSelect={(value) => close({ value })} radius={radius} color={menuColor} />,
      { offsetY },
    );
    if (picked != null) onSelected(picked.value);
  };

  if (child != null) {
    return (
      <Pressable ref={ref} disabled={!enabled} onPress={open} style={[enabled && ({ cursor: 'pointer' } as ViewStyle), style]}>
        {child}
      </Pressable>
    );
  }
  const side = Math.max(24 + 2 * Math.max(0, padding + densityDy), 0);
  return (
    <Pressable
      ref={ref}
      disabled={!enabled}
      onPress={open}
      accessibilityLabel={tooltip ?? 'Show menu'}
      {...(Platform.OS === 'web' ? ({ title: tooltip ?? 'Show menu' } as object) : null)}
      style={[
        { minWidth: side, minHeight: side, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
        enabled && ({ cursor: 'pointer' } as ViewStyle),
        style,
      ]}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          {hovered && enabled && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: withOpacity(Scheme.onSurfaceVariant, 0.08) }]} />
          )}
          {icon ?? <Icon name="more_vert" size={24} color={Scheme.onSurfaceVariant} />}
        </>
      )}
    </Pressable>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

/// Material `Tooltip`. On web the message shows on hover; on touch devices it
/// is exposed as the accessibility label.
export function Tooltip({ message, children, style }: { message: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel={message}
      {...(Platform.OS === 'web' ? ({ title: message } as object) : null)}
      style={style}
    >
      {children}
    </View>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: React.ReactNode;
  avatar?: React.ReactNode;
  backgroundColor?: string;
  side?: { color: string; width?: number } | null;
  labelStyle?: StyleProp<TextStyle>;
  /// InputChip's trailing delete button.
  onDeleted?: () => void;
  onPress?: () => void;
  /// VisualDensity.compact: 8px shorter.
  compact?: boolean;
  radius?: number;
  padding?: number;
  selected?: boolean;
  selectedColor?: string;
  /// ChoiceChip's tick on the selected chip (default shown).
  showCheckmark?: boolean;
}

export function Chip({
  label,
  avatar,
  backgroundColor,
  side,
  labelStyle,
  onDeleted,
  onPress,
  compact,
  radius = 8,
  padding = 4,
  selected,
  selectedColor = Scheme.secondaryContainer,
  showCheckmark = true,
}: ChipProps) {
  const height = Math.max(24, 32 + (compact ? -8 : 0) + (compact ? 0 : densityDy));
  const border = side === null ? undefined : side ?? (selected ? undefined : { color: Scheme.outlineVariant, width: 1 });
  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          height,
          borderRadius: radius,
          paddingHorizontal: padding,
          backgroundColor: selected ? selectedColor : backgroundColor ?? 'transparent',
        },
        border && { borderWidth: border.width ?? 1, borderColor: border.color },
      ]}
    >
      {selected && showCheckmark && <Icon name="check" size={18} color={Scheme.onSecondaryContainer} style={{ marginLeft: 4 }} />}
      {avatar != null && <View style={{ marginLeft: 4 }}>{avatar}</View>}
      <View style={{ paddingHorizontal: 8, flexShrink: 1 }}>
        {typeof label === 'string' ? (
          <Text numberOfLines={1} style={[labelLarge(selected ? Scheme.onSecondaryContainer : Scheme.onSurfaceVariant), labelStyle]}>{label}</Text>
        ) : (
          label
        )}
      </View>
      {onDeleted != null && (
        <Pressable onPress={onDeleted} accessibilityLabel="Delete" style={{ paddingRight: 4, cursor: 'pointer' } as ViewStyle}>
          <Icon name="close" size={18} color={Scheme.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
  );
  if (onPress == null) return body;
  return <Pressable onPress={onPress} style={{ cursor: 'pointer', alignSelf: 'flex-start' } as ViewStyle}>{body}</Pressable>;
}

// ── Layout helpers ───────────────────────────────────────────────────────────

/// `SizedBox(width:, height:)` used as a gap.
export const Gap = ({ w, h }: { w?: number; h?: number }) => <View style={{ width: w, height: h }} />;

/// `Spacer()`.
export const Spacer = () => <View style={{ flex: 1 }} />;

/// Text in the theme's default body style.
export function BodyText({ children, style, numberOfLines }: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return <Text numberOfLines={numberOfLines} style={[ts(), style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  menu: {
    minWidth: 112,
    maxWidth: 280,
    overflow: 'hidden',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)',
  },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
});
