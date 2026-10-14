import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppraisalTabSkeleton } from '../../components/skeletonWidgets';
import { Icon } from '../../components/ui/Icon';
import { ElevatedButton, IconButton, TextButton } from '../../components/ui/buttons';
import { TextField } from '../../components/ui/inputs';
import { CircleAvatar, CircularProgressIndicator, Divider } from '../../components/ui/misc';
import { Dialog, showDialog, showSnackBar } from '../../components/ui/overlay';
import { SpecialTask } from '../../models/models';
import { ApiService, exceptionText } from '../../services/apiService';
import { AppTheme, TextStyles, ts, tsField, tsPlain } from '../../theme/appTheme';
import {
  ActionBtn,
  AppraisalStatCard,
  CoverageCard,
  ErrorPanel,
  EvalReadRow,
  FilterDropdown,
  GREY,
  HairDivider,
  InfoField,
  RED,
  ScoreBadge,
  StarRatingRow,
  StatRow,
  StatusChip,
  fmtSlashDate,
  panelStyle,
  tableHeadStyle,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Special Tasks Tab
// ─────────────────────────────────────────────────────────────────────────────

const unique = (values: (string | null)[]): string[] =>
  [...new Set(values.map((v) => v ?? '').filter((v) => v.length > 0))].sort();

export function SpecialTasksTab({ tasks, loading, error, onRefresh, onEvaluated }: {
  tasks: SpecialTask[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onEvaluated: (task: SpecialTask) => void;
}) {
  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterPersonnel, setFilterPersonnel] = useState<string | null>(null);

  if (loading) return <AppraisalTabSkeleton />;
  if (error != null) return <ErrorPanel message={error} onRetry={onRefresh} />;

  let filtered = tasks;
  if (filterDept != null) filtered = filtered.filter((t) => t.assigneeDepartment === filterDept);
  if (filterRole != null) {
    filtered = filtered.filter((t) => (t.assigneeRole ?? '').toLowerCase() === filterRole.toLowerCase());
  }
  if (filterPersonnel != null) filtered = filtered.filter((t) => t.assigneeName === filterPersonnel);

  const evaluated = tasks.filter((t) => t.status === 'evaluated').length;
  const flagged = tasks.filter((t) => t.status === 'flagged').length;
  const departments = unique(tasks.map((t) => t.assigneeDepartment)).length;
  const evalTasks = tasks.filter((t) => t.evaluation?.weightedAverage != null);
  const avgScore =
    evalTasks.length > 0 ? evalTasks.map((t) => t.scoreOutOf100).reduce((a, b) => a + b) / evalTasks.length : 0;

  const showEvaluateDialog = async (task: SpecialTask) => {
    const updated = await showDialog<SpecialTask>((pop) => <EvaluateSpecialTaskDialog task={task} pop={pop} />);
    if (updated != null) onEvaluated(updated);
  };

  const showViewDialog = (task: SpecialTask) => {
    showDialog((pop) => <ViewSpecialTaskDialog task={task} onClose={() => pop()} />);
  };

  const head = tableHeadStyle(11, 0.5);
  const muted12 = ts({ size: 12, color: AppTheme.textMuted });

  const tableRow = (task: SpecialTask, idx: number) => {
    const id = `ST${`${task.id}`.padStart(3, '0')}`;
    const isEvaluated = task.status === 'evaluated';
    const isFlagged = task.status === 'flagged';
    const done = isEvaluated || isFlagged;
    return (
      <View
        key={task.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: idx % 2 === 1 ? '#FAFAFB' : '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: GREY[100],
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        {/* ID */}
        <Text style={[ts({ size: 12, color: AppTheme.textMuted, weight: 500 }), { width: 52 }]}>{id}</Text>
        {/* Personnel */}
        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
          <CircleAvatar radius={14} backgroundColor="#E2E8F0">
            <Icon name="person_outline" size={14} color={AppTheme.textMuted} />
          </CircleAvatar>
          <View style={{ width: 8 }} />
          <Text numberOfLines={1} style={[ts({ size: 13, weight: 600, color: AppTheme.textPrimary }), { flexShrink: 1 }]}>
            {task.assigneeName ?? '—'}
          </Text>
        </View>
        {/* Department */}
        <Text numberOfLines={1} style={[muted12, { flex: 2 }]}>{task.assigneeDepartment ?? '—'}</Text>
        {/* Task */}
        <Text numberOfLines={1} style={[ts({ size: 13, color: AppTheme.textPrimary }), { flex: 4 }]}>{task.title}</Text>
        {/* Assigned By */}
        <Text numberOfLines={1} style={[muted12, { flex: 2 }]}>{task.assignerName ?? '—'}</Text>
        {/* Due Date */}
        <Text style={[muted12, { width: 80 }]}>{fmtSlashDate(task.dueDate)}</Text>
        {/* Submitted */}
        <Text style={[ts({ size: 12, color: done ? '#22C55E' : AppTheme.textMuted }), { width: 90 }]}>
          {done ? fmtSlashDate(task.submittedDate) : '—'}
        </Text>
        {/* Score */}
        <View style={{ width: 80, alignItems: 'center' }}>
          {done ? (
            <ScoreBadge score={task.scoreOutOf100} flagged={isFlagged} />
          ) : (
            <Text style={ts({ size: 13, color: AppTheme.textMuted })}>—</Text>
          )}
        </View>
        {/* Status */}
        <View style={{ width: 100 }}>
          <StatusChip status={task.status} />
        </View>
        {/* Action */}
        <View style={{ width: 90, alignItems: 'flex-end' }}>
          {done ? (
            <ActionBtn label="View" dark={false} onTap={() => showViewDialog(task)} />
          ) : (
            <ActionBtn label="Evaluate" dark onTap={() => showEvaluateDialog(task)} />
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView>
      <StatRow>
        {[
          <AppraisalStatCard key="a" value={`${evaluated}`} label="Total Faculty Evaluated" icon="check_circle_outline" iconColor="#22C55E" iconBg="#DCFCE7" />,
          <AppraisalStatCard key="b" value={`${flagged}`} label="Flagged Personnel" icon="error_outline" iconColor="#EF4444" iconBg="#FEE2E2" />,
          <AppraisalStatCard key="c" value={`${departments}`} label="Departments Monitored" icon="group_outlined" iconColor="#8B5CF6" iconBg="#EDE9FE" />,
          <AppraisalStatCard
            key="d"
            value={avgScore > 0 ? avgScore.toFixed(0) : '—'}
            label="School Avg Compliance / 100"
            icon="emoji_events_outlined"
            iconColor="#9CA3AF"
            iconBg="#F3F4F6"
          />,
        ]}
      </StatRow>
      <View style={{ height: 16 }} />

      {/* Coverage */}
      <View style={[panelStyle, { padding: 20 }]}>
        <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>
          Appraisal Coverage — All Evaluation Types
        </Text>
        <View style={{ height: 16 }} />
        <StatRow>
          {[
            <CoverageCard key="a" icon="description_outlined" iconColor="#3B82F6" iconBg="#EFF6FF" title="Special Task Timing" subtitle="Task completion and timeline" />,
            <CoverageCard key="b" icon="calendar_month_outlined" iconColor="#10B981" iconBg="#ECFDF5" title="Event Evaluation" subtitle="Multi-stakeholder" />,
            <CoverageCard key="c" icon="assignment_outlined" iconColor="#8B5CF6" iconBg="#EDE9FE" title="Special Task Ratings" subtitle="Weighted rubric" />,
            <CoverageCard key="d" icon="error_outline" iconColor="#EF4444" iconBg="#FEE2E2" title="Escalation Threshold" subtitle="Below 3 stars auto-flags" />,
          ]}
        </StatRow>
        <View style={{ height: 12 }} />
        <View style={{ height: 40, backgroundColor: '#FEF2F2', borderRadius: 8 }} />
      </View>
      <View style={{ height: 16 }} />

      {/* Submissions table */}
      <View style={panelStyle}>
        {/* Title + 3 filters on the right */}
        <View style={{ paddingLeft: 20, paddingTop: 16, paddingRight: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={ts({ size: 15, weight: 700, color: AppTheme.textPrimary })}>Dean Special Task Submissions</Text>
          <View style={{ flex: 1 }} />
          <FilterDropdown
            icon="filter_list"
            label={filterDept ?? 'By Department'}
            options={unique(tasks.map((t) => t.assigneeDepartment))}
            selected={filterDept}
            onSelect={setFilterDept}
          />
          <View style={{ width: 8 }} />
          <FilterDropdown
            icon="filter_list"
            label={filterRole ?? 'By Role'}
            options={unique(tasks.map((t) => t.assigneeRole))}
            selected={filterRole}
            onSelect={setFilterRole}
          />
          <View style={{ width: 8 }} />
          <FilterDropdown
            icon={null}
            label={filterPersonnel ?? 'Select personnel...'}
            options={unique(tasks.map((t) => t.assigneeName))}
            selected={filterPersonnel}
            onSelect={setFilterPersonnel}
          />
        </View>
        <HairDivider />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={[head, { width: 52 }]}>ID</Text>
          <Text style={[head, { flex: 3 }]}>PERSONNEL</Text>
          <Text style={[head, { flex: 2 }]}>DEPARTMENT</Text>
          <Text style={[head, { flex: 4 }]}>TASK</Text>
          <Text style={[head, { flex: 2 }]}>ASSIGNED BY</Text>
          <Text style={[head, { width: 80 }]}>DUE DATE</Text>
          <Text style={[head, { width: 90 }]}>SUBMITTED</Text>
          <Text style={[head, { width: 80, textAlign: 'center' }]}>SCORE</Text>
          <Text style={[head, { width: 100 }]}>STATUS</Text>
          <Text style={[head, { width: 90, textAlign: 'right' }]}>ACTION</Text>
        </View>
        <HairDivider />
        {filtered.map(tableRow)}
      </View>
      <View style={{ height: 16 }} />

      {/* Performance summary */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 20,
          backgroundColor: '#EFF6FF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#BFDBFE',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={ts({ size: 14, weight: 700, color: '#1D4ED8' })}>Annual Faculty Performance Summary</Text>
          <View style={{ height: 4 }} />
          <Text style={ts({ size: 12, color: '#3B82F6' })}>
            Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance
            Evaluation.
          </Text>
        </View>
        <View style={{ width: 16 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <ElevatedButton
            onPress={() => {}}
            icon="download_outlined"
            iconSize={16}
            backgroundColor={AppTheme.darkBanner}
            foregroundColor="#FFFFFF"
            padding={[16, 12]}
            radius={8}
            textStyle={tsPlain({ size: 13, weight: 600 })}
          >
            Export Performance Summary
          </ElevatedButton>
          <View style={{ height: 4 }} />
          <Text style={ts({ size: 11, color: '#3B82F6' })}>Last exported: March 15, 2025</Text>
        </View>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate Special Task Dialog (2-step)
// ─────────────────────────────────────────────────────────────────────────────

function DialogHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 18, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
        <Text style={ts({ size: 13, color: AppTheme.textMuted })}>{subtitle}</Text>
      </View>
      <IconButton onPress={onClose} size={20} padding={0} minSize={0} icon={<Icon name="close" size={20} color={AppTheme.textMuted} />} />
    </View>
  );
}

function TaskInfo({ task: t }: { task: SpecialTask }) {
  const pair = (l: React.ReactNode, r: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
      <View style={{ flex: 1 }}>{l}</View>
      <View style={{ width: 24 }} />
      <View style={{ flex: 1 }}>{r}</View>
    </View>
  );
  return (
    <>
      {pair(<InfoField label="Personnel" value={t.assigneeName ?? '—'} />, <InfoField label="Department" value={t.assigneeDepartment ?? '—'} />)}
      <View style={{ height: 16 }} />
      {pair(<InfoField label="Assigned By" value={t.assignerName ?? '—'} />, <InfoField label="Supervisor" value="—" />)}
      <View style={{ height: 16 }} />
      {pair(<InfoField label="Task" value={t.title} />, <InfoField label="Submitted" value={fmtSlashDate(t.submittedDate)} />)}
      <View style={{ height: 16 }} />
      <InfoField label="Due Date" value={fmtSlashDate(t.dueDate)} />
    </>
  );
}

const mutedButton = tsPlain({ weight: 600, color: AppTheme.textMuted });

function EvaluateSpecialTaskDialog({ task, pop }: { task: SpecialTask; pop: (result?: SpecialTask) => void }) {
  const [step, setStep] = useState(1); // 1 = info, 2 = rating
  const [completion, setCompletion] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [initiative, setInitiative] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const estimatedScore = Math.round((completion * 40 + timeliness * 30 + initiative * 30) / 5);

  const submit = async () => {
    if (completion === 0 || timeliness === 0 || initiative === 0) {
      showSnackBar('Please rate all criteria.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await ApiService.evaluateSpecialTask(task.id, {
        completion_quality_score: completion,
        timeliness_score: timeliness,
        initiative_score: initiative,
        coordination_score: initiative,
        remarks: remarks.trim(),
      });
      pop(updated);
    } catch (e) {
      showSnackBar(`Error: ${exceptionText(e)}`, { backgroundColor: RED });
      setSubmitting(false);
    }
  };

  return (
    <Dialog radius={16}>
      <View style={{ width: 620, maxWidth: '100%', padding: 28, alignItems: 'flex-start' }}>
        {/* Header */}
        <DialogHeader title="Evaluate Special Task" subtitle={task.title} onClose={() => pop()} />
        <View style={{ height: 20 }} />
        {step === 1 ? (
          <View style={{ alignSelf: 'stretch', alignItems: 'flex-start' }}>
            <TaskInfo task={task} />
            <View style={{ height: 24 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'stretch' }}>
              <TextButton onPress={() => pop()}>
                <Text style={mutedButton}>Close</Text>
              </TextButton>
              <View style={{ width: 12 }} />
              <ElevatedButton
                onPress={() => setStep(2)}
                icon={<View />}
                backgroundColor={AppTheme.darkBanner}
                foregroundColor="#FFFFFF"
                padding={[20, 12]}
                radius={8}
              >
                <Text style={tsPlain({ size: 13, weight: 600, color: '#FFFFFF' })}>Start Evaluation</Text>
                <View style={{ width: 4 }} />
                <Icon name="arrow_forward" size={16} color="#FFFFFF" />
              </ElevatedButton>
            </View>
          </View>
        ) : (
          <View style={{ alignSelf: 'stretch', alignItems: 'flex-start' }}>
            <StarRatingRow label="Task Completion Quality (40%)" value={completion} onChanged={setCompletion} />
            <View style={{ height: 16 }} />
            <StarRatingRow label="Timeliness and Reliability (30%)" value={timeliness} onChanged={setTimeliness} />
            <View style={{ height: 16 }} />
            <StarRatingRow label="Initiative and Problem-Solving (30%)" value={initiative} onChanged={setInitiative} />
            <View style={{ height: 16 }} />
            <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>Remarks</Text>
            <View style={{ height: 6 }} />
            <TextField
              style={{ alignSelf: 'stretch' }}
              value={remarks}
              onChangeText={setRemarks}
              maxLines={4}
              minLines={4}
              textStyle={tsField({ size: 13 })}
              decoration={{
                hintText: 'Add remarks...',
                hintStyle: TextStyles.bodyMd,
                filled: true,
                fillColor: '#FFFFFF',
                contentPadding: [12, 12],
                radius: 8,
                borderColor: AppTheme.borderColor,
                borderWidth: 1,
                focusedBorderColor: AppTheme.accentBlue,
                focusedBorderWidth: 1.5,
              }}
            />
            <View style={{ height: 10 }} />
            <Text style={ts({ size: 13, weight: 500, color: AppTheme.textMuted })}>
              {`Estimated score: ${estimatedScore}/100`}
            </Text>
            <View style={{ height: 20 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'stretch' }}>
              <TextButton onPress={() => setStep(1)}>
                <Text style={mutedButton}>Back</Text>
              </TextButton>
              <View style={{ width: 8 }} />
              <TextButton onPress={() => pop()}>
                <Text style={mutedButton}>Close</Text>
              </TextButton>
              <View style={{ width: 12 }} />
              <ElevatedButton
                onPress={submitting ? null : submit}
                backgroundColor={AppTheme.darkBanner}
                foregroundColor="#FFFFFF"
                padding={[20, 12]}
                radius={8}
                textStyle={tsPlain({ size: 13, weight: 600 })}
              >
                {submitting ? <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" /> : 'Submit Evaluation'}
              </ElevatedButton>
            </View>
          </View>
        )}
      </View>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View Special Task Evaluation Dialog
// ─────────────────────────────────────────────────────────────────────────────

function ViewSpecialTaskDialog({ task, onClose }: { task: SpecialTask; onClose: () => void }) {
  const ev = task.evaluation;
  return (
    <Dialog radius={16}>
      <ScrollView style={{ width: 620, maxWidth: '100%', flexGrow: 0 }} contentContainerStyle={{ padding: 28, alignItems: 'flex-start' }}>
        <DialogHeader title="View Evaluation" subtitle={task.title} onClose={onClose} />
        <View style={{ height: 20 }} />
        <TaskInfo task={task} />
        {ev != null && (
          <View style={{ alignSelf: 'stretch', alignItems: 'flex-start' }}>
            <View style={{ height: 20 }} />
            <View style={{ alignSelf: 'stretch' }}>
              <Divider />
            </View>
            <View style={{ height: 12 }} />
            <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>Previous Evaluation:</Text>
            <View style={{ height: 12 }} />
            <EvalReadRow label="Task Completion Quality (40%)" score={ev.completionScore} />
            <View style={{ height: 8 }} />
            <EvalReadRow label="Timeliness and Reliability (30%)" score={ev.timelinessScore} />
            <View style={{ height: 8 }} />
            <EvalReadRow label="Initiative and Problem-Solving (30%)" score={ev.initiativeScore} />
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              <Text style={[ts({ size: 13, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>Total Weighted Score</Text>
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 6 }}>
                <Text style={ts({ size: 14, weight: 700, color: '#1D4ED8' })}>{`${task.scoreOutOf100}/100`}</Text>
              </View>
            </View>
            {ev.remarks != null && ev.remarks.length > 0 && (
              <>
                <View style={{ height: 12 }} />
                <Text style={ts({ size: 13, weight: 700, color: AppTheme.textPrimary })}>Coordinator Remarks:</Text>
                <View style={{ height: 4 }} />
                <Text style={ts({ size: 13, color: AppTheme.textMuted })}>{ev.remarks}</Text>
              </>
            )}
          </View>
        )}
        <View style={{ height: 24 }} />
        <View style={{ alignSelf: 'stretch', alignItems: 'flex-end' }}>
          <TextButton onPress={onClose}>
            <Text style={mutedButton}>Close</Text>
          </TextButton>
        </View>
      </ScrollView>
    </Dialog>
  );
}
