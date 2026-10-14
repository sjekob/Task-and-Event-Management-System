import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useIsMobile } from './ui/misc';

// ─── Shared shimmer infrastructure ───────────────────────────────────────────

const ShimmerContext = createContext<Animated.Value | null>(null);

export function Shimmer({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);
  return <ShimmerContext.Provider value={progress}>{children}</ShimmerContext.Provider>;
}

interface BoneProps {
  width?: DimensionValue;
  height: number;
  phase?: number;
  radius?: number;
  colors?: readonly [string, string, string];
  style?: ViewStyle;
}

const LIGHT = ['#D0DCEB', '#ECF3FA', '#D0DCEB'] as const;
const DARK = ['#252540', '#353560', '#252540'] as const;

/// A placeholder bar with a highlight sweeping across it. The highlight is
/// 90% of the bar wide and travels from fully off the left edge to fully off
/// the right, using begin/end alignment maths for the gradient.
export function Bone({ width, height, phase = 0, radius = 4, colors = LIGHT, style }: BoneProps) {
  const progress = useContext(ShimmerContext);
  const [w, setW] = useState(0);
  const p = progress != null ? Animated.modulo(Animated.add(progress, phase), 1) : null;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors[0], overflow: 'hidden' }, style]}
    >
      {p != null && w > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: w * 0.9,
            transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-1.05 * w, 1.15 * w] }) }],
          }}
        >
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

const DarkBone = (p: Omit<BoneProps, 'colors'>) => <Bone {...p} colors={DARK} />;

// ─── Shared sub-components ────────────────────────────────────────────────────

function BannerBone() {
  return (
    <View style={styles.banner}>
      <DarkBone height={30} radius={5} style={{ alignSelf: 'stretch' }} />
      <View style={{ height: 8 }} />
      <DarkBone width="65%" height={14} phase={0.05} radius={3} />
    </View>
  );
}

function SearchBarBone() {
  return (
    <View style={[styles.card, { height: 44, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }]}>
      <Bone width={16} height={16} radius={3} />
      <View style={{ width: 8 }} />
      <Bone height={13} phase={0.02} style={{ flex: 1 }} />
    </View>
  );
}

function TaskCardBone({ phase }: { phase: number }) {
  return (
    <View style={[styles.card, { paddingLeft: 18, paddingTop: 14, paddingRight: 14, paddingBottom: 14 }]}>
      <View style={styles.row}>
        <Bone height={14} phase={phase} style={{ flex: 1 }} />
        <View style={{ width: 12 }} />
        <Bone width={68} height={22} phase={phase + 0.02} radius={11} />
      </View>
      <View style={{ height: 8 }} />
      <Bone width="75%" height={11} phase={phase + 0.03} />
      <View style={{ height: 8 }} />
      <View style={styles.row}>
        <Bone width={110} height={10} phase={phase + 0.04} />
        <View style={{ width: 16 }} />
        <Bone width={80} height={10} phase={phase + 0.05} />
      </View>
    </View>
  );
}

function StatCardBone({ phase }: { phase: number }) {
  return (
    <View style={[styles.card, styles.row, { padding: 16 }]}>
      <Bone width={40} height={40} phase={phase} radius={8} />
      <View style={{ width: 12 }} />
      <View style={{ flex: 1 }}>
        <Bone height={20} phase={phase + 0.02} style={{ alignSelf: 'stretch' }} />
        <View style={{ height: 5 }} />
        <Bone width="70%" height={11} phase={phase + 0.04} />
      </View>
    </View>
  );
}

function CalendarBone() {
  return (
    <View style={[styles.card, { padding: 16 }]}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Bone width={20} height={20} radius={10} />
        <Bone width={80} height={13} phase={0.02} />
        <Bone width={20} height={20} phase={0.04} radius={10} />
      </View>
      <View style={{ height: 10 }} />
      <View style={styles.row}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={styles.cell}>
            <Bone width={14} height={10} phase={i * 0.01} />
          </View>
        ))}
      </View>
      <View style={{ height: 6 }} />
      {Array.from({ length: 5 }, (_, row) => (
        <View key={row} style={[styles.row, { paddingTop: 4 }]}>
          {Array.from({ length: 7 }, (_, col) => (
            <View key={col} style={styles.cell}>
              <Bone width={24} height={24} phase={(row * 7 + col) * 0.008} radius={5} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SectionCardBone({ phase }: { phase: number }) {
  return (
    <View style={[styles.card, { padding: 18 }]}>
      <Bone width={90} height={10} phase={phase} />
      <View style={{ height: 12 }} />
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={{ paddingBottom: 12 }}>
          <Bone height={13} phase={phase + i * 0.03} style={{ alignSelf: 'stretch' }} />
          <View style={{ height: 4 }} />
          <Bone width="65%" height={10} phase={phase + i * 0.03 + 0.01} />
        </View>
      ))}
    </View>
  );
}

/// The non-scrolling page body every skeleton sits in.
function Page({ padding, children, align = 'stretch' }: {
  padding: [number, number, number, number];
  children: React.ReactNode;
  align?: 'stretch' | 'flex-start';
}) {
  return (
    <View
      style={{
        flex: 1,
        overflow: 'hidden',
        paddingLeft: padding[0],
        paddingTop: padding[1],
        paddingRight: padding[2],
        paddingBottom: padding[3],
        alignItems: align,
      }}
    >
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardSkeleton
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  const isMobile = useIsMobile();
  const hPad = isMobile ? 14.0 : 24.0;
  const sections = (
    <>
      <SectionCardBone phase={0.0} />
      <View style={{ height: 14 }} />
      <SectionCardBone phase={0.1} />
      <View style={{ height: 14 }} />
      <SectionCardBone phase={0.2} />
    </>
  );
  return (
    <Shimmer>
      <Page padding={[hPad, 8, hPad, 24]}>
        <BannerBone />
        <View style={{ height: 20 }} />
        <View style={styles.row}>
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={{ flex: 1, paddingLeft: i > 0 ? 12 : 0 }}>
              <StatCardBone phase={i * 0.06} />
            </View>
          ))}
        </View>
        <View style={{ height: 20 }} />
        {isMobile ? (
          sections
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>{sections}</View>
            <View style={{ width: 20 }} />
            <View style={{ width: 260 }}>
              <CalendarBone />
            </View>
          </View>
        )}
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskManagerSkeleton
// ─────────────────────────────────────────────────────────────────────────────

export function TaskManagerSkeleton() {
  const isMobile = useIsMobile();
  const hPad = isMobile ? 14.0 : 24.0;
  return (
    <Shimmer>
      <Page padding={[hPad, 8, hPad, 24]}>
        <BannerBone />
        <View style={{ height: 20 }} />
        <SearchBarBone />
        <View style={{ height: 16 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={{ paddingBottom: 10 }}>
            <TaskCardBone phase={i * 0.05} />
          </View>
        ))}
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyTasksSkeleton
// ─────────────────────────────────────────────────────────────────────────────

export function MyTasksSkeleton() {
  const isMobile = useIsMobile();
  const hPad = isMobile ? 14.0 : 24.0;
  return (
    <Shimmer>
      <Page padding={[hPad, 8, hPad, 24]}>
        <BannerBone />
        <View style={{ height: 20 }} />
        <SearchBarBone />
        <View style={{ height: 12 }} />
        <View style={styles.row}>
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={{ paddingRight: i < 2 ? 8 : 0 }}>
              <Bone width={72} height={30} phase={i * 0.03} radius={15} />
            </View>
          ))}
        </View>
        <View style={{ height: 16 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={{ paddingBottom: 10 }}>
            <TaskCardBone phase={i * 0.05} />
          </View>
        ))}
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivitySkeleton
// ─────────────────────────────────────────────────────────────────────────────

export function ActivitySkeleton() {
  const isMobile = useIsMobile();
  const hPad = isMobile ? 14.0 : 24.0;
  return (
    <Shimmer>
      <Page padding={[hPad, 4, hPad, 24]}>
        <View style={{ height: 4 }} />
        <BannerBone />
        <View style={{ height: 20 }} />
        <View style={[styles.card, { padding: 18 }]}>
          <View style={styles.row}>
            <Bone height={15} style={{ flex: 1 }} />
            <View style={{ width: 12 }} />
            <Bone width={24} height={24} phase={0.02} radius={12} />
          </View>
          <View style={{ height: 16 }} />
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={[styles.row, { paddingBottom: 14 }]}>
              <Bone width={40} height={40} phase={i * 0.04} radius={8} />
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Bone height={13} phase={i * 0.04 + 0.01} style={{ alignSelf: 'stretch' }} />
                <View style={{ height: 5 }} />
                <Bone width="55%" height={10} phase={i * 0.04 + 0.02} />
              </View>
              <View style={{ width: 12 }} />
              <Bone width={82} height={24} phase={i * 0.04 + 0.03} radius={12} />
            </View>
          ))}
        </View>
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventManagementSkeleton
// ─────────────────────────────────────────────────────────────────────────────

function EventCardBone({ phase }: { phase: number }) {
  return (
    <View style={[styles.card, { padding: 16 }]}>
      <View style={styles.row}>
        <Bone height={14} phase={phase} style={{ flex: 1 }} />
        <View style={{ width: 12 }} />
        <Bone width={90} height={22} phase={phase + 0.02} radius={11} />
      </View>
      <View style={{ height: 8 }} />
      <Bone width="60%" height={10} phase={phase + 0.03} />
      <View style={{ height: 8 }} />
      <Bone width={100} height={10} phase={phase + 0.04} />
    </View>
  );
}

function EventListBone() {
  return (
    <View>
      <View style={styles.row}>
        <Bone width={84} height={30} radius={6} />
        <View style={{ width: 8 }} />
        <Bone width={84} height={30} phase={0.03} radius={6} />
      </View>
      <View style={{ height: 12 }} />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={{ paddingBottom: 10 }}>
          <EventCardBone phase={i * 0.05} />
        </View>
      ))}
    </View>
  );
}

export function EventManagementSkeleton() {
  const isMobile = useIsMobile();
  return (
    <Shimmer>
      <Page padding={[24, 20, 24, 24]}>
        {/* Dark banner skeleton */}
        <View style={styles.eventBanner}>
          <View style={{ width: 220, height: 30, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 6 }} />
          <View style={{ height: 8 }} />
          <View style={{ width: 300, height: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
        </View>
        <View style={{ height: 20 }} />
        {isMobile ? (
          <EventListBone />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <EventListBone />
            </View>
            <View style={{ width: 20 }} />
            <View style={{ width: 290 }}>
              <CalendarBone />
            </View>
          </View>
        )}
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileSkeleton
// ─────────────────────────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  const isMobile = useIsMobile();
  const hPad = isMobile ? 14.0 : 24.0;
  return (
    <Shimmer>
      <Page padding={[hPad, 8, hPad, 32]}>
        {/* Avatar card */}
        <View style={[styles.card, { padding: 24, alignItems: 'center' }]}>
          <Bone width={80} height={80} radius={40} />
          <View style={{ height: 12 }} />
          <Bone width={160} height={17} phase={0.02} />
          <View style={{ height: 6 }} />
          <Bone width={100} height={13} phase={0.04} />
          <View style={{ height: 6 }} />
          <Bone width={80} height={22} phase={0.05} radius={11} />
        </View>
        <View style={{ height: 16 }} />
        {/* Info card */}
        <View style={[styles.card, { padding: 20 }]}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[styles.row, { paddingBottom: 16 }]}>
              <Bone width={120} height={12} phase={i * 0.03} />
              <View style={{ width: 16 }} />
              <Bone height={12} phase={i * 0.03 + 0.02} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      </Page>
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetailSkeleton
// ─────────────────────────────────────────────────────────────────────────────

function TaskDetailMain() {
  return (
    <>
      <Bone width={80} height={28} radius={6} />
      <View style={{ height: 18 }} />
      <Bone height={22} phase={0.02} style={{ alignSelf: 'stretch' }} />
      <View style={{ height: 8 }} />
      <Bone width="55%" height={13} phase={0.03} />
      <View style={{ height: 20 }} />
      <Bone height={12} phase={0.04} style={{ alignSelf: 'stretch' }} />
      <View style={{ height: 5 }} />
      <Bone height={12} phase={0.05} style={{ alignSelf: 'stretch' }} />
      <View style={{ height: 5 }} />
      <Bone width="80%" height={12} phase={0.06} />
      <View style={{ height: 20 }} />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={[styles.row, { paddingBottom: 10, alignSelf: 'stretch' }]}>
          <Bone width={100} height={12} phase={i * 0.04 + 0.07} />
          <View style={{ width: 12 }} />
          <Bone height={12} phase={i * 0.04 + 0.09} style={{ flex: 1 }} />
        </View>
      ))}
    </>
  );
}

/// Pass hasBack=true when the screen is used inside a route (has onBack),
/// false when it fills its own page background.
export function TaskDetailSkeleton({ hasBack = false }: { hasBack?: boolean }) {
  const isMobile = useIsMobile();
  const body = isMobile ? (
    <Page padding={[14, 14, 14, 28]} align="flex-start">
      <TaskDetailMain />
    </Page>
  ) : (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch' }}>
      <Page padding={[28, 14, 28, 28]} align="flex-start">
        <TaskDetailMain />
      </Page>
      <View style={styles.detailSide}>
        <Bone width={80} height={13} phase={0.1} />
        <View style={{ height: 16 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={[styles.row, { paddingBottom: 12, alignSelf: 'stretch' }]}>
            <Bone width={36} height={36} phase={i * 0.03 + 0.1} radius={18} />
            <View style={{ width: 10 }} />
            <Bone height={13} phase={i * 0.03 + 0.11} style={{ flex: 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <Shimmer>
      {hasBack ? body : <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>{body}</View>}
    </Shimmer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppraisalTabSkeleton  (used by both SpecialTasks and Events tabs)
// ─────────────────────────────────────────────────────────────────────────────

export function AppraisalTabSkeleton() {
  return (
    <Shimmer>
      <View style={{ overflow: 'hidden', alignItems: 'flex-start' }}>
        {/* 4 stat cards */}
        <View style={[styles.row, { alignSelf: 'stretch' }]}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={{ flex: 1, paddingLeft: i > 0 ? 12 : 0 }}>
              <StatCardBone phase={i * 0.05} />
            </View>
          ))}
        </View>
        <View style={{ height: 16 }} />
        {/* Section label */}
        <Bone width={140} height={13} phase={0.2} />
        <View style={{ height: 12 }} />
        {/* Table header */}
        <View style={styles.tableHeader}>
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={{ flex: 1, paddingRight: i < 4 ? 12 : 0 }}>
              <Bone height={12} phase={0.22 + i * 0.02} />
            </View>
          ))}
        </View>
        <View style={{ height: 4 }} />
        {/* Table rows */}
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.tableRow, i < 5 && { borderBottomWidth: 1, borderBottomColor: '#D0DCEB' }]}>
            {Array.from({ length: 5 }, (_, col) => (
              <View key={col} style={{ flex: 1, paddingRight: col < 4 ? 12 : 0 }}>
                <Bone height={12} phase={0.24 + i * 0.02 + col * 0.01} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </Shimmer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0DCEB',
  },
  banner: {
    alignSelf: 'stretch',
    paddingHorizontal: 28,
    paddingVertical: 24,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    alignItems: 'flex-start',
  },
  eventBanner: {
    height: 148,
    alignSelf: 'stretch',
    backgroundColor: '#1E2126',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  detailSide: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#D0DCEB',
    paddingLeft: 16,
    paddingTop: 20,
    paddingRight: 16,
    paddingBottom: 24,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  tableHeader: {
    height: 44,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8D6E5',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  tableRow: {
    height: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
