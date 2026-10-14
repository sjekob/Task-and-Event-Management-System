import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardTypeOptions,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AppTheme, Scheme, densityDy, ts, tsField, tsPlain, withOpacity } from '../../theme/appTheme';
import { Icon } from './Icon';
import { Insets, Padding } from './buttons';
import { measureAnchor, showPopup } from './overlay';

function resolvePadding(p: Padding): Required<Insets> {
  if (Array.isArray(p)) return { left: p[0], right: p[0], top: p[1], bottom: p[1] };
  return { left: p.left ?? 0, top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0 };
}

// ── InputDecoration ──────────────────────────────────────────────────────────

/// How a text field or dropdown is decorated (Material input decoration). Anything left out
/// falls back to the theme: white fill, 8px outline, 1.5px border.
export interface InputDecoration {
  hintText?: string;
  hintStyle?: StyleProp<TextStyle>;
  labelText?: string;
  labelStyle?: StyleProp<TextStyle>;
  /// Style of the label once it floats above the field.
  floatingLabelStyle?: StyleProp<TextStyle>;
  helperText?: string | null;
  helperStyle?: StyleProp<TextStyle>;
  errorText?: string | null;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  prefixText?: string;
  suffixText?: string;
  filled?: boolean;
  fillColor?: string;
  /// 'outline' (theme default), 'underline' or 'none'.
  border?: 'outline' | 'underline' | 'none';
  borderColor?: string;
  focusedBorderColor?: string;
  borderWidth?: number;
  focusedBorderWidth?: number;
  radius?: number;
  contentPadding?: Padding;
  isDense?: boolean;
  counterText?: string;
}

interface DecoratorProps {
  decoration?: InputDecoration;
  focused: boolean;
  /// Whether the field shows text (floats the label).
  hasValue: boolean;
  enabled?: boolean;
  children: React.ReactNode;
  /// Text line height of the input, used to size the floating label.
  style?: StyleProp<ViewStyle>;
  multiline?: boolean;
  /// Fill the height of the parent (TextField.expands).
  expands?: boolean;
}

/// Draws the border, fill, label and icons around an input, the way
/// a Material input decorator does for text fields and dropdowns.
export function InputDecorator({ decoration: d = {}, focused, hasValue, enabled = true, children, style, multiline, expands }: DecoratorProps) {
  const border = d.border ?? 'outline';
  const hasError = d.errorText != null && d.errorText.length > 0;
  const filled = d.filled ?? true;
  const pad = resolvePadding(d.contentPadding ?? [14, 12]);
  const dense = d.isDense ?? false;
  const borderColor = hasError
    ? Scheme.error
    : focused
      ? d.focusedBorderColor ?? AppTheme.accentBlue
      : d.borderColor ?? AppTheme.borderColor;
  const borderWidth = focused ? d.focusedBorderWidth ?? d.borderWidth ?? 1.5 : d.borderWidth ?? 1.5;
  const radius = d.radius ?? 8;
  const floating = d.labelText != null && (focused || hasValue);

  const labelAnim = useRef(new Animated.Value(floating ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(labelAnim, { toValue: floating ? 1 : 0, duration: 167, useNativeDriver: false }).start();
  }, [floating, labelAnim]);

  const fill = filled ? d.fillColor ?? AppTheme.cardColor : 'transparent';
  const labelColor = hasError ? Scheme.error : focused ? AppTheme.accentBlue : Scheme.onSurfaceVariant;

  return (
    <View style={[expands && { flex: 1 }, style]}>
      <View
        style={[
          expands && { flex: 1 },
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            backgroundColor: fill,
            minHeight: dense || border === 'none' ? undefined : 48,
            opacity: enabled ? 1 : 0.6,
          },
          border === 'outline' && { borderRadius: radius },
        ]}
      >
        {/* Painted over the field so the border never changes its size. */}
        {border === 'outline' && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth, borderColor, borderRadius: radius }]} />
        )}
        {border === 'underline' && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: focused ? 2 : 1, backgroundColor: borderColor }}
          />
        )}
        {d.prefixIcon != null && <View style={styles.affixIcon}>{d.prefixIcon}</View>}
        <View
          style={{
            flex: 1,
            paddingLeft: d.prefixIcon != null ? 0 : pad.left,
            paddingRight: d.suffixIcon != null ? 0 : pad.right,
            paddingTop: Math.max(0, pad.top + densityDy / 2),
            paddingBottom: Math.max(0, pad.bottom + densityDy / 2),
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
          }}
        >
          {d.prefixText != null && (
            <Text style={[ts({ size: 16, color: Scheme.onSurfaceVariant, height: 1.5, spacing: 0.5 })]}>{d.prefixText}</Text>
          )}
          <View style={[{ flex: 1 }, expands && { alignSelf: 'stretch' }]}>{children}</View>
          {d.suffixText != null && (
            <Text style={[ts({ size: 16, color: Scheme.onSurfaceVariant, height: 1.5, spacing: 0.5 })]}>{d.suffixText}</Text>
          )}
        </View>
        {d.suffixIcon != null && <View style={styles.affixIcon}>{d.suffixIcon}</View>}

        {d.labelText != null && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (d.prefixIcon != null ? 48 : pad.left) - 4,
              top: labelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [Math.max(0, pad.top + densityDy / 2), border === 'outline' ? -9 : 2],
              }),
              paddingHorizontal: 4,
              // The floating label interrupts the outline, as the notched border does.
              backgroundColor: floating && border === 'outline' ? fill : 'transparent',
              transform: [{ scale: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }],
              transformOrigin: 'left center',
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                ts({ size: 16, color: labelColor, height: 1.5, spacing: 0.5 }),
                d.labelStyle,
                (focused || hasError) && { color: labelColor },
                floating && d.floatingLabelStyle,
                hasError && { color: labelColor },
              ]}
            >
              {d.labelText}
            </Text>
          </Animated.View>
        )}
      </View>
      {(hasError || d.helperText != null || d.counterText != null) && (
        <View style={styles.helperRow}>
          <Text
            style={[
              ts({ size: 12, color: hasError ? Scheme.error : Scheme.onSurfaceVariant, height: 1.33, spacing: 0.4 }),
              !hasError && d.helperStyle,
              { flex: 1 },
            ]}
          >
            {hasError ? d.errorText : d.helperText ?? ''}
          </Text>
          {d.counterText != null && d.counterText.length > 0 && (
            <Text style={ts({ size: 12, color: Scheme.onSurfaceVariant, height: 1.33, spacing: 0.4 })}>{d.counterText}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── TextField ────────────────────────────────────────────────────────────────

export interface TextFieldProps {
  value: string;
  onChangeText?: (text: string) => void;
  decoration?: InputDecoration;
  /// Text style; defaults to the theme's 16px bodyLarge in the primary text colour.
  textStyle?: StyleProp<TextStyle>;
  maxLines?: number | null;
  minLines?: number;
  obscureText?: boolean;
  enabled?: boolean;
  readOnly?: boolean;
  onPress?: () => void;
  onSubmitEditing?: () => void;
  onFocusChange?: (focused: boolean) => void;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: 'done' | 'next' | 'search' | 'send' | 'go' | 'default';
  autoFocus?: boolean;
  maxLength?: number;
  /// Fill the height of the parent instead of sizing to the text.
  expands?: boolean;
  /// Tab types four spaces instead of moving focus (multi-line fields on web).
  tabInsertsSpaces?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  inputRef?: React.Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
  textAlign?: 'left' | 'center' | 'right';
}

const flat = (s: StyleProp<TextStyle>): TextStyle => StyleSheet.flatten(s) ?? {};

export function TextField({
  value,
  onChangeText,
  decoration = {},
  textStyle,
  maxLines = 1,
  minLines,
  obscureText,
  enabled = true,
  readOnly,
  onPress,
  onSubmitEditing,
  onFocusChange,
  keyboardType,
  returnKeyType,
  autoFocus,
  maxLength,
  expands,
  tabInsertsSpaces,
  autoCapitalize,
  inputRef,
  style,
  textAlign,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  // Height of the text in a field that grows with its content (maxLines: null).
  const [contentHeight, setContentHeight] = useState(0);
  const selection = useRef({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const multiline = maxLines == null || maxLines > 1;
  const grows = maxLines == null && !expands;
  const base = flat([tsField(), textStyle]);
  const lineHeight = base.lineHeight ?? (base.fontSize ?? 16) * 1.26;
  const lines = Math.max(minLines ?? 1, 1);
  const hint = flat([
    { ...base, color: Scheme.onSurfaceVariant },
    decoration.hintStyle,
  ]);
  // A label resting inside the field hides the hint until it floats.
  const showHint = decoration.labelText == null || focused;

  const input = (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      placeholder={showHint ? decoration.hintText : undefined}
      placeholderTextColor={hint.color as string}
      editable={enabled && !readOnly}
      secureTextEntry={obscureText}
      multiline={multiline}
      numberOfLines={multiline ? lines : 1}
      keyboardType={keyboardType}
      returnKeyType={returnKeyType}
      autoFocus={autoFocus}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      onSubmitEditing={onSubmitEditing}
      selection={forcedSelection}
      onSelectionChange={(e) => {
        selection.current = e.nativeEvent.selection;
        if (forcedSelection != null) setForcedSelection(undefined);
      }}
      onContentSizeChange={grows ? (e) => setContentHeight(e.nativeEvent.contentSize.height) : undefined}
      onKeyPress={
        tabInsertsSpaces
          ? (e) => {
              if (e.nativeEvent.key !== 'Tab') return;
              e.preventDefault();
              const { start, end } = selection.current;
              onChangeText?.(`${value.substring(0, start)}    ${value.substring(end)}`);
              setForcedSelection({ start: start + 4, end: start + 4 });
            }
          : undefined
      }
      onFocus={() => { setFocused(true); onFocusChange?.(true); }}
      onBlur={() => { setFocused(false); onFocusChange?.(false); }}
      underlineColorAndroid="transparent"
      style={[
        base,
        {
          padding: 0,
          margin: 0,
          textAlign,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: expands ? undefined : lineHeight * lines,
          height: grows && contentHeight > 0 ? Math.max(lineHeight * lines, contentHeight) : undefined,
          maxHeight: !expands && multiline && maxLines != null ? lineHeight * maxLines : undefined,
        },
        expands && { flex: 1 },
        Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        readOnly && onPress != null && Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
      ]}
    />
  );

  const decorated = (
    <InputDecorator
      decoration={decoration}
      focused={focused}
      hasValue={value.length > 0}
      enabled={enabled}
      multiline={multiline}
      expands={expands}
      style={onPress == null ? style : undefined}
    >
      {input}
    </InputDecorator>
  );

  if (onPress == null) return decorated;
  return (
    <Pressable onPress={onPress} style={style}>
      <View pointerEvents="none">{decorated}</View>
    </Pressable>
  );
}

// ── Dropdowns ────────────────────────────────────────────────────────────────

export interface DropdownItem<T> {
  value: T;
  /// What the menu row shows; a string uses the default item style.
  label: React.ReactNode;
  /// What the closed button shows for this value (selectedItemBuilder).
  selectedLabel?: React.ReactNode;
  enabled?: boolean;
}

interface DropdownMenuProps<T> {
  items: DropdownItem<T>[];
  value: T | null | undefined;
  onSelect: (value: T) => void;
  maxHeight?: number;
  radius?: number;
  itemTextStyle?: StyleProp<TextStyle>;
  /// Rows size to their content instead of the fixed 48px (itemHeight: null).
  freeHeight?: boolean;
}

function DropdownMenu<T>({ items, value, onSelect, maxHeight, radius = 4, itemTextStyle, freeHeight }: DropdownMenuProps<T>) {
  return (
    <View style={[styles.dropdownMenu, { borderRadius: radius, maxHeight }]}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {items.map((item, i) => {
          const enabled = item.enabled ?? true;
          return (
            <Pressable
              key={i}
              disabled={!enabled}
              onPress={() => onSelect(item.value)}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.dropdownItem,
                freeHeight && { height: undefined, minHeight: 48 },
                enabled && ({ cursor: 'pointer' } as ViewStyle),
                (hovered || (enabled && item.value === value)) && { backgroundColor: 'rgba(0,0,0,0.04)' },
              ]}
            >
              {typeof item.label === 'string' ? (
                <Text numberOfLines={1} style={[ts({ size: 16, color: Scheme.onSurface, height: 1.5, spacing: 0.5 }), itemTextStyle]}>
                  {item.label}
                </Text>
              ) : (
                item.label
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export interface DropdownProps<T> {
  value: T | null | undefined;
  items: DropdownItem<T>[];
  /// A null handler disables the dropdown.
  onChanged?: ((value: T) => void) | null;
  hint?: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
  itemTextStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  isDense?: boolean;
  isExpanded?: boolean;
  menuMaxHeight?: number;
  menuRadius?: number;
  freeItemHeight?: boolean;
  style?: StyleProp<ViewStyle>;
}

function useDropdown<T>(p: DropdownProps<T>) {
  const ref = useRef<View>(null);
  const open = async () => {
    if (p.onChanged == null) return;
    const anchor = await measureAnchor(ref);
    const picked = await showPopup<{ value: T }>(
      anchor,
      (close) => (
        <DropdownMenu
          items={p.items}
          value={p.value}
          onSelect={(value) => close({ value })}
          maxHeight={p.menuMaxHeight}
          radius={p.menuRadius}
          itemTextStyle={p.itemTextStyle ?? p.textStyle}
          freeHeight={p.freeItemHeight}
        />
      ),
      { matchWidth: true },
    );
    if (picked != null) p.onChanged(picked.value);
  };
  const selected = p.items.find((i) => i.value === p.value && p.value != null);
  const content = selected ? selected.selectedLabel ?? selected.label : p.hint;
  return { ref, open, selected, content };
}

function DropdownValue<T>({ p, content, isHint }: { p: DropdownProps<T>; content: React.ReactNode; isHint: boolean }) {
  if (typeof content === 'string') {
    return (
      <Text
        numberOfLines={1}
        style={[
          ts({ size: 16, color: isHint ? Scheme.onSurfaceVariant : AppTheme.textPrimary, height: 1.5, spacing: 0.5 }),
          p.textStyle,
          isHint && { color: Scheme.onSurfaceVariant },
        ]}
      >
        {content}
      </Text>
    );
  }
  return <>{content}</>;
}

/// Material `DropdownButton` (wrapped in DropdownButtonHideUnderline).
export function DropdownButton<T>(p: DropdownProps<T>) {
  const { ref, open, selected, content } = useDropdown(p);
  const disabled = p.onChanged == null;
  return (
    <Pressable
      ref={ref}
      onPress={open}
      disabled={disabled}
      style={[
        { flexDirection: 'row', alignItems: 'center', minHeight: p.isDense ? 24 : 48 },
        !disabled && ({ cursor: 'pointer' } as ViewStyle),
        p.style,
      ]}
    >
      <View style={p.isExpanded ? { flex: 1 } : { flexShrink: 1 }}>
        {/* A non-expanded dropdown is as wide as its widest option. */}
        {!p.isExpanded &&
          p.items.map((item, i) => (
            <View key={i} style={{ height: 0, overflow: 'hidden' }} pointerEvents="none">
              <DropdownValue p={p} content={item.selectedLabel ?? item.label} isHint={false} />
            </View>
          ))}
        <DropdownValue p={p} content={content} isHint={selected == null} />
      </View>
      {p.icon ?? <Icon name="arrow_drop_down" size={24} color={disabled ? '#BDBDBD' : '#616161'} />}
    </Pressable>
  );
}

/// Material `DropdownButtonFormField`: a dropdown inside an InputDecorator.
export function DropdownField<T>(p: DropdownProps<T> & { decoration?: InputDecoration }) {
  const { ref, open, selected, content } = useDropdown(p);
  const disabled = p.onChanged == null;
  return (
    <Pressable ref={ref} onPress={open} disabled={disabled} style={[!disabled && ({ cursor: 'pointer' } as ViewStyle), p.style]}>
      <InputDecorator decoration={p.decoration} focused={false} hasValue={selected != null || p.hint != null} enabled={!disabled}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <DropdownValue p={p} content={content} isHint={selected == null} />
          </View>
          {p.icon ?? <Icon name="arrow_drop_down" size={24} color={disabled ? '#BDBDBD' : '#616161'} />}
        </View>
      </InputDecorator>
    </Pressable>
  );
}

// ── Checkbox / Switch / Radio ────────────────────────────────────────────────

interface CheckboxProps {
  value: boolean;
  onChanged?: ((value: boolean) => void) | null;
  activeColor?: string;
  checkColor?: string;
  /// Compact tap target (materialTapTargetSize.shrinkWrap / VisualDensity.compact).
  compact?: boolean;
}

export function Checkbox({ value, onChanged, activeColor = Scheme.primary, checkColor = '#FFFFFF', compact }: CheckboxProps) {
  const disabled = onChanged == null;
  const box = 18;
  const target = compact ? 32 : Math.max(32, 48 + densityDy);
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChanged?.(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={[{ width: target, height: target, alignItems: 'center', justifyContent: 'center' }, !disabled && ({ cursor: 'pointer' } as ViewStyle)]}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          {hovered && !disabled && (
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: withOpacity(value ? Scheme.primary : Scheme.onSurface, 0.08) }} />
          )}
          <View
            style={{
              width: box,
              height: box,
              borderRadius: 2,
              borderWidth: value ? 0 : 2,
              borderColor: disabled ? withOpacity(Scheme.onSurface, 0.38) : Scheme.onSurfaceVariant,
              backgroundColor: value ? (disabled ? withOpacity(Scheme.onSurface, 0.38) : activeColor) : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {value && <Icon name="check" size={16} color={checkColor} />}
          </View>
        </>
      )}
    </Pressable>
  );
}

interface SwitchProps {
  value: boolean;
  onChanged?: ((value: boolean) => void) | null;
  activeColor?: string;
}

/// Material 3 switch: 52x32 track with a thumb that grows when on.
export function Switch({ value, onChanged, activeColor = Scheme.primary }: SwitchProps) {
  const disabled = onChanged == null;
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [value, anim]);
  const thumb = value ? 24 : 16;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChanged?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[{ height: Math.max(32, 48 + densityDy), justifyContent: 'center', opacity: disabled ? 0.38 : 1 }, !disabled && ({ cursor: 'pointer' } as ViewStyle)]}
    >
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: 16,
          borderWidth: value ? 0 : 2,
          borderColor: Scheme.outline,
          backgroundColor: value ? activeColor : Scheme.surfaceContainerHighest,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: anim.interpolate({ inputRange: [0, 1], outputRange: [value ? 4 : 6, 24] }),
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            backgroundColor: value ? Scheme.onPrimary : Scheme.outline,
          }}
        />
      </View>
    </Pressable>
  );
}

interface RadioProps {
  selected: boolean;
  onPress?: (() => void) | null;
  activeColor?: string;
  compact?: boolean;
}

export function Radio({ selected, onPress, activeColor = Scheme.primary, compact }: RadioProps) {
  const disabled = onPress == null;
  const target = compact ? 32 : Math.max(32, 48 + densityDy);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress ?? undefined}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[{ width: target, height: target, alignItems: 'center', justifyContent: 'center' }, !disabled && ({ cursor: 'pointer' } as ViewStyle)]}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? activeColor : Scheme.onSurfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: activeColor }} />}
      </View>
    </Pressable>
  );
}

export const labelLarge = (color: string = Scheme.onSurface): TextStyle =>
  tsPlain({ size: 14, weight: 500, color, spacing: 0.1, height: 1.43 });

const styles = StyleSheet.create({
  affixIcon: {
    minWidth: 48,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  dropdownMenu: {
    backgroundColor: Scheme.surface,
    overflow: 'hidden',
    boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
  },
  dropdownItem: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
});
