import React, { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { CalendarTaskProposal, ApiService, errorMessage } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, TextStyles, ts, tsField, tsPlain, withOpacity } from '../theme/appTheme';
import { pickFile } from '../utils/files';
import { Icon } from './ui/Icon';
import { ElevatedButton, OutlinedButton } from './ui/buttons';
import { Checkbox, DropdownField, TextField } from './ui/inputs';
import { CircularProgressIndicator } from './ui/misc';
import { Dialog, showDialog, showSnackBar } from './ui/overlay';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const datesText = (p: CalendarTaskProposal) =>
  p.startDate === p.endDate ? `Due ${fmt(p.endDate)}` : `${fmt(p.startDate)} – due ${fmt(p.endDate)}`;

const KIND: Record<string, [string, string]> = {
  task: ['Task', AppTheme.accentBlue],
  suggested: ['Suggested', '#7C3AED'],
  holiday: ['Holiday', AppTheme.redColor],
  marker: ['Calendar', AppTheme.textMuted],
  other: ['Other', AppTheme.textMuted],
};

const ROLE_LABELS: Record<string, string> = {
  teacher: 'All teachers',
  dean: 'All deans',
  coordinator: 'All coordinators',
  registrar: 'All registrars',
  principal: 'All principals',
};

interface Row extends CalendarTaskProposal {
  title: string;
  selected: boolean;
}

/// Reviews the tasks proposed from a scanned school calendar and posts the
/// chosen ones to the Task Manager.
function CalendarTasksDialog({ fileName, proposals, pop }: {
  fileName: string;
  proposals: CalendarTaskProposal[];
  pop: (posted?: number) => void;
}) {
  const app = useAppState();
  const { height } = useWindowDimensions();
  const [rows, setRows] = useState<Row[]>(() => proposals.map((p) => ({ ...p })));
  const roles = app.assignableRoles;
  const [assignTo, setAssignTo] = useState<string>(roles.includes('teacher') ? 'teacher' : 'later');
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState('');
  const chosen = rows.filter((r) => r.selected && r.title.trim().length > 0);

  const update = (i: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...change } : r)));

  const post = async () => {
    setPosting(true);
    let posted = 0;
    try {
      const ids = assignTo === 'later' ? [] : (await ApiService.getAssignableUsers(assignTo)).map((u) => u.id);
      for (const r of chosen) {
        setProgress(`Posting ${posted + 1} of ${chosen.length}…`);
        await ApiService.createTask({
          title: r.title.trim(),
          task_category: 'common',
          instructions: `${r.instructions}\n\nFrom the school calendar (${fileName}).`,
          start_date: r.startDate,
          end_date: r.endDate,
          due_time: '5:00 PM',
          ...(assignTo !== 'later' ? { target_role: assignTo, assigned_user_ids: ids } : { assigned_user_ids: [] }),
        });
        posted++;
      }
      pop(posted);
    } catch (e) {
      showSnackBar(`Stopped after ${posted} of ${chosen.length}: ${errorMessage(e)}`, {
        backgroundColor: AppTheme.redColor,
        floating: true,
        radius: 8,
      });
      setPosting(false);
      setProgress('');
      if (posted > 0) pop(posted);
    }
  };

  return (
    <Dialog
      backgroundColor="#FFFFFF"
      radius={14}
      insetPadding={{ horizontal: 16, vertical: 24 }}
      style={{ width: '100%', maxWidth: 760, maxHeight: height * 0.9 }}
    >
      <View style={{ paddingLeft: 22, paddingTop: 20, paddingRight: 22, paddingBottom: 16, flexShrink: 1 }}>
        <Text style={ts({ size: 18, weight: 700, color: AppTheme.textPrimary })}>Tasks from the school calendar</Text>
        <View style={{ height: 4 }} />
        <Text style={TextStyles.bodySm}>
          {`Read from ${fileName}. Activities are ticked; holidays and term markers are not. ` +
            'Suggested tasks are ones the calendar implies, like submitting grades after an exam. ' +
            'Edit any title, then post.'}
        </Text>
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>Assign to</Text>
          <View style={{ width: 220 }}>
            <DropdownField<string>
              value={assignTo}
              isDense
              items={[
                ...roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r })),
                { value: 'later', label: 'Nobody yet (assign later)' },
              ]}
              onChanged={posting ? null : setAssignTo}
              textStyle={tsField({ size: 13 })}
              decoration={{ isDense: true, contentPadding: [12, 8], fillColor: '#FFFFFF' }}
            />
          </View>
        </View>
        <View style={{ height: 12 }} />
        <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        <ScrollView style={{ flexShrink: 1 }}>
          {rows.map((r, i) => {
            const [label, color] = KIND[r.kind] ?? KIND.other;
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F1F5F9',
                  opacity: r.selected ? 1 : 0.6,
                }}
              >
                <Checkbox value={r.selected} onChanged={posting ? null : (v) => update(i, { selected: v })} activeColor={AppTheme.darkBanner} />
                <View style={{ width: 6 }} />
                <View style={{ flex: 1 }}>
                  <TextField
                    value={r.title}
                    onChangeText={(v) => update(i, { title: v })}
                    readOnly={posting}
                    textStyle={tsField({ size: 13, weight: 600 })}
                    decoration={{ isDense: true, contentPadding: [10, 7], fillColor: '#FFFFFF' }}
                  />
                  <View style={{ height: 4 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: withOpacity(color, 0.12) }}>
                      <Text style={ts({ size: 10.5, weight: 700, color })}>{label}</Text>
                    </View>
                    <Text style={[TextStyles.bodySm, { color: AppTheme.textMuted }]}>{datesText(r)}</Text>
                    {r.past && <Text style={[TextStyles.bodySm, { color: AppTheme.amberColor }]}>Already passed</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[TextStyles.bodySm, { flex: 1 }]}>
            {posting ? progress : `${chosen.length} of ${rows.length} selected · due 5:00 PM on each date`}
          </Text>
          <OutlinedButton
            onPress={posting ? null : () => pop()}
            foregroundColor={AppTheme.textPrimary}
            side={{ color: AppTheme.borderColor }}
            padding={[18, 12]}
            radius={8}
            textStyle={tsPlain({ weight: 600 })}
          >
            Cancel
          </OutlinedButton>
          <View style={{ width: 10 }} />
          <ElevatedButton
            onPress={posting || chosen.length === 0 ? null : post}
            backgroundColor={AppTheme.darkBanner}
            foregroundColor="#FFFFFF"
            padding={[20, 12]}
            radius={8}
            textStyle={tsPlain({ weight: 700 })}
          >
            {posting ? (
              <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" />
            ) : (
              `Post ${chosen.length} task${chosen.length === 1 ? '' : 's'}`
            )}
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

/// Principal flow: pick a school calendar file, review the tasks it implies,
/// post the chosen ones. Resolves to how many tasks were posted.
export async function scanSchoolCalendar(onBusy: (busy: boolean) => void): Promise<number> {
  let file;
  try {
    file = await pickFile();
  } catch {
    return 0;
  }
  if (file == null) return 0;
  onBusy(true);
  let proposals: CalendarTaskProposal[];
  try {
    proposals = await ApiService.scanSchoolCalendar(file);
  } catch (e) {
    showSnackBar(errorMessage(e), { backgroundColor: AppTheme.redColor, floating: true, radius: 8 });
    return 0;
  } finally {
    onBusy(false);
  }
  const fileName = file.name;
  const posted = await showDialog<number>((pop) => (
    <CalendarTasksDialog fileName={fileName} proposals={proposals} pop={pop} />
  ));
  if (posted != null && posted > 0) {
    showSnackBar(`${posted} task${posted === 1 ? '' : 's'} posted from the school calendar.`, {
      backgroundColor: AppTheme.darkBanner,
      floating: true,
      radius: 8,
    });
  }
  return posted ?? 0;
}

export const CalendarScanIcon = () => <Icon name="calendar_month_outlined" size={16} color={AppTheme.accentBlue} />;
