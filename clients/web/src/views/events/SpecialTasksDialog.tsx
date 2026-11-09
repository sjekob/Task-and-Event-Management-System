import { ClipboardCheck, Send, Users } from 'lucide-react';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { MemberRow, taskDueDate } from '@shared/controllers/proposalDraft';
import { memberResult } from '@shared/controllers/proposalReading';
import { Format } from '@shared/utils/format';
import { Button, Modal } from '../../ui/kit';
import { CommitteeSuggest } from './CommitteeSuggest';

/**
 * The committee's special tasks, grouped by committee. Ticked members get a
 * special task when the event is approved: titled by their Output, described by
 * their Terms of Reference, due a number of days after the event (7 by default,
 * changeable). Unticked members get the top score instead.
 *
 * With [onSubmit] it is the last check before the proposal is submitted.
 */
export function SpecialTasksDialog({ c, onClose, onSubmit, submitting }: {
  c: ProposalFormController; onClose: () => void; onSubmit?: () => void; submitting?: boolean;
}) {
  const d = c.state.d;
  const groups = d.twg.map((g, gi) => ({ g, gi, rows: g.members.map((m, mi) => ({ m, mi })).filter((r) => r.m.name.trim()) }))
    .filter((x) => x.rows.length);
  const all = groups.flatMap((x) => x.rows.map((r) => r.m));
  const eligible = all.filter((m) => ProposalFormController.canAutomate(m));
  const ticked = eligible.filter((m) => m.automate).length;

  return (
    <Modal title={onSubmit ? 'Before you submit: committee special tasks' : 'Working committee: choose the tasks to automate'}
      icon={<ClipboardCheck size={20} />} size="xwide" onClose={onClose}
      subtitle="Ticked members get a special task in TaskNet when the event is approved, rated after the event. Members you leave unticked get no task and are credited the top score (100/100) on approval."
      footer={<>
        <span className="caption grow">{ticked} of {eligible.length} {eligible.length === 1 ? 'member' : 'members'} will get a special task</span>
        {onSubmit ? (
          <>
            <Button variant="outline-muted" onClick={onClose}>Back to editing</Button>
            <Button icon={<Send size={16} />} loading={submitting} onClick={onSubmit}>Submit proposal</Button>
          </>
        ) : <Button onClick={onClose}>Done</Button>}
      </>}>
      <SpecialTasksTable c={c} />
    </Modal>
  );
}

/** The committee table: tick who gets an automated special task, its due days, and the linked account. */
export function SpecialTasksTable({ c }: { c: ProposalFormController }) {
  const d = c.state.d;
  const groups = d.twg.map((g, gi) => ({ g, gi, rows: g.members.map((m, mi) => ({ m, mi })).filter((r) => r.m.name.trim()) }))
    .filter((x) => x.rows.length);
  const eligible = groups.flatMap((x) => x.rows.map((r) => r.m)).filter((m) => ProposalFormController.canAutomate(m));
  const allOn = eligible.length > 0 && eligible.every((m) => m.automate);
  return (
    <>
    {!groups.length ? (
      <div className="caption" style={{ textAlign: 'center', padding: 24 }}>No committee members yet. Add them in the Budget step.</div>
    ) : (
      <div className="st-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th style={{ width: 84 }}>
                <label className="row gap-6" style={{ cursor: eligible.length ? 'pointer' : 'default' }}>
                  <input type="checkbox" aria-label="Automate all" checked={allOn} disabled={!eligible.length}
                    onChange={(e) => c.setAllAutomate(e.target.checked)} />Automate
                </label>
              </th>
              <th style={{ width: '18%' }}>Member</th>
              <th>Description <span className="st-src">(Terms of Reference)</span></th>
              <th style={{ width: '19%' }}>Output <span className="st-src">(task title)</span></th>
              <th style={{ width: 150 }}>Due</th>
              <th style={{ width: 190 }}>Result on approval</th>
            </tr>
          </thead>
          {groups.map(({ g, gi, rows }) => (
            <tbody key={gi}>
              <tr className="st-group">
                <td colSpan={6}>
                  <span className="row gap-6"><Users size={14} /><b>{g.title || 'Committee'}</b>
                    <span className="caption">· {rows.length} {rows.length === 1 ? 'member' : 'members'}</span></span>
                </td>
              </tr>
              {rows.map(({ m, mi }) => {
                const can = ProposalFormController.canAutomate(m);
                return (
                  <tr key={mi} className={m.automate ? 'on' : ''}>
                    <td>
                      <input type="checkbox" aria-label={`Automate a special task for ${m.name}`} checked={m.automate} disabled={!can}
                        title={can ? undefined : whyNot(m)} onChange={(e) => c.setMemberAutomate(gi, mi, e.target.checked)} />
                    </td>
                    <td>
                      <div className="st-name">{m.name}</div>
                      {m.designation.trim() && <div className="caption">{m.designation}</div>}
                    </td>
                    <td className="st-desc">{m.tor.trim() || <span className="caption">Not stated</span>}</td>
                    <td className="st-title">{m.output.trim() || <span className="caption">Not stated</span>}</td>
                    <td><DueField days={m.dueDays} targetDate={d.targetDate} disabled={!m.automate} onChange={(n) => c.setMemberDueDays(gi, mi, n)} /></td>
                    <td><Result c={c} g={gi} i={mi} m={m} /></td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    )}
    </>
  );
}

function whyNot(m: MemberRow): string {
  return m.userId === null ? 'Link an account to give a task' : 'Write an Output to title the task';
}

/** What the member gets on approval, and the account it goes to (changeable here). */
function Result({ c, g, i, m }: { c: ProposalFormController; g: number; i: number; m: MemberRow }) {
  const r = memberResult(m);
  return (
    <div className="col" style={{ gap: 6, alignItems: 'flex-start' }}>
      <span className={`badge ${r.tone}`}>{r.label}</span>
      <select className="input st-account" value={m.userId ?? ''} aria-label={`TaskNet account for ${m.name}`}
        onChange={(e) => c.linkMember(g, i, e.target.value ? Number(e.target.value) : null)}>
        <option value="">Link an account…</option>
        {c.state.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <CommitteeSuggest c={c} g={g} i={i} m={m} />
      {m.userId !== null && !m.output.trim() && <span className="st-why">{whyNot(m)}</span>}
    </div>
  );
}

/** "[7] days after" with the resulting date. */
function DueField({ days, targetDate, disabled, onChange }: { days: number; targetDate: string; disabled: boolean; onChange: (n: number) => void }) {
  const due = taskDueDate(targetDate, days);
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="row gap-6">
        <input className="input st-days" type="number" min={0} max={365} value={days} disabled={disabled}
          aria-label="Days after the event" onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        <span className="caption">days after</span>
      </div>
      <div className="caption" style={{ marginTop: 4 }}>{due ? <>Due <b style={{ color: 'var(--text)' }}>{Format.date(due)}</b></> : 'Set the event date first'}</div>
    </div>
  );
}
