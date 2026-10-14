import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Scheme, ts } from '../../theme/appTheme';

// ── Imperative overlays (dialogs, popup menus, snackbars) ────────────────────
// A single host mounted at the app root renders every open dialog, menu and
// snackbar, so screens can `await showDialog(...)` and get the result back.

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DialogLayer {
  kind: 'dialog';
  id: number;
  render: (pop: (result?: unknown) => void) => React.ReactNode;
  barrierDismissible: boolean;
  barrierColor: string;
  resolve: (result: unknown) => void;
}

interface PopupLayer {
  kind: 'popup';
  id: number;
  anchor: AnchorRect;
  render: (close: (result?: unknown) => void) => React.ReactNode;
  /// 'over': the popup's top edge sits on the anchor's top edge (popup menus,
  /// dropdowns). 'below': it opens under the anchor.
  placement: 'over' | 'below';
  matchWidth: boolean;
  offsetY: number;
  resolve: (result: unknown) => void;
}

type Layer = DialogLayer | PopupLayer;

export interface SnackBarOptions {
  backgroundColor?: string;
  duration?: number;
  /// Floating snackbars sit inset from the screen edges with rounded corners.
  floating?: boolean;
  textColor?: string;
  /// Corner radius of a floating snackbar (default 4).
  radius?: number;
}

interface Snack extends SnackBarOptions {
  id: number;
  content: React.ReactNode;
}

interface HostApi {
  push: (layer: Layer) => void;
  snack: (snack: Snack) => void;
}

let host: HostApi | null = null;
let nextId = 1;

export function showDialog<T = void>(
  render: (pop: (result?: T) => void) => React.ReactNode,
  opts: { barrierDismissible?: boolean; barrierColor?: string } = {},
): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (host == null) return resolve(undefined);
    host.push({
      kind: 'dialog',
      id: nextId++,
      render: render as DialogLayer['render'],
      barrierDismissible: opts.barrierDismissible ?? true,
      barrierColor: opts.barrierColor ?? 'rgba(0,0,0,0.54)',
      resolve: resolve as (r: unknown) => void,
    });
  });
}

export function showPopup<T = void>(
  anchor: AnchorRect,
  render: (close: (result?: T) => void) => React.ReactNode,
  opts: { placement?: 'over' | 'below'; matchWidth?: boolean; offsetY?: number } = {},
): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (host == null) return resolve(undefined);
    host.push({
      kind: 'popup',
      id: nextId++,
      anchor,
      render: render as PopupLayer['render'],
      placement: opts.placement ?? 'over',
      matchWidth: opts.matchWidth ?? false,
      offsetY: opts.offsetY ?? 0,
      resolve: resolve as (r: unknown) => void,
    });
  });
}

export function showSnackBar(content: React.ReactNode, opts: SnackBarOptions = {}): void {
  host?.snack({ id: nextId++, content, ...opts });
}

/// The on-screen rectangle of a mounted view, for anchoring a popup to it.
export function measureAnchor(ref: React.RefObject<View | null>): Promise<AnchorRect> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (node == null) return resolve({ x: 0, y: 0, width: 0, height: 0 });
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

function FadeIn({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

function PopupView({ layer, close }: { layer: PopupLayer; close: (result?: unknown) => void }) {
  const window = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const { anchor } = layer;
  const margin = 8;
  let left = anchor.x;
  let top = (layer.placement === 'below' ? anchor.y + anchor.height : anchor.y) + layer.offsetY;
  if (size != null) {
    // Material popup layout: align to whichever side of the screen the
    // anchor is closer to, then keep the menu inside the window.
    if (!layer.matchWidth && anchor.x > window.width - (anchor.x + anchor.width)) {
      left = anchor.x + anchor.width - size.width;
    }
    left = Math.max(margin, Math.min(left, window.width - size.width - margin));
    top = Math.max(margin, Math.min(top, window.height - size.height - margin));
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, styles.noCursor]} onPress={() => close()} />
      <View
        onLayout={onLayout}
        style={{
          position: 'absolute',
          left,
          top,
          opacity: size == null ? 0 : 1,
          width: layer.matchWidth ? anchor.width : undefined,
          maxHeight: window.height - margin * 2,
        }}
      >
        {layer.render(close)}
      </View>
    </View>
  );
}

function SnackBarView({ snack, onDone }: { snack: Snack; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 75, useNativeDriver: true }).start(onDone);
    }, snack.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [opacity, onDone, snack.duration]);

  const floating = snack.floating ?? false;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.snack,
        floating && styles.snackFloating,
        { opacity, backgroundColor: snack.backgroundColor ?? Scheme.inverseSurface },
        floating && snack.radius != null && { borderRadius: snack.radius },
      ]}
    >
      {typeof snack.content === 'string' ? (
        <Text style={ts({ size: 14, color: snack.textColor ?? Scheme.inverseOnSurface })}>{snack.content}</Text>
      ) : (
        snack.content
      )}
    </Animated.View>
  );
}

export function OverlayHost() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [snack, setSnack] = useState<Snack | null>(null);

  useEffect(() => {
    host = {
      push: (layer) => setLayers((prev) => [...prev, layer]),
      // A new snackbar replaces the one on screen.
      snack: (s) => setSnack(s),
    };
    return () => {
      host = null;
    };
  }, []);

  const close = useCallback((layer: Layer, result?: unknown) => {
    setLayers((prev) => prev.filter((l) => l.id !== layer.id));
    layer.resolve(result);
  }, []);

  const clearSnack = useCallback(() => setSnack(null), []);
  const top = layers[layers.length - 1];

  const snackView = snack != null ? <SnackBarView key={snack.id} snack={snack} onDone={clearSnack} /> : null;

  return (
    <>
      {layers.length === 0 && snackView}
      <Modal
        visible={layers.length > 0}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          if (top == null) return;
          if (top.kind === 'popup' || top.barrierDismissible) close(top);
        }}
      >
        {layers.map((layer) =>
          layer.kind === 'dialog' ? (
            <FadeIn key={layer.id} style={StyleSheet.absoluteFill}>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.noCursor, { backgroundColor: layer.barrierColor }]}
                onPress={() => layer.barrierDismissible && close(layer)}
              />
              <View style={styles.dialogArea} pointerEvents="box-none">
                {layer.render((result) => close(layer, result))}
              </View>
            </FadeIn>
          ) : (
            <PopupView key={layer.id} layer={layer} close={(result) => close(layer, result)} />
          ),
        )}
        {layers.length > 0 && snackView}
      </Modal>
    </>
  );
}

// ── Dialog surface ───────────────────────────────────────────────────────────

interface DialogProps {
  children: React.ReactNode;
  backgroundColor?: string;
  radius?: number;
  /// Space kept between the dialog and the screen edges.
  insetPadding?: { horizontal: number; vertical: number };
  style?: StyleProp<ViewStyle>;
  clip?: boolean;
}

/// Material `Dialog`: a rounded surface sized by its child, at least 280 wide
/// and never closer than the inset padding to the screen edges.
export function Dialog({
  children,
  backgroundColor = Scheme.surfaceContainerHigh,
  radius = 28,
  insetPadding = { horizontal: 40, vertical: 24 },
  style,
  clip = false,
}: DialogProps) {
  const window = useWindowDimensions();
  return (
    <View
      style={[
        styles.dialog,
        {
          backgroundColor,
          borderRadius: radius,
          maxWidth: Math.max(0, window.width - insetPadding.horizontal * 2),
          maxHeight: Math.max(0, window.height - insetPadding.vertical * 2),
          minWidth: Math.min(280, Math.max(0, window.width - insetPadding.horizontal * 2)),
        },
        clip && { overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface AlertDialogProps {
  title?: React.ReactNode;
  content?: React.ReactNode;
  actions?: React.ReactNode;
  backgroundColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/// Material `AlertDialog`: title, content and a right-aligned action row.
export function AlertDialog({ title, content, actions, backgroundColor, radius, style }: AlertDialogProps) {
  return (
    <Dialog backgroundColor={backgroundColor} radius={radius} style={[{ maxWidth: 560 }, style]}>
      {title != null && (
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: content == null ? 24 : 0 }}>
          {typeof title === 'string' ? (
            <Text style={ts({ size: 24, color: Scheme.onSurface, height: 1.33, spacing: 0 })}>{title}</Text>
          ) : (
            title
          )}
        </View>
      )}
      {content != null && (
        <View style={{ paddingHorizontal: 24, paddingTop: title == null ? 24 : 16, paddingBottom: 24, flexShrink: 1 }}>
          {typeof content === 'string' ? (
            <Text style={ts({ size: 14, color: Scheme.onSurfaceVariant })}>{content}</Text>
          ) : (
            content
          )}
        </View>
      )}
      {actions != null && <View style={styles.actions}>{actions}</View>}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialogArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    boxShadow: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px rgba(0,0,0,0.14), 0px 1px 18px rgba(0,0,0,0.12)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // The barrier is tappable but must not show a pointer cursor on web.
  noCursor: { cursor: 'auto' } as ViewStyle,
  snack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    boxShadow: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px rgba(0,0,0,0.14), 0px 1px 18px rgba(0,0,0,0.12)',
  },
  snackFloating: {
    left: 15,
    right: 15,
    bottom: 10,
    borderRadius: 4,
  },
});
