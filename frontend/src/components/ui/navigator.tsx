import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AppTheme } from '../../theme/appTheme';

// ── Pushed pages (full-screen pages stacked over the current route) ──────────
// Some screens open another screen full-window, on top of the shell, and wait
// for its result. A host mounted at the app root stacks those pages.

interface PageEntry {
  id: number;
  render: (pop: (result?: unknown) => void) => React.ReactNode;
  resolve: (result: unknown) => void;
}

let pushEntry: ((entry: PageEntry) => void) | null = null;
let nextId = 1;

export function pushPage<T = void>(render: (pop: (result?: T) => void) => React.ReactNode): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (pushEntry == null) return resolve(undefined);
    pushEntry({ id: nextId++, render: render as PageEntry['render'], resolve: resolve as (r: unknown) => void });
  });
}

function PageView({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: AppTheme.bgColor,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function PageHost() {
  const [pages, setPages] = useState<PageEntry[]>([]);

  useEffect(() => {
    pushEntry = (entry) => setPages((prev) => [...prev, entry]);
    return () => {
      pushEntry = null;
    };
  }, []);

  const pop = useCallback((entry: PageEntry, result?: unknown) => {
    setPages((prev) => prev.filter((p) => p.id !== entry.id));
    entry.resolve(result);
  }, []);

  return (
    <>
      {pages.map((entry) => (
        <PageView key={entry.id}>{entry.render((result) => pop(entry, result))}</PageView>
      ))}
    </>
  );
}
