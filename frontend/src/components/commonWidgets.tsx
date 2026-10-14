import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Comment, Task, tryParseDate } from '../models/models';
import { AppTheme, TextStyles, ts, tsAvatar, tsField, tsPlain } from '../theme/appTheme';
import { Icon, IconName } from './ui/Icon';
import { ElevatedButton, Tap } from './ui/buttons';
import { TextField } from './ui/inputs';
import { CircleAvatar, PopupMenuButton, useIsMobile } from './ui/misc';

export { HoverScale } from './ui/buttons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: string): string {
  if (d.length === 0) return '';
  const dt = tryParseDate(d);
  if (dt == null) return d;
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

// ── TaskNet Logo ──
export function TaskNetLogo({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/tasknet_logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

// ── Banner (dark honeycomb) ──

function honeycombPath(width: number, height: number): string {
  const r = 12.0;
  const w = r * 2;
  const h = r * 1.732;
  let d = '';
  for (let y = -h; y < height + h; y += h) {
    for (let x = -w; x < width + w; x += w * 1.5) {
      const offset = Math.abs(Math.floor(y / h)) % 2 === 1 ? w * 0.75 : 0.0;
      const cx = x + offset;
      for (let i = 0; i < 6; i++) {
        const angle = ((i * 60 - 30) * 3.14159) / 180;
        const px = cx + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`;
      }
      d += 'Z';
    }
  }
  return d;
}

export function AppBanner({ title, subtitle }: { title: string; subtitle: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const path = useMemo(() => honeycombPath(size.width, size.height), [size.width, size.height]);
  const glowRadius = Math.min(200, size.height);
  return (
    <View style={styles.banner}>
      <View
        style={{ overflow: 'hidden' }}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {/* Dot pattern */}
        {size.width > 0 && (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            <Path d={path} stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
          </Svg>
        )}
        {/* Red glow right */}
        {size.height > 0 && (
          <View style={styles.bannerGlow}>
            <Svg width={200} height={size.height}>
              <Defs>
                <RadialGradient id="glow" cx={200} cy={size.height / 2} r={glowRadius} gradientUnits="userSpaceOnUse">
                  <Stop offset={0} stopColor="#8B0000" stopOpacity={0.3} />
                  <Stop offset={1} stopColor="#8B0000" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={200} height={size.height} fill="url(#glow)" />
            </Svg>
          </View>
        )}
        <View>
          <Text style={ts({ size: 26, weight: 800, color: '#FFFFFF' })}>{title}</Text>
          <View style={{ height: 6 }} />
          <Text style={ts({ size: 13, weight: 400, color: '#9CA3AF' })}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Status Badge ──
export function StatusBadge({ label, bgColor, textColor }: { label: string; bgColor: string; textColor: string }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={ts({ size: 11, weight: 600, color: textColor })}>{label}</Text>
    </View>
  );
}

StatusBadge.pending = () => <StatusBadge label="Pending" bgColor="#DBEAFE" textColor="#1D4ED8" />;
StatusBadge.submitted = () => <StatusBadge label="Submitted" bgColor="#DCFCE7" textColor="#15803D" />;
StatusBadge.disabled = () => <StatusBadge label="Disabled" bgColor="#F3F4F6" textColor="#6B7280" />;

// ── Submission Count Badge ──
export function SubmissionBadge({ count }: { count: number }) {
  return (
    <View style={styles.submissionBadge}>
      <Icon name="description_outlined" size={13} color="#FFFFFF" />
      <View style={{ width: 4 }} />
      <Text style={ts({ size: 11, weight: 600, color: '#FFFFFF' })}>
        {`${count} Submission${count > 1 ? 's' : ''}`}
      </Text>
    </View>
  );
}

// ── Task Card ──
interface TaskListCardProps {
  task: Task;
  showBadge?: boolean;
  showMenu?: boolean;
  onTap: () => void;
  onEdit?: () => void;
  onDisable?: () => void;
  onDelete?: () => void;
}

export function TaskListCard({ task, showBadge = false, showMenu = false, onTap, onEdit, onDisable, onDelete }: TaskListCardProps) {
  return (
    <Tap onPress={onTap}>
      <View style={styles.taskCard}>
        <View style={{ flex: 1 }}>
          <Text style={TextStyles.heading3}>{task.title}</Text>
          <View style={{ height: 3 }} />
          <Text style={TextStyles.bodySm}>{formatDate(task.startDate ?? task.endDate ?? '')}</Text>
          {task.instructions != null && (
            <>
              <View style={{ height: 4 }} />
              <Text style={TextStyles.bodyMd}>
                {task.instructions.length > 70 ? `${task.instructions.substring(0, 70)}...` : task.instructions}
              </Text>
            </>
          )}
          {task.submissionCount > 0 && (
            <>
              <View style={{ height: 8 }} />
              <View style={{ flexDirection: 'row' }}>
                <SubmissionBadge count={task.submissionCount} />
              </View>
            </>
          )}
        </View>
        <View style={{ width: 8 }} />
        <View style={{ alignItems: 'center' }}>
          {showBadge && (task.isSubmitted ? <StatusBadge.submitted /> : <StatusBadge.pending />)}
          {showMenu && (
            <PopupMenuButton<string>
              icon={<Icon name="more_vert" size={18} color={AppTheme.textMuted} />}
              radius={10}
              onSelected={(v) => {
                if (v === 'edit') onEdit?.();
                if (v === 'disable') onDisable?.();
                if (v === 'delete') onDelete?.();
              }}
              items={[
                { value: 'edit', child: <MenuRow icon="edit_outlined" label="Edit" /> },
                { value: 'disable', child: <MenuRow icon="block_outlined" label="Disable" /> },
                { value: 'delete', child: <MenuRow icon="delete_outline" label="Delete" color={AppTheme.redColor} /> },
              ]}
            />
          )}
        </View>
      </View>
    </Tap>
  );
}

/// The icon + label row of a popup menu entry.
export function MenuRow({ icon, label, color, iconSize = 16, iconColor }: {
  icon: IconName;
  label: string;
  color?: string;
  iconSize?: number;
  iconColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={iconSize} color={iconColor ?? color ?? 'rgba(0,0,0,0.87)'} />
      <View style={{ width: 8 }} />
      <Text style={[TextStyles.labelMd, color != null && { color }]}>{label}</Text>
    </View>
  );
}

// ── Points Row ──
export function PointsRow({ label, value, bgColor, valueColor }: {
  label: string;
  value: string;
  bgColor: string;
  valueColor: string;
}) {
  return (
    <View style={[styles.pointsRow, { backgroundColor: bgColor }]}>
      <Text style={ts({ size: 13, weight: 500 })}>{label}</Text>
      <Text style={ts({ size: 13, weight: 700, color: valueColor })}>{value}</Text>
    </View>
  );
}

// ── Comment Item ──
export function CommentItem({ comment, onEdit, onDelete }: {
  comment: Comment;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={{ paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
      <CircleAvatar radius={16} backgroundColor={AppTheme.sidebarActive}>
        <Text style={tsAvatar(12, 700, '#FFFFFF')}>
          {comment.fullName.length > 0 ? comment.fullName[0].toUpperCase() : '?'}
        </Text>
      </CircleAvatar>
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={[ts({ size: 12, weight: 600 }), { flexShrink: 1 }]}>{comment.fullName}</Text>
          <View style={{ width: 6 }} />
          <Text style={TextStyles.bodySm}>{formatDate(comment.createdAt)}</Text>
          {(onEdit != null || onDelete != null) && (
            <>
              <View style={{ width: 2 }} />
              <View style={{ width: 28, height: 28 }}>
                <PopupMenuButton<string>
                  padding={0}
                  style={{ width: 28, height: 28 }}
                  icon={<Icon name="more_horiz" size={18} color={AppTheme.textMuted} />}
                  radius={10}
                  onSelected={(v) => {
                    if (v === 'edit') onEdit?.();
                    if (v === 'delete') onDelete?.();
                  }}
                  items={[
                    ...(onEdit != null
                      ? [{ value: 'edit', child: <MenuRow icon="edit_outlined" label="Edit" iconSize={15} iconColor={AppTheme.textMuted} /> }]
                      : []),
                    ...(onDelete != null
                      ? [{ value: 'delete', child: <MenuRow icon="delete_outline" label="Delete" iconSize={15} color={AppTheme.redColor} /> }]
                      : []),
                  ]}
                />
              </View>
            </>
          )}
        </View>
        <View style={{ height: 2 }} />
        <Text style={TextStyles.bodyMd}>{comment.content}</Text>
      </View>
    </View>
  );
}

// ── Comment Input ──
export function CommentInputField({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('');

  const send = () => {
    if (text.trim().length > 0) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.commentInput}>
      <TextField
        value={text}
        onChangeText={setText}
        maxLines={4}
        minLines={3}
        textStyle={tsField({ size: 13, color: AppTheme.textPrimary })}
        decoration={{
          hintText: placeholder,
          hintStyle: TextStyles.bodyMd,
          border: 'none',
          filled: false,
          contentPadding: { left: 14, top: 12, right: 14, bottom: 8 },
        }}
      />
      <View style={styles.commentInputFooter}>
        <ElevatedButton
          onPress={send}
          icon="send_rounded"
          iconSize={15}
          backgroundColor={AppTheme.darkBanner}
          foregroundColor="#FFFFFF"
          padding={[20, 10]}
          minimumSize={{ width: 0, height: 0 }}
          shrinkWrap
          radius={6}
          textStyle={tsPlain({ size: 13, weight: 600, color: '#FFFFFF' })}
        >
          Send
        </ElevatedButton>
      </View>
    </View>
  );
}

// ── Stat Card ──
export function StatCard({ count, label, iconBg, iconColor, icon }: {
  count: string;
  label: string;
  iconBg: string;
  iconColor: string;
  icon: IconName;
}) {
  const isMobile = useIsMobile();
  return (
    <View style={[styles.statCard, { paddingHorizontal: isMobile ? 10 : 18 }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} color={iconColor} size={18} />
      </View>
      <View style={{ height: 10 }} />
      <Text style={ts({ size: isMobile ? 22 : 28, weight: 800, color: AppTheme.textPrimary })}>{count}</Text>
      <Text style={TextStyles.bodyMd} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Search Bar ──
export function AppSearchBar({ hint, onChanged }: { hint: string; onChanged: (value: string) => void }) {
  const [text, setText] = useState('');
  return (
    <View style={styles.searchBar}>
      <Icon name="search" size={16} color={AppTheme.textLight} />
      <View style={{ width: 8 }} />
      <TextField
        style={{ flex: 1 }}
        value={text}
        onChangeText={(v) => { setText(v); onChanged(v); }}
        textStyle={TextStyles.bodyLg}
        decoration={{
          hintText: hint,
          hintStyle: TextStyles.bodyMd,
          // Only `border` is cleared here, so the theme's outline still
          // draws around the enabled and focused field.
          isDense: true,
          contentPadding: [0, 0],
        }}
      />
    </View>
  );
}

// ── Section Header ──
export function SectionHeader({ title, count }: { title: string; count?: number | null }) {
  return (
    <View style={{ paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={TextStyles.heading3}>{title}</Text>
      {count != null && (
        <>
          <View style={{ width: 6 }} />
          <Text style={TextStyles.bodyMd}>{`(${count} task${count !== 1 ? 's' : ''})`}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    paddingHorizontal: 28,
    paddingVertical: 24,
    backgroundColor: AppTheme.darkBanner,
    borderRadius: 14,
  },
  bannerGlow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 200,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  submissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: AppTheme.greenColor,
    borderRadius: 20,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    padding: 16,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    boxShadow: AppTheme.cardShadow,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  commentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  commentInputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingLeft: 10,
    paddingTop: 6,
    paddingRight: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borderColor,
  },
  statCard: {
    paddingVertical: 16,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    boxShadow: AppTheme.cardShadow,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 8,
    boxShadow: AppTheme.cardShadow,
  },
});
