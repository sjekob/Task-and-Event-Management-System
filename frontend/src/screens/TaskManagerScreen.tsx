import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { AppBanner } from '../components/commonWidgets';
import { TaskManagerSkeleton } from '../components/skeletonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, InkWell, OutlinedButton, Tap, TextButton } from '../components/ui/buttons';
import { TextField } from '../components/ui/inputs';
import { LinearProgressIndicator, PopupMenuButton, useIsMobile } from '../components/ui/misc';
import { pushPage } from '../components/ui/navigator';
import { Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { SchoolYearFilter, Task, currentSchoolYear, sameSchoolYearFilter } from '../models/models';
import { ApiService, exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, TextStyles, ts, tsField, tsPlain, withOpacity } from '../theme/appTheme';
import EditTaskScreen from './EditTaskScreen';
import TaskDetailScreen from './TaskDetailScreen';

interface TaskManagerScreenProps {
  onCreateTask?: () => void;
  onCreateTemplate?: () => void;
  onSelectTask?: (id: number) => void;
  /// 'common' | 'special' — which task type this screen manages
  category?: string;
}

function showSnack(msg: string, error = false) {
  showSnackBar(msg, {
    backgroundColor: error ? AppTheme.redColor : AppTheme.darkBanner,
    floating: true,
    radius: 8,
  });
}

export default function TaskManagerScreen({ onSelectTask, category = 'common' }: TaskManagerScreenProps) {
  const app = useAppState();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Principal-only: 'mine' = tasks they created, 'all' = every task.
  const [scope, setScope] = useState('mine');
  // Current school year by default; earlier years are archived.
  const [filter, setFilter] = useState<SchoolYearFilter>(currentSchoolYear);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const all = await ApiService.getTasks({ scope, filter });
      const filtered = all.filter((t) => t.taskCategory === category);
      if (mounted.current) {
        setTasks(filtered);
        setLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setLoading(false);
        setErrorMsg(exceptionText(e));
      }
    }
  }, [scope, filter, category]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const matches = (t: Task) => search.length === 0 || t.title.toLowerCase().includes(search.toLowerCase());
  const active = tasks.filter((t) => t.status === 'active' && matches(t));
  const disabled = tasks.filter((t) => t.status !== 'active' && matches(t));

  const disable = async (id: number) => {
    const ok = await showDialog<boolean>((pop) => <ConfirmDisableDialog pop={pop} />);
    if (ok !== true) return;
    try {
      await ApiService.updateTask(id, { status: 'disabled' });
      showSnack('Task disabled');
      load();
    } catch (e) {
      showSnack(`Failed: ${exceptionText(e)}`, true);
    }
  };

  const enable = async (id: number) => {
    try {
      await ApiService.updateTask(id, { status: 'active' });
      showSnack('Task enabled');
      load();
    } catch (e) {
      showSnack(`Failed: ${exceptionText(e)}`, true);
    }
  };

  const openDetail = (t: Task) =>
    pushPage((pop) => <TaskDetailScreen taskId={t.id} onClose={() => pop()} />).then(() => load());

  if (loading) return <TaskManagerSkeleton />;
  const role = app.userRole;

  const bannerTitle = (): string => {
    if (category === 'special') return 'Special Tasks';
    switch (role) {
      case 'admin':
      case 'principal': return 'Task Manager';
      case 'coordinator':
      case 'dean': return 'Task Manager';
      default: return 'Tasks';
    }
  };

  const bannerSubtitle = (): string => {
    if (category === 'special') return 'Create and manage special tasks. Assign to your team.';
    switch (role) {
      case 'admin':
      case 'principal': return 'Create and manage tasks. Assign to your team.';
      case 'coordinator': return 'Manage tasks assigned to you. Reassign to deans or teachers.';
      case 'dean': return 'Manage tasks assigned to you. Assign to your grade-level teachers.';
      default: return 'Tasks assigned to you. Submit reports on time.';
    }
  };

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{
        paddingLeft: isMobile ? 14 : 24,
        paddingTop: 8,
        paddingRight: isMobile ? 14 : 24,
        paddingBottom: 24,
      }}
    >
      {/* ── Banner ── */}
      <AppBanner title={bannerTitle()} subtitle={bannerSubtitle()} />
      <View style={{ height: 20 }} />

      {/* ── Scope tabs (principal: their created tasks vs. all tasks) and
          the school year shown (older years are archived) ── */}
      <View style={styles.wrap}>
        {app.can('view_all_tasks') && (
          <>
            <ScopeTab label="My Created Tasks" selected={scope === 'mine'} onTap={() => setScope('mine')} />
            <ScopeTab label="All Tasks" selected={scope === 'all'} onTap={() => setScope('all')} />
          </>
        )}
        <SchoolYearPicker value={filter} onChanged={setFilter} />
      </View>
      <View style={{ height: 16 }} />

      {/* ── Search ── */}
      <View style={styles.search}>
        <Icon name="search" size={18} color={AppTheme.textLight} />
        <View style={{ width: 10 }} />
        <TextField
          style={{ flex: 1 }}
          value={search}
          onChangeText={setSearch}
          textStyle={tsField({ size: 14 })}
          decoration={{
            hintText: 'Search tasks by title...',
            hintStyle: TextStyles.bodyMd,
            // Override the app-wide filled/outlined field style.
            filled: false,
            border: 'none',
            isDense: true,
            contentPadding: [0, 10],
          }}
        />
      </View>
      <View style={{ height: 16 }} />

      {/* ── Error ── */}
      {errorMsg != null && (
        <View style={styles.error}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="error_outline" color={AppTheme.redColor} size={18} />
            <View style={{ width: 8 }} />
            <Text style={ts({ weight: 600, color: AppTheme.redColor })}>Failed to load tasks</Text>
          </View>
          <View style={{ height: 6 }} />
          <Text style={TextStyles.bodyMd}>{errorMsg}</Text>
          <View style={{ height: 10 }} />
          <ElevatedButton onPress={load} icon="refresh" iconSize={16} backgroundColor={AppTheme.redColor}>
            Retry
          </ElevatedButton>
        </View>
      )}

      {/* ── Empty ── */}
      {errorMsg == null && active.length === 0 && disabled.length === 0 && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Icon name="assignment_outlined" size={48} color={AppTheme.textLight} />
          <View style={{ height: 12 }} />
          <Text style={TextStyles.labelMd}>
            {search.length > 0 ? `No tasks match "${search}"` : 'No tasks in this school year'}
          </Text>
          {search.length === 0 && sameSchoolYearFilter(filter, currentSchoolYear) && (
            <>
              <View style={{ height: 4 }} />
              <Text style={[TextStyles.bodySm, { textAlign: 'center' }]}>
                Tasks from earlier school years are archived. Choose a year in the selector above to see them.
              </Text>
            </>
          )}
        </View>
      )}

      {/* ── Active tasks ── */}
      {errorMsg == null && active.length > 0 && (
        <SectionLabel text={category === 'special' ? 'Active special tasks' : 'Active tasks'} count={active.length} />
      )}
      {errorMsg == null &&
        active.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onTap={() => {
              if (onSelectTask != null) {
                onSelectTask(t.id);
              } else {
                openDetail(t);
              }
            }}
            onEdit={() =>
              pushPage<boolean>((pop) => <EditTaskScreen task={t} onClose={pop} />).then((updated) => {
                if (updated === true) load();
              })
            }
            onDisable={() => disable(t.id)}
          />
        ))}

      {/* ── Disabled Tasks Section ── */}
      {errorMsg == null && disabled.length > 0 && (
        <>
          <View style={{ height: 14 }} />
          <SectionLabel text="Disabled" count={disabled.length} />
          {disabled.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onTap={() => openDetail(t)}
              onEdit={() => {}}
              onDisable={() => {}}
              onEnable={() => enable(t.id)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ── Task row card ─────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dueText(t: Task): string {
  const dl = t.deadline;
  if (dl == null) return 'No deadline';
  const date = `${MONTHS_SHORT[dl.getMonth()]} ${dl.getDate()}, ${dl.getFullYear()}`;
  const time = (t.dueTime ?? '').trim();
  return time.length === 0 || time.toUpperCase() === '11:59 PM' ? `Due ${date}` : `Due ${date}, ${time}`;
}

function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <View style={{ paddingBottom: 10, paddingTop: 4, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>{text}</Text>
      <View style={{ width: 8 }} />
      <View style={styles.countPill}>
        <Text style={ts({ size: 12, weight: 700, color: AppTheme.textMuted })}>{`${count}`}</Text>
      </View>
    </View>
  );
}

function CardChip({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={ts({ size: 11.5, weight: 600, color: fg })}>{text}</Text>
    </View>
  );
}

function MenuItem({ icon, label, color }: { icon: IconName; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={16} color={color} />
      <View style={{ width: 10 }} />
      <Text style={ts({ size: 13, weight: 500, color })}>{label}</Text>
    </View>
  );
}

function TaskCard({ task, onTap, onEdit, onDisable, onEnable }: {
  task: Task;
  onTap: () => void;
  onEdit: () => void;
  onDisable: () => void;
  onEnable?: () => void;
}) {
  const isMobile = useWindowDimensions().width < 600;
  const isDisabled = task.status !== 'active';
  const total = task.teamTotal ?? 0;
  const done = task.teamSubmitted ?? 0;
  const complete = total > 0 && done >= total;
  const dl = task.deadline;
  const overdue = !isDisabled && !complete && dl != null && dl.getTime() < Date.now();
  const dotColor = isDisabled
    ? AppTheme.textLight
    : complete ? AppTheme.greenColor : overdue ? AppTheme.redColor : AppTheme.accentBlue;
  const instructions = (task.instructions ?? '').replace(/\n/g, ' ').trim();

  const progress =
    total === 0 ? (
      <View style={{ flexDirection: 'row' }}>
        <CardChip text="Not assigned" fg={AppTheme.textMuted} bg="#F1F5F9" />
      </View>
    ) : (
      <View style={{ width: isMobile ? '100%' : 150, alignItems: 'flex-end' }}>
        <Text style={ts({ size: 12.5, weight: 600, color: complete ? '#16A34A' : AppTheme.textMuted })}>
          {`${done} of ${total} submitted`}
        </Text>
        <View style={{ height: 6 }} />
        <LinearProgressIndicator
          value={done / total}
          minHeight={6}
          radius={4}
          backgroundColor="#EEF2FA"
          color={complete ? AppTheme.greenColor : AppTheme.accentBlue}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    );

  const menu = task.canEdit ? (
    isDisabled ? (
      <TextButton onPress={onEnable} foregroundColor="#16A34A">Enable</TextButton>
    ) : (
      <PopupMenuButton<string>
        tooltip="Task actions"
        icon={<Icon name="more_vert" size={20} color={AppTheme.textMuted} />}
        radius={10}
        onSelected={(v) => {
          if (v === 'edit') onEdit();
          if (v === 'disable') onDisable();
        }}
        items={[
          { value: 'edit', child: <MenuItem icon="edit_outlined" label="Edit task" color={AppTheme.textPrimary} /> },
          { value: 'disable', child: <MenuItem icon="block_outlined" label="Disable task" color={AppTheme.redColor} /> },
        ]}
      />
    )
  ) : (
    <View style={{ width: 8 }} />
  );

  const info = (
    <View>
      <Text
        numberOfLines={1}
        style={ts({ size: 15.5, weight: 700, color: isDisabled ? AppTheme.textMuted : AppTheme.textPrimary })}
      >
        {task.title}
      </Text>
      <View style={{ height: 4 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="flag_outlined" size={14} color={overdue ? AppTheme.redColor : AppTheme.textLight} />
          <View style={{ width: 4 }} />
          <Text style={ts({ size: 12.5, weight: overdue ? 600 : 500, color: overdue ? AppTheme.redColor : AppTheme.textMuted })}>
            {dueText(task)}
          </Text>
        </View>
        {overdue && <CardChip text="Overdue" fg="#B91C1C" bg={AppTheme.redBg} />}
        {complete && !isDisabled && <CardChip text="All submitted" fg="#15803D" bg={AppTheme.greenBg} />}
        {isDisabled && <CardChip text="Disabled" fg={AppTheme.textMuted} bg="#F1F5F9" />}
      </View>
      {instructions.length > 0 && instructions.toLowerCase() !== task.title.toLowerCase() && (
        <>
          <View style={{ height: 6 }} />
          <Text numberOfLines={1} style={TextStyles.bodyMd}>{instructions}</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={{ paddingBottom: 10 }}>
      <InkWell
        onPress={onTap}
        radius={12}
        style={{ backgroundColor: isDisabled ? '#F8FAFC' : '#FFFFFF' }}
      >
        <View style={styles.taskCard}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: dotColor,
              boxShadow: `0px 0px 0px 3px ${withOpacity(dotColor, 0.25)}`,
            }}
          />
          <View style={{ width: 16 }} />
          <View style={{ flex: 1 }}>
            {isMobile ? (
              <View>
                {info}
                <View style={{ height: 10 }} />
                {progress}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>{info}</View>
                <View style={{ width: 20 }} />
                {progress}
              </View>
            )}
          </View>
          <View style={{ width: 4 }} />
          {menu}
        </View>
      </InkWell>
    </View>
  );
}

// ── Confirm Disable Dialog ────────────────────────────────────────────────────

function ConfirmDisableDialog({ pop }: { pop: (result?: boolean) => void }) {
  return (
    <Dialog radius={16}>
      <View style={{ width: 360, maxWidth: '100%', paddingLeft: 28, paddingTop: 28, paddingRight: 28, paddingBottom: 24, alignItems: 'center' }}>
        <Text style={ts({ size: 18, weight: 700, color: AppTheme.textPrimary })}>Confirm Disable</Text>
        <View style={{ height: 10 }} />
        <Text style={[TextStyles.bodyMd, { textAlign: 'center' }]}>Are you sure you want to disable the task?</Text>
        <View style={{ height: 24 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <ElevatedButton
            style={{ flex: 1 }}
            onPress={() => pop(true)}
            backgroundColor={AppTheme.accentBlue}
            foregroundColor="#FFFFFF"
            padding={[0, 14]}
            radius={10}
            textStyle={tsPlain({ weight: 600, size: 15 })}
          >
            Yes
          </ElevatedButton>
          <View style={{ width: 12 }} />
          <OutlinedButton
            style={{ flex: 1 }}
            onPress={() => pop(false)}
            foregroundColor={AppTheme.accentBlue}
            side={{ color: AppTheme.accentBlue }}
            padding={[0, 14]}
            radius={10}
            textStyle={tsPlain({ weight: 600, size: 15 })}
          >
            No
          </OutlinedButton>
        </View>
      </View>
    </Dialog>
  );
}

function ScopeTab({ label, selected, onTap }: { label: string; selected: boolean; onTap: () => void }) {
  return (
    <Tap onPress={onTap}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 9,
          backgroundColor: selected ? AppTheme.darkBanner : '#FFFFFF',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: selected ? AppTheme.darkBanner : AppTheme.borderColor,
        }}
      >
        <Text style={ts({ size: 13, weight: 600, color: selected ? '#FFFFFF' : AppTheme.textMuted })}>{label}</Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 10,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
  error: {
    padding: 16,
    backgroundColor: AppTheme.redBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: withOpacity(AppTheme.redColor, 0.3),
    alignItems: 'flex-start',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingTop: 14,
    paddingRight: 6,
    paddingBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
});
