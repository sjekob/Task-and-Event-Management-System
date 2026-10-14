import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AuditHistory } from '../components/AuditHistory';
import { CertificatesPanel } from '../components/CertificatesPanel';
import { Bone, Shimmer } from '../components/skeletonWidgets';
import { Icon } from '../components/ui/Icon';
import { ElevatedButton, IconButton, InkWell, OutlinedButton, Tap, TextButton } from '../components/ui/buttons';
import { DropdownField, DropdownItem, InputDecoration, Switch, TextField } from '../components/ui/inputs';
import { CircularProgressIndicator, PopupMenuButton, Tooltip } from '../components/ui/misc';
import { AlertDialog, Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { lightPickerColors, showDatePicker } from '../components/ui/pickers';
import { Json, SkillInfo, User, tryParseDate } from '../models/models';
import { exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { PersonnelService } from '../services/personnelService';
import { AppTheme, Scheme, ts, tsField, tsPlain } from '../theme/appTheme';

// ── Design tokens ─────────────────────────────────────────────────────────────
const kPageBg = '#DDE6F0';
const kBannerBg = '#1A1A2E';
const kNavSel = '#6B7A92';
const kTableHead = '#C8D6E5';
const kRowBorder = '#D0DCEB';
const kAddBtn = '#2D3748';
const kDeactTxt = '#9AA5B4';
const kLinkBlue = '#4A7FA5';
const BLACK87 = 'rgba(0,0,0,0.87)';
const GREY = { 50: '#FAFAFA', 200: '#EEEEEE', 300: '#E0E0E0', 400: '#BDBDBD', 500: '#9E9E9E', 600: '#757575', 700: '#616161' };

const capitalize = (s: string) => `${s[0].toUpperCase()}${s.substring(1)}`;

// ── Personnel list state (PersonnelProvider) ──────────────────────────────────

const PAGE_SIZE = 30;

// Last unfiltered first page, kept across visits to the Personnel tab so it
// opens instantly; load() then refreshes it in the background.
let cache: User[] | null = null;
let cacheHasMore = true;

function usePersonnel() {
  const [personnel, setPersonnel] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const search = useRef('');
  const busy = useRef(false);
  const count = useRef(0);
  count.current = personnel.length;

  const load = useCallback(async () => {
    const cached = search.current.length === 0 ? cache : null;
    if (cached != null) {
      // Show the last list right away (no skeleton), then refresh quietly.
      setPersonnel(cached);
      setHasMore(cacheHasMore);
    } else {
      setLoading(true);
      setHasMore(true);
    }
    try {
      const page = await PersonnelService.listPage({ search: search.current, limit: PAGE_SIZE, offset: 0 });
      setPersonnel(page.items);
      setHasMore(page.hasMore);
      if (search.current.length === 0) {
        cache = [...page.items];
        cacheHasMore = page.hasMore;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /// Append the next page (infinite scroll). No-op if already loading or done.
  const loadMore = async () => {
    if (busy.current || loading || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await PersonnelService.listPage({ search: search.current, limit: PAGE_SIZE, offset: count.current });
      setPersonnel((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };

  return {
    active: personnel.filter((u) => u.isActive),
    inactive: personnel.filter((u) => !u.isActive),
    loading,
    loadingMore,
    hasMore,
    tabIndex,
    setTabIndex,
    load,
    loadMore,
    search: (query: string) => {
      search.current = query;
      load().catch(() => {});
    },
    toggleStatus: async (userId: number) => {
      await PersonnelService.toggleStatus(userId);
      await load();
    },
  };
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function PersonnelScreen() {
  const app = useAppState();
  const provider = usePersonnel();
  const [searchText, setSearchText] = useState('');
  const { load } = provider;

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Principal/admin add users and change roles/delegations; the registrar
  // may only deactivate/reactivate accounts (enforced server-side).
  const canWrite = app.can('manage_personnel');
  const canToggle = app.can('deactivate_personnel');

  const openAdd = async () => {
    const result = await showDialog<boolean>((pop) => <AddUserDialog pop={pop} />);
    if (result === true) {
      provider.load().catch(() => {});
      showSnackBar('Personnel added.');
    }
  };

  const openEdit = async (user: User) => {
    const result = await showDialog<boolean>((pop) => <EditRoleDialog user={user} pop={pop} />);
    if (result === true) {
      provider.load().catch(() => {});
      showSnackBar('Personnel updated.');
    }
  };

  const openDetail = (user: User) => {
    showDialog((pop) => <PersonnelDetailDialog user={user} onClose={() => pop()} />);
  };

  const confirmToggle = async (user: User) => {
    const action = user.isActive ? 'deactivate' : 'reactivate';
    const confirm = await showDialog<boolean>((pop) => (
      <AlertDialog
        title={`Confirm ${capitalize(action)}`}
        content={`Are you sure you want to ${action} ${user.fullName}?`}
        actions={
          <>
            <TextButton onPress={() => pop(false)}>Cancel</TextButton>
            <ElevatedButton onPress={() => pop(true)} backgroundColor={user.isActive ? '#F44336' : '#4CAF50'}>
              {capitalize(action)}
            </ElevatedButton>
          </>
        }
      />
    ));
    if (confirm !== true) return;
    try {
      await provider.toggleStatus(user.id);
      showSnackBar(`${user.fullName} has been ${user.isActive ? 'deactivated' : 'reactivated'}.`);
    } catch (e) {
      showSnackBar(`Failed: ${exceptionText(e)}`, { backgroundColor: '#F44336' });
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y >= contentSize.height - layoutMeasurement.height - 300) provider.loadMore();
  };

  const table = (users: User[], isDeactivated: boolean) => (
    <UserDataTable
      users={users}
      tabIndex={provider.tabIndex}
      isDeactivated={isDeactivated}
      canWrite={canWrite}
      canToggle={canToggle}
      currentUserId={app.currentUser?.id ?? null}
      onView={openDetail}
      onEdit={openEdit}
      onToggle={confirmToggle}
    />
  );

  return (
    <ScrollView
      style={{ backgroundColor: kPageBg }}
      onScroll={onScroll}
      scrollEventThrottle={100}
      contentContainerStyle={{ paddingLeft: 24, paddingTop: 20, paddingRight: 24, paddingBottom: 32 }}
    >
      <HeroBanner />
      <View style={{ height: 20 }} />

      {/* Tab row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TabButton label="Academic Delegation" active={provider.tabIndex === 0} onTap={() => provider.setTabIndex(0)} />
        <View style={{ width: 8 }} />
        <TabButton label="Personal Information" active={provider.tabIndex === 1} onTap={() => provider.setTabIndex(1)} />
      </View>
      <View style={{ height: 16 }} />

      {/* Search + Add */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextField
          style={{ flex: 1 }}
          value={searchText}
          onChangeText={(v) => {
            setSearchText(v);
            provider.search(v);
          }}
          decoration={{
            hintText: 'Search',
            prefixIcon: <Icon name="search" color="rgba(0,0,0,0.45)" />,
            filled: true,
            fillColor: '#FFFFFF',
            contentPadding: [16, 12],
            radius: 10,
            borderColor: GREY[300],
            borderWidth: 1,
            focusedBorderColor: GREY[400],
            focusedBorderWidth: 1,
          }}
        />
        {canWrite && (
          <>
            <View style={{ width: 12 }} />
            <ElevatedButton
              onPress={openAdd}
              icon={<Icon name="add" color="#FFFFFF" size={18} />}
              backgroundColor={kAddBtn}
              minimumSize={{ width: 0, height: 48 }}
              padding={[20, 0]}
              radius={10}
              elevation={0}
              textStyle={tsPlain({ weight: 600 })}
            >
              Add User
            </ElevatedButton>
          </>
        )}
      </View>
      <View style={{ height: 16 }} />

      {/* Content or skeleton */}
      {provider.loading ? (
        <PersonnelSkeleton />
      ) : (
        <View>
          <CollapsibleSection title="Active Users" count={provider.active.length} initiallyExpanded>
            {table(provider.active, false)}
          </CollapsibleSection>
          {provider.inactive.length > 0 && (
            <>
              <View style={{ height: 20 }} />
              <CollapsibleSection
                title="Deactivated Accounts"
                count={provider.inactive.length}
                initiallyExpanded={false}
                isDeactivated
              >
                {table(provider.inactive, true)}
              </CollapsibleSection>
            </>
          )}
        </View>
      )}
      {!provider.loading && provider.hasMore && (
        <View style={{ paddingTop: 16, alignItems: 'center' }}>
          {provider.loadingMore ? (
            <CircularProgressIndicator strokeWidth={2} />
          ) : (
            <OutlinedButton onPress={provider.loadMore}>Load more</OutlinedButton>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Hero banner ───────────────────────────────────────────────────────────────

function hexPath(width: number, height: number): string {
  const r = 28.0;
  const h = r * 1.732;
  let d = '';
  const hex = (cx: number, cy: number) => {
    for (let i = 0; i < 6; i++) {
      const a = ((i * 60 - 30) * Math.PI) / 180;
      d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    }
    d += 'Z';
  };
  for (let y = -r; y < height + r; y += h) {
    for (let x = -r; x < width + r; x += r * 3) {
      hex(x, y);
      hex(x + r * 1.5, y + h / 2);
    }
  }
  return d;
}

function HeroBanner() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const path = useMemo(() => hexPath(size.width, size.height), [size.width, size.height]);
  return (
    <View
      style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: kBannerBg }}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Path d={path} stroke="rgba(255,255,255,0.05)" strokeWidth={1.5} fill="none" />
        </Svg>
      )}
      <View style={{ paddingHorizontal: 24, paddingVertical: 28, alignItems: 'flex-start' }}>
        <Text style={ts({ color: '#FFFFFF', size: 28, weight: 700, spacing: -0.5 })}>User Manager</Text>
        <View style={{ height: 4 }} />
        <Text style={ts({ color: 'rgba(255,255,255,0.7)', size: 13 })}>
          Easily manage user profiles, roles, and permissions.
        </Text>
      </View>
    </View>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) {
  return (
    <Tap onPress={onTap}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: active ? kNavSel : '#FFFFFF',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: kRowBorder,
        }}
      >
        <Text style={ts({ color: active ? '#FFFFFF' : BLACK87, weight: 500, size: 13 })}>{label}</Text>
      </View>
    </Tap>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({ title, count, children, initiallyExpanded = true, isDeactivated = false }: {
  title: string;
  count: number;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
  isDeactivated?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const headerColor = isDeactivated ? '#E8ECF0' : kTableHead;
  const titleColor = isDeactivated ? kDeactTxt : BLACK87;
  return (
    <View>
      <InkWell onPress={() => setExpanded((v) => !v)} radius={8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 11,
            backgroundColor: headerColor,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: kRowBorder,
          }}
        >
          <Text style={ts({ color: titleColor, weight: 600, size: 14 })}>{`${title} (${count})`}</Text>
          <View style={{ flex: 1 }} />
          <Icon name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} color={titleColor} />
        </View>
      </InkWell>
      {expanded && (
        <>
          <View style={{ height: 12 }} />
          {children}
        </>
      )}
    </View>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────

interface Column {
  header: string;
  numeric?: boolean;
  cell: (u: User) => React.ReactNode;
}

const ROW_HEIGHT = 52;

function UserDataTable({ users, tabIndex, isDeactivated, canWrite, canToggle, currentUserId, onView, onEdit, onToggle }: {
  users: User[];
  tabIndex: number;
  isDeactivated: boolean;
  canWrite: boolean;
  canToggle: boolean;
  currentUserId: number | null;
  onView: (u: User) => void;
  onEdit: (u: User) => void;
  onToggle: (u: User) => void;
}) {
  const [minWidth, setMinWidth] = useState(0);
  if (users.length === 0) return null;

  const dim = ts({ color: isDeactivated ? kDeactTxt : BLACK87, size: 13 });
  const link: TextStyle = { ...dim, color: isDeactivated ? kDeactTxt : kLinkBlue };
  const t = (v: string, style: TextStyle = dim) => <Text numberOfLines={1} style={style}>{v}</Text>;
  const list = (items: string[]) => (
    <Tooltip message={items.join('\n')} style={{ maxWidth: 200 }}>
      {t(items.length === 0 ? '—' : items.join(', '))}
    </Tooltip>
  );

  const action: Column = {
    header: 'Action',
    cell: (u) => {
      const items: { value: string; child: React.ReactNode }[] = [];
      if (canWrite && !isDeactivated) items.push({ value: 'edit', child: 'Edit' });
      items.push({ value: 'view', child: 'View Details' });
      // Nobody deactivates themselves; principal/admin accounts only by
      // the principal/admin.
      if (canToggle && currentUserId !== u.id && (canWrite || (u.role !== 'principal' && u.role !== 'admin'))) {
        items.push({
          value: 'toggle',
          child: (
            <Text style={tsPlain({ size: 14, weight: 500, spacing: 0.1, height: 1.43, color: isDeactivated ? '#4A6FA5' : '#F44336' })}>
              {isDeactivated ? 'Reactivate' : 'Deactivate'}
            </Text>
          ),
        });
      }
      return (
        <PopupMenuButton<string>
          icon={<Icon name="more_vert" size={20} color={Scheme.onSurfaceVariant} />}
          onSelected={(v) => {
            if (v === 'view') onView(u);
            if (v === 'edit') onEdit(u);
            if (v === 'toggle') onToggle(u);
          }}
          items={items}
        />
      );
    },
  };

  const columns: Column[] =
    tabIndex === 0
      ? [
          { header: 'ID', cell: () => t('—') },
          { header: 'Name', cell: (u) => t(u.fullName, link) },
          { header: 'Username', cell: (u) => t(u.username) },
          { header: 'Contact', cell: (u) => t(u.phoneNumber ?? '—') },
          { header: 'Email', cell: (u) => t(u.email ?? '—') },
          { header: 'Subject', cell: (u) => t(u.subjects.length > 0 ? u.subjects[0].subject : '—') },
          { header: 'Grade Level', cell: (u) => t(u.gradeLevel ?? '—') },
          { header: 'Role', cell: (u) => t(u.roleLabel) },
          action,
        ]
      : [
          { header: 'ID', cell: () => t('—') },
          { header: 'Name', cell: (u) => t(u.fullName, link) },
          { header: 'Birthdate', cell: (u) => t(u.birthdate ?? '—') },
          { header: 'Specialization', cell: (u) => t(u.education.specialization ?? '—') },
          { header: 'Skills', cell: (u) => list(u.skills) },
          { header: 'Certifications', cell: (u) => list(u.certifications) },
          { header: 'Children', numeric: true, cell: (u) => t(`${u.numberOfChildren}`) },
          { header: 'Date Hired', cell: (u) => t(u.dateOfAppointment ?? '—') },
          { header: 'Address', cell: (u) => t(u.address ?? '—') },
          action,
        ];

  return (
    <View
      style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: kRowBorder }}
      onLayout={(e) => setMinWidth(e.nativeEvent.layout.width - 2)}
    >
      <ScrollView horizontal contentContainerStyle={{ minWidth, flexDirection: 'row' }}>
        {/* Laid out column by column so each column is as wide as its widest
            cell, with spare width shared equally, as DataTable sizes them. */}
        {columns.map((col, c) => {
          const pad = {
            paddingLeft: c === 0 ? 16 : 10,
            paddingRight: c === columns.length - 1 ? 16 : 10,
            alignItems: col.numeric ? ('flex-end' as const) : ('flex-start' as const),
            justifyContent: 'center' as const,
          };
          return (
            <View key={col.header} style={{ flexGrow: 1 }}>
              <View style={[pad, { height: 44, backgroundColor: kTableHead }]}>
                <Text numberOfLines={1} style={ts({ weight: 700, size: 13, color: Scheme.onSurface })}>{col.header}</Text>
              </View>
              {users.map((u, r) => (
                <View
                  key={u.id}
                  style={[pad, { height: ROW_HEIGHT }, r > 0 && { borderTopWidth: 1, borderTopColor: kRowBorder }]}
                >
                  {col.cell(u)}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const FLEXES = [1, 3, 2, 2, 2, 2, 1];
const FACTORS = [0.6, 0.85, 0.7, 0.65, 0.75, 0.7, 0.4];

/// Shimmer skeleton that mirrors the personnel table's column layout.
function PersonnelSkeleton() {
  const boneRow = (factors: number[], isHeader = false, rowIndex = 0) => (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      {FLEXES.map((flex, i) => (
        <View key={i} style={{ flex }}>
          <Bone width={`${factors[i] * 100}%`} height={isHeader ? 14 : 12} phase={i * 0.03 + rowIndex * 0.01} />
        </View>
      ))}
    </View>
  );
  return (
    <Shimmer>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: kRowBorder }}>
        {/* Header */}
        <View style={{ height: 44, backgroundColor: kTableHead, borderTopLeftRadius: 11, borderTopRightRadius: 11, paddingHorizontal: 16 }}>
          {boneRow(Array(7).fill(0.9), true)}
        </View>
        {/* Data rows */}
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            style={[
              { height: 56, paddingHorizontal: 16, paddingVertical: 16 },
              i < 6 && { borderBottomWidth: 1, borderBottomColor: kRowBorder },
            ]}
          >
            {boneRow(FACTORS, false, i)}
          </View>
        ))}
      </View>
    </Shimmer>
  );
}

// ── User detail dialog ────────────────────────────────────────────────────────

function PersonnelDetailDialog({ user: u, onClose }: { user: User; onClose: () => void }) {
  const app = useAppState();
  const subjects =
    u.subjects.length > 0
      ? u.subjects.map((s) => (s.gradeLevel != null ? `${s.subject} (${s.gradeLevel})` : s.subject)).join(', ')
      : '—';

  let coordinatorLabel: string | null = null;
  if (u.role === 'coordinator') {
    coordinatorLabel = u.coordinatorType ?? 'Coordinator';
  } else if (u.role === 'dean') {
    coordinatorLabel = u.deanGradeLevel != null ? `Dean — ${u.deanGradeLevel}` : 'Dean';
  }

  const sectionHeader = (title: string) => (
    <View style={{ alignSelf: 'stretch', alignItems: 'flex-start' }}>
      <Text style={ts({ size: 18, weight: 700, color: BLACK87 })}>{title}</Text>
      <View style={{ height: 8 }} />
      <View style={{ height: 1, backgroundColor: '#E5E7EB', alignSelf: 'stretch' }} />
      <View style={{ height: 16 }} />
    </View>
  );

  const field = (label: string, value: string) => (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={ts({ size: 12, color: '#9CA3AF' })}>{label}</Text>
      <View style={{ height: 4 }} />
      <Text style={ts({ size: 15, weight: 400, color: BLACK87 })}>{value}</Text>
    </View>
  );

  const twoCol = (l: React.ReactNode, r: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' }}>
      <View style={{ flex: 1 }}>{l}</View>
      <View style={{ width: 24 }} />
      <View style={{ flex: 1 }}>{r}</View>
    </View>
  );

  /// One field per category ("Other" last), listing that category's items.
  const grouped = (items: SkillInfo[]) => {
    if (items.length === 0) {
      return (
        <>
          {field('None on file', '—')}
          <View style={{ height: 18 }} />
        </>
      );
    }
    const groups = new Map<string, string[]>();
    for (const it of items) {
      const key = it.category ?? 'Other';
      groups.set(key, [...(groups.get(key) ?? []), it.name]);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a < b ? -1 : a > b ? 1 : 0));
    return keys.map((k) => (
      <React.Fragment key={k}>
        {field(k, groups.get(k)!.join(', '))}
        <View style={{ height: 18 }} />
      </React.Fragment>
    ));
  };

  const gap = (h: number) => <View style={{ height: h }} />;

  return (
    <Dialog backgroundColor="#FFFFFF" radius={16}>
      <View style={{ width: 700, maxWidth: '100%', height: 700, maxHeight: '100%' }}>
        <View style={styles.detailHeader}>
          <Text style={ts({ color: '#FFFFFF', size: 18, weight: 700 })}>User Details</Text>
          <View style={{ flex: 1 }} />
          <IconButton onPress={onClose} size={22} padding={0} compact icon={<Icon name="close" color="#FFFFFF" size={22} />} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingLeft: 28, paddingTop: 24, paddingRight: 28, paddingBottom: 8, alignItems: 'flex-start' }}
        >
          {sectionHeader('Basic Information')}
          {twoCol(
            field('ID', u.id > 0 ? `${u.id}`.padStart(3, '0') : '—'),
            field('Name', u.fullName.length > 0 ? u.fullName : '—'),
          )}
          {gap(18)}
          {twoCol(field('Username', u.username), field('Role', u.roleLabel))}
          {gap(18)}
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={ts({ size: 12, color: '#9CA3AF' })}>Status</Text>
            <View style={{ height: 4 }} />
            <Text style={ts({ size: 15, weight: 600, color: u.isActive ? '#16A34A' : '#DC2626' })}>
              {u.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          {gap(24)}
          {sectionHeader('Contact Information')}
          {twoCol(field('Email', u.email ?? '—'), field('Contact Number', u.phoneNumber ?? '—'))}
          {gap(18)}
          {field('Address', u.address ?? '—')}
          {gap(24)}
          {sectionHeader('Academic Information')}
          {u.isDean && (u.department ?? '').length > 0 && (
            <>
              {field('Department', u.department!)}
              {gap(18)}
            </>
          )}
          {coordinatorLabel != null && (
            <>
              {field('Assignment', coordinatorLabel)}
              {gap(18)}
            </>
          )}
          {field('Subject-Grade Assignments', subjects)}
          {gap(24)}
          {sectionHeader('Personal Information')}
          {twoCol(field('Birthdate', u.birthdate ?? '—'), field('Date Hired', u.dateOfAppointment ?? '—'))}
          {gap(18)}
          {field('Number of Children', `${u.numberOfChildren}`)}
          {gap(24)}
          {sectionHeader('Educational Background')}
          {twoCol(
            field('Highest Educational Attainment', u.education.highestAttainment ?? '—'),
            field('Undergraduate Degree', u.education.undergraduateDegree ?? '—'),
          )}
          {gap(18)}
          {twoCol(
            field('Area of Specialization', u.education.specialization ?? '—'),
            field('Postgraduate Program Focus', u.education.postgraduateFocus ?? '—'),
          )}
          {gap(24)}
          {sectionHeader('Certifications & Eligibility')}
          {/* The principal/registrar verifies or rejects uploaded
              certificates here (never their own; enforced server-side). */}
          <View style={{ alignSelf: 'stretch' }}>
            <CertificatesPanel
              userId={u.id}
              canReview={app.can('review_certificates') && app.currentUser?.id !== u.id}
            />
          </View>
          {gap(18)}
          {sectionHeader('Skills')}
          {grouped(u.skillDetails)}
          {gap(8)}
          {/* Timestamped account/delegation changes (principal/admin). */}
          {app.can('view_audit') && (
            <>
              {gap(16)}
              {sectionHeader('Change History')}
              <AuditHistory entityType="user" entityId={u.id} />
              {gap(8)}
            </>
          )}
        </ScrollView>
        <View style={{ paddingLeft: 24, paddingTop: 8, paddingRight: 24, paddingBottom: 18, alignItems: 'flex-start' }}>
          <ElevatedButton
            onPress={onClose}
            backgroundColor={kNavSel}
            foregroundColor="#FFFFFF"
            padding={[28, 12]}
            radius={8}
            elevation={0}
            textStyle={tsPlain({ weight: 600 })}
          >
            Close
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ── Add user dialog ───────────────────────────────────────────────────────────

const addDecoration = (hint: string, errorText?: string | null): InputDecoration => ({
  hintText: hint,
  hintStyle: tsField({ color: GREY[500], size: 14 }),
  errorText,
  filled: true,
  fillColor: '#FFFFFF',
  contentPadding: [16, 14],
  radius: 10,
  borderColor: GREY[300],
  borderWidth: 1,
  focusedBorderColor: GREY[500],
  focusedBorderWidth: 1.5,
});

function AddUserDialog({ pop }: { pop: (result?: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const submit = async () => {
    const next = {
      email: email.trim().length === 0 ? 'Required' : null,
      username: username.trim().length === 0 ? 'Required' : null,
      password: password.length === 0 ? 'Required' : password.length < 6 ? 'Min. 6 characters' : null,
    };
    setErrors(next);
    if (Object.values(next).some((e) => e != null)) return;
    setSaving(true);
    try {
      const name = username.trim();
      await PersonnelService.create({
        email: email.trim(),
        username: name,
        password,
        first_name: name,
        last_name: '',
        role: 'teacher',
      });
      pop(true);
    } catch (e) {
      showSnackBar(`Error: ${exceptionText(e)}`, { backgroundColor: '#F44336' });
      setSaving(false);
    }
  };

  const canSubmit = email.length > 0 && username.length > 0 && password.length >= 6;
  const label = (text: string) => <Text style={ts({ size: 13, weight: 600, color: BLACK87 })}>{text}</Text>;
  const inputStyle = tsField({ color: BLACK87, size: 14 });

  return (
    <Dialog backgroundColor="#F0F2F5" radius={16}>
      <View style={{ width: 420, maxWidth: '100%', paddingLeft: 28, paddingTop: 28, paddingRight: 28, paddingBottom: 24 }}>
        <Text style={ts({ size: 20, weight: 700, color: BLACK87 })}>Add New User</Text>
        <View style={{ height: 24 }} />
        {label('Email')}
        <View style={{ height: 6 }} />
        <TextField value={email} onChangeText={setEmail} autoCapitalize="none" textStyle={inputStyle} decoration={addDecoration('Email', errors.email)} />
        <View style={{ height: 16 }} />
        {label('Username')}
        <View style={{ height: 6 }} />
        <TextField value={username} onChangeText={setUsername} autoCapitalize="none" textStyle={inputStyle} decoration={addDecoration('Username', errors.username)} />
        <View style={{ height: 16 }} />
        {label('Password')}
        <View style={{ height: 6 }} />
        <TextField
          value={password}
          onChangeText={setPassword}
          obscureText={obscure}
          autoCapitalize="none"
          textStyle={inputStyle}
          decoration={{
            ...addDecoration('Password', errors.password),
            suffixIcon: (
              <IconButton
                onPress={() => setObscure((v) => !v)}
                size={20}
                icon={<Icon name={obscure ? 'visibility_off_outlined' : 'visibility_outlined'} size={20} color={GREY[600]} />}
              />
            ),
          }}
        />
        <View style={{ height: 4 }} />
        <Text style={ts({ size: 11, color: GREY[600] })}>Min. 6 characters</Text>
        <View style={{ height: 28 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TextButton onPress={() => pop()} foregroundColor="rgba(0,0,0,0.54)">Cancel</TextButton>
          <View style={{ width: 8 }} />
          <ElevatedButton
            onPress={saving || !canSubmit ? null : submit}
            backgroundColor={kAddBtn}
            foregroundColor="#FFFFFF"
            disabledBackgroundColor={GREY[300]}
            disabledForegroundColor={GREY[500]}
            padding={[20, 12]}
            radius={8}
            elevation={0}
            textStyle={tsPlain({ weight: 600 })}
          >
            {saving ? <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" /> : 'Create User'}
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ── Edit role & assignment dialog ─────────────────────────────────────────────

interface SubjectRow {
  gradeLevelId: number | null;
  subject: string | null;
}

const ROLES = ['principal', 'coordinator', 'dean', 'registrar', 'teacher'];

// Coordinator delegation choices, grouped by category. Each category header is
// a non-selectable label; the specific types under it are the pickable values.
const COORDINATOR_TYPE_GROUPS: Record<string, string[]> = {
  'Subject & Curriculum': [
    'Filipino Coordinator',
    'English Coordinator',
    'Araling Panlipunan (Social Studies) Coordinator',
    'Science Coordinator',
    'Mathematics Coordinator',
    'EPP (Edukasyong Pantahanan at Pangkabuhayan) Coordinator',
    'MAPEH (Music, Arts, Physical Education, and Health) Coordinator',
  ],
  'Program & Special Project': [
    'SSES Coordinator',
    'SBFP Coordinator',
    'Brigada Eskwela Coordinator',
    'Disaster Risk Reduction and Management (DRRM) Coordinator',
    'Feeding Program Coordinator',
    'Gulayan sa Paaralan Coordinator',
    'School Health Focal Person',
    'Youth for Environment in Schools Organization (YES-O) Coordinator',
  ],
  'Student & Extracurricular': [
    'Supreme Elementary Learner Government (SELG) Adviser',
    'Girl Scout Coordinator',
    'Twinkler Coordinator',
    'Star Scout Coordinator',
    'Boy Scout Coordinator',
    'KAB Scout Coordinator',
    'Kid Scout Coordinator',
    'School Paper Adviser',
  ],
  'Administrative & Support': [
    'Property Custodian',
    'Library Coordinator',
    'School Testing Coordinator',
    'ICT (Information and Communications Technology) Coordinator',
    'LIS (Learner Info System) Coordinator',
    'School Information Coordinator',
    'School Assessment Coordinator',
    'Gender and Development (GAD) Coordinator',
    'External Partnership Focal Person',
  ],
};

// Flat list of all selectable types (used for value validation).
const COORDINATOR_TYPES = Object.values(COORDINATOR_TYPE_GROUPS).flat();

const editDecoration = (label: string, hint?: string): InputDecoration => ({
  labelText: label,
  hintText: hint,
  filled: true,
  fillColor: GREY[50],
  contentPadding: [12, 10],
  radius: 8,
  borderColor: GREY[300],
  borderWidth: 1,
  focusedBorderColor: GREY[500],
  focusedBorderWidth: 1.5,
  labelStyle: tsField({ size: 13, color: GREY[600] }),
});

const item14 = tsField({ size: 14 });

function EditRoleDialog({ user, pop }: { user: User; pop: (result?: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [deanGradeLevelId, setDeanGradeLevelId] = useState<number | null>(user.deanGradeLevelId ?? user.gradeLevelId);
  const [coordinatorType, setCoordinatorType] = useState<string | null>(user.coordinatorType);
  const [alsoTeaching, setAlsoTeaching] = useState(user.alsoTeaching);
  const [appointment, setAppointment] = useState(user.dateOfAppointment ?? '');
  const [gradeLevels, setGradeLevels] = useState<Json[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([PersonnelService.gradeLevelsMeta(), PersonnelService.subjectsMeta()]).then(([levels, subjectMeta]) => {
      if (!mounted) return;
      setGradeLevels(levels);
      setSubjects(subjectMeta.map((s) => s.subject_name as string));
      const rows = user.subjects.map((s) => ({
        gradeLevelId: (levels.find((gl) => gl.grade_level === s.gradeLevel)?.id as number | undefined) ?? null,
        subject: s.subject,
      }));
      setSubjectRows(rows.length === 0 ? [{ gradeLevelId: null, subject: null }] : rows);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const pickAppointment = async () => {
    const now = new Date();
    const picked = await showDatePicker({
      initialDate: tryParseDate(appointment.trim()) ?? now,
      firstDate: new Date(1960, 0, 1),
      lastDate: now,
      helpText: 'Date of appointment',
      colors: { ...lightPickerColors(AppTheme.accentBlue), surface: Scheme.surfaceContainerHigh },
    });
    if (picked != null) {
      setAppointment(
        `${picked.getFullYear()}-${`${picked.getMonth() + 1}`.padStart(2, '0')}-${`${picked.getDate()}`.padStart(2, '0')}`,
      );
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const body: Json = { role: selectedRole };
      if (appointment.trim().length > 0) body.date_of_appointment = appointment.trim();
      if (selectedRole === 'dean' && deanGradeLevelId != null) body.dean_grade_level_id = deanGradeLevelId;
      if (selectedRole === 'coordinator' && coordinatorType != null) body.coordinator_type = coordinatorType;
      if (selectedRole === 'dean' || selectedRole === 'coordinator' || selectedRole === 'registrar') {
        body.also_teaching = alsoTeaching;
      }
      await PersonnelService.update(user.id, body);
      await PersonnelService.updateSubjects(
        user.id,
        subjectRows
          .filter((r) => r.subject != null && r.subject.length > 0)
          .map((r) => ({ grade_level_id: r.gradeLevelId, subject: r.subject })),
      );
      pop(true);
    } catch (e) {
      showSnackBar(`Error: ${exceptionText(e)}`, { backgroundColor: '#F44336' });
      setSaving(false);
    }
  };

  const setRow = (i: number, row: SubjectRow) => setSubjectRows((prev) => prev.map((r, j) => (j === i ? row : r)));

  const sectionLabel = (title: string) => (
    <Text style={ts({ size: 13, weight: 700, color: kNavSel, spacing: 0.4 })}>{title}</Text>
  );

  const gradeLevelDropdown = (label: string, value: number | null, onChanged: (v: number | null) => void) => (
    <DropdownField<number | null>
      isExpanded
      value={value}
      decoration={editDecoration(label)}
      hint="— None —"
      textStyle={item14}
      items={[
        { value: null, label: '— None —' },
        ...gradeLevels.map((gl) => ({ value: gl.id as number, label: gl.grade_level as string })),
      ]}
      onChanged={onChanged}
    />
  );

  const coordinatorItems: DropdownItem<string | null>[] = [];
  for (const [group, types] of Object.entries(COORDINATOR_TYPE_GROUPS)) {
    coordinatorItems.push({
      value: null,
      enabled: false,
      label: (
        <Text style={tsField({ size: 11, weight: 700, color: '#94A3B8', spacing: 0.5 })}>{group.toUpperCase()}</Text>
      ),
    });
    for (const type of types) {
      coordinatorItems.push({
        value: type,
        label: (
          <View style={{ paddingLeft: 10 }}>
            <Text numberOfLines={1} style={item14}>{type}</Text>
          </View>
        ),
      });
    }
  }

  const delegated = selectedRole === 'dean' || selectedRole === 'coordinator' || selectedRole === 'registrar';

  return (
    <Dialog backgroundColor="#FFFFFF" radius={16}>
      <View style={{ width: 560, maxWidth: '100%', height: 680, maxHeight: '100%' }}>
        {/* Header */}
        <View style={styles.editHeader}>
          <Icon name="edit_outlined" color="#FFFFFF" size={20} />
          <View style={{ width: 10 }} />
          <Text style={ts({ color: '#FFFFFF', size: 16, weight: 700 })}>{'Edit Role & Assignment'}</Text>
          <View style={{ flex: 1 }} />
          <IconButton onPress={() => pop()} size={20} padding={0} minSize={0} icon={<Icon name="close" color="#FFFFFF" size={20} />} />
        </View>

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, alignItems: 'flex-start' }}>
          {sectionLabel('Role Assignment')}
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' }}>
            <DropdownField<string>
              style={{ flex: 1 }}
              isExpanded
              value={selectedRole}
              decoration={editDecoration('Administrative Role')}
              textStyle={item14}
              items={ROLES.map((r) => ({ value: r, label: capitalize(r) }))}
              onChanged={setSelectedRole}
            />
            <View style={{ width: 12 }} />
            <TextField
              style={{ flex: 1 }}
              value={appointment}
              readOnly
              onPress={pickAppointment}
              decoration={{
                ...editDecoration('Date of Appointment', 'Select a date'),
                suffixIcon: <Icon name="calendar_today_outlined" size={16} color={Scheme.onSurfaceVariant} />,
              }}
            />
          </View>
          {selectedRole === 'dean' && gradeLevels.length > 0 && (
            <View style={{ alignSelf: 'stretch' }}>
              <View style={{ height: 12 }} />
              {gradeLevelDropdown('Grade Level Handled', deanGradeLevelId, setDeanGradeLevelId)}
            </View>
          )}
          {selectedRole === 'coordinator' && (
            <View style={{ alignSelf: 'stretch' }}>
              <View style={{ height: 12 }} />
              <DropdownField<string | null>
                isExpanded
                value={coordinatorType != null && COORDINATOR_TYPES.includes(coordinatorType) ? coordinatorType : null}
                decoration={editDecoration('Coordinator Type')}
                hint="Select type"
                textStyle={item14}
                items={coordinatorItems}
                onChanged={setCoordinatorType}
              />
            </View>
          )}
          {delegated && (
            <View style={{ alignSelf: 'stretch' }}>
              <View style={{ height: 12 }} />
              <View style={styles.alsoTeaching}>
                <View style={{ flex: 1 }}>
                  <Text style={ts({ size: 13, weight: 600 })}>Also teaching personnel</Text>
                  <Text style={ts({ size: 11, color: GREY[600] })}>
                    Adds a Teacher identity to this account, selectable at login.
                  </Text>
                </View>
                <Switch value={alsoTeaching} onChanged={setAlsoTeaching} />
              </View>
            </View>
          )}
          <View style={{ height: 24 }} />
          {sectionLabel('Subject-Grade Assignment')}
          <View style={{ height: 12 }} />
          {gradeLevels.length === 0 ? (
            <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
              <CircularProgressIndicator size={20} strokeWidth={2} />
            </View>
          ) : (
            subjectRows.map((row, i) => (
              <View key={i} style={{ paddingBottom: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                <View style={{ flex: 2 }}>
                  {gradeLevelDropdown('Grade Level', row.gradeLevelId, (v) => setRow(i, { gradeLevelId: v, subject: row.subject }))}
                </View>
                <View style={{ width: 8 }} />
                <DropdownField<string>
                  style={{ flex: 3 }}
                  isExpanded
                  value={row.subject != null && subjects.includes(row.subject) ? row.subject : null}
                  decoration={editDecoration('Subject')}
                  hint={<Text style={tsField({ size: 13, color: Scheme.onSurfaceVariant })}>Select subject</Text>}
                  textStyle={item14}
                  items={subjects.map((s) => ({ value: s, label: s }))}
                  onChanged={(v) => setRow(i, { gradeLevelId: row.gradeLevelId, subject: v })}
                />
                <View style={{ width: 4 }} />
                <IconButton
                  onPress={subjectRows.length > 1 ? () => setSubjectRows((prev) => prev.filter((_, j) => j !== i)) : null}
                  size={18}
                  padding={0}
                  minSize={32}
                  icon={<Icon name="close" size={18} color={subjectRows.length > 1 ? '#EF5350' : GREY[300]} />}
                />
              </View>
            ))
          )}
          <TextButton
            onPress={() => setSubjectRows((prev) => [...prev, { gradeLevelId: null, subject: null }])}
            icon="add"
            iconSize={16}
            foregroundColor={kLinkBlue}
            padding={[4, 6]}
            textStyle={tsPlain({ size: 13, weight: 600 })}
          >
            Add Subject
          </TextButton>
          <View style={{ height: 24 }} />
          {/* Personal information (education, skills, certifications, family
              details) is edited only by its owner in My Profile. */}
          <View style={styles.ownerNote}>
            <Icon name="lock_outline" size={16} color={GREY[600]} />
            <View style={{ width: 8 }} />
            <Text style={[ts({ size: 12, color: GREY[700] }), { flex: 1 }]}>
              {'Personal information — education, skills, certifications and ' +
                `family details — can only be edited by ${user.fullName} in their own profile.`}
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.editFooter}>
          <OutlinedButton
            style={{ flex: 1 }}
            onPress={() => pop()}
            foregroundColor={kAddBtn}
            side={{ color: GREY[400] }}
            padding={[0, 14]}
            radius={10}
            textStyle={tsPlain({ weight: 600 })}
          >
            Cancel
          </OutlinedButton>
          <View style={{ width: 12 }} />
          <ElevatedButton
            style={{ flex: 1 }}
            onPress={saving ? null : submit}
            backgroundColor={kAddBtn}
            foregroundColor="#FFFFFF"
            padding={[0, 14]}
            radius={10}
            elevation={0}
            textStyle={tsPlain({ weight: 600 })}
          >
            {saving ? <CircularProgressIndicator size={18} strokeWidth={2} color="#FFFFFF" /> : 'Save Changes'}
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingTop: 18,
    paddingRight: 12,
    paddingBottom: 18,
    backgroundColor: kNavSel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingTop: 20,
    paddingRight: 16,
    paddingBottom: 20,
    backgroundColor: kAddBtn,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  editFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: GREY[200],
  },
  alsoTeaching: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingTop: 2,
    paddingRight: 6,
    paddingBottom: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ownerNote: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
