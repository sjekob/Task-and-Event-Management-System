import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { C } from '../../ui/kit';

/** Height of the collapsed bar (handle + summary), above the safe-area inset. */
export const SHEET_PEEK = 78;
const TOP_GAP = 12;  // how much of the screen stays visible above the open sheet

// Where a flick would come to rest if it kept decelerating (Apple's decay form).
function project(velocity: number, rate = 0.998) {
  'worklet';
  return ((velocity / 1000) * rate) / (1 - rate);
}
// Past the top, the sheet follows less and less instead of stopping dead.
function rubberband(over: number, dim: number, k = 0.55) {
  'worklet';
  return (over * dim * k) / (dim + k * Math.abs(over));
}

/**
 * The submission as a bottom sheet, like Google Classroom's "Your work".
 * Collapsed, a bar on the bottom shows who and their status; tap it, drag it
 * up, or tap someone in the list and the sheet rises over the screen. Drag
 * the bar down (a flick is enough), tap it, tap outside, or press Back to put
 * it away. Motion runs on the UI thread; the finger's speed carries into the
 * settle, and Reduce Motion is respected.
 */
export function WorkSheet({ open, onOpenChange, summary, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);            // the screen area the sheet lives in
  const sheetH = Math.max(0, height - TOP_GAP);
  const peek = SHEET_PEEK + insets.bottom;
  const closedY = Math.max(0, sheetH - peek);         // translateY when collapsed

  const y = useSharedValue(10000);                     // offscreen until measured
  const from = useSharedValue(0);
  const fling = useSharedValue(0);                     // release velocity, handed to the settle

  // Settle at the resting place for [open] (also after a drag decided it).
  useEffect(() => {
    if (!height) return;
    y.set(withSpring(open ? 0 : closedY, {
      duration: 300, dampingRatio: 1, velocity: fling.get(), overshootClamping: true, reduceMotion: ReduceMotion.System,
    }));
    fling.set(0);
  }, [open, closedY, height, y, fling]);

  // Android Back closes the open sheet before leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onOpenChange(false); return true; });
    return () => sub.remove();
  }, [open, onOpenChange]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onStart(() => { from.set(y.get()); })   // grab it where the eye sees it, mid-animation too
      .onUpdate((e) => {
        const next = from.get() + e.translationY;
        y.set(next < 0 ? rubberband(next, sheetH) : Math.min(next, closedY + 24));
      })
      .onEnd((e) => {
        const projected = y.get() + project(e.velocityY);
        const shouldOpen = projected < closedY / 2;
        fling.set(e.velocityY);
        // Same state as before (a short drag that springs back): settle here.
        y.set(withSpring(shouldOpen ? 0 : closedY, {
          duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true, reduceMotion: ReduceMotion.System,
        }));
        scheduleOnRN(onOpenChange, shouldOpen);
      });
    const tap = Gesture.Tap().onEnd((_e, ok) => { if (ok) scheduleOnRN(onOpenChange, !open); });
    return Gesture.Race(pan, tap);
  }, [closedY, sheetH, open, onOpenChange, y, from, fling]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, Math.max(1, closedY)], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(43,34,32,0.35)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={() => onOpenChange(false)} accessibilityLabel="Hide the submission" />
      </Animated.View>
      {height > 0 && (
        <Animated.View style={[styles.sheet, { height: sheetH }, sheetStyle]}>
          <GestureDetector gesture={gesture}>
            <View style={styles.grab} accessible accessibilityRole="button" accessibilityState={{ expanded: open }}
              accessibilityLabel={open ? 'Hide the submission' : 'Show the submission'}>
              <View style={styles.handle} />
              <View style={{ minHeight: 40, justifyContent: 'center' }}>{summary}</View>
            </View>
          </GestureDetector>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 14, paddingBottom: 24 + insets.bottom }}>
            {children}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#2B2220', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  grab: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginBottom: 10 },
});
