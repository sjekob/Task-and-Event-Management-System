import { ReactNode, useState } from 'react';
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { C } from './theme';

/**
 * A scrolling page body with the app background and padding. With
 * [onRefresh], pulling down reloads.
 */
export function Screen({ children, onRefresh, style, scroll = true }: {
  children: ReactNode; onRefresh?: () => Promise<unknown> | void; style?: StyleProp<ViewStyle>; scroll?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = onRefresh ? async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  } : undefined;
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 14 }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[{ padding: 16, gap: 14, paddingBottom: 40 }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Horizontal stack. */
export const Row = ({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>
);

/** Vertical stack. */
export const Col = ({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ gap }, style]}>{children}</View>
);
