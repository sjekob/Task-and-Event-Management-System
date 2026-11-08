import { ReactNode } from 'react';
import { AlertTriangle, Award, Search, Sparkles, Zap } from 'lucide-react';
import { AssignPickerController, AssignPickerOptions } from '@shared/controllers/AssignPickerController';
import { AssigneeSuggestion, User } from '@shared/models';
import { useScreenController } from '../app/hooks';
import { Avatar, Button, Modal, Spinner } from './kit';
import { CredibilityBadge } from './CredibilityBadge';

const TONE = { green: ['#15803d', 'var(--green-bg)'], blue: ['var(--accent)', 'var(--blue-bg)'], gray: ['var(--muted)', '#f3f4f6'] } as const;

/**
 * Personnel picker for assigning a task: ranked by fit with a "why" box per
 * person, high-burden flags and a warning when one is selected.
 */
export function AssignPickerDialog({ options, onClose, onDone, title, header }: {
  options: AssignPickerOptions;
  onClose: () => void;
  /** Without options.onConfirm: called with the chosen ids. */
  onDone?: (ids: Set<number>) => void;
  title?: string;
  header?: ReactNode;
}) {
  const [c, s] = useScreenController(() => new AssignPickerController(options), []);
  const confirmMode = !!options.onConfirm;

  const footer = confirmMode ? (
    <>
      <Button variant="outline-muted" onClick={onClose} disabled={s.busy}>Cancel</Button>
      <Button variant="primary" loading={s.busy} disabled={!s.selected.size}
        onClick={async () => { if (await c.confirm()) onClose(); }}>
        Assign{s.selected.size ? ` (${s.selected.size})` : ''}
      </Button>
    </>
  ) : (
    <Button variant="primary" onClick={() => { onDone?.(s.selected); onClose(); }}>Done ({s.selected.size})</Button>
  );

  return (
    <Modal title={title ?? 'Select Personnel'} onClose={onClose} size="wide" footer={footer}>
      {header && <div className="mb-12">{header}</div>}
      {c.hasSuggestions && (
        <div className="alert blue mb-12" style={{ alignItems: 'center' }}>
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <span className="grow" style={{ fontSize: 12 }}>{c.suggestionText()}</span>
          {s.loading ? <Spinner small /> : s.ranked.size > 0 && (
            <Button variant="ghost" size="sm" icon={<Zap size={15} />} onClick={() => c.autoSelect()}
              title={c.hasMatches ? 'Select everyone whose profile matches, skipping high-burden people' : 'Select the top-ranked person without a high burden'}>
              Auto-select
            </Button>
          )}
        </div>
      )}
      <div className="input-icon mb-8">
        <Search size={16} />
        <input className="input" placeholder="Search by name or skill..." value={s.search} onChange={(e) => c.setSearch(e.target.value)}
          style={{ background: 'var(--bg)', border: 0 }} />
      </div>
      {s.error && <div className="alert red mb-8">{s.error}</div>}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {c.filtered.length === 0
          ? <div className="empty">No personnel found</div>
          : c.filtered.map((u) => <PickerRow key={u.id} u={u} s={s.ranked.get(u.id)} checked={s.selected.has(u.id)} top={c.isTop(u.id)} onToggle={() => c.toggle(u.id)} />)}
      </div>
      {c.burdenedSelection.length > 0 && <BurdenWarning people={c.burdenedSelection} />}
    </Modal>
  );
}

function PickerRow({ u, s, checked, top, onToggle }: { u: User; s?: AssigneeSuggestion; checked: boolean; top: boolean; onToggle: () => void }) {
  return (
    <label className="row-top gap-12" style={{ padding: '12px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
      <Avatar url={u.avatarUrl} initials={u.initials} size={36} />
      <div className="grow">
        <div className="row wrap gap-6">
          <span className="label">{u.fullName}</span>
          {s && <Pill tone={AssignPickerController.fitTone(s)}>Fit {AssignPickerController.fitScore(s)}/100</Pill>}
          {s?.isMatch && <Pill tone={top ? 'green' : 'blue'}>{top ? 'Best fit' : 'Match'}</Pill>}
          {s && s.burden !== 'low' && (
            <span title={s.loadFactors.join(' · ')}>
              {s.isHighBurden
                ? <span className="badge red" style={{ borderRadius: 6, padding: '2px 6px' }}><AlertTriangle size={12} />High burden</span>
                : <span className="badge amber" style={{ borderRadius: 6, padding: '2px 6px' }}>Moderate load</span>}
            </span>
          )}
        </div>
        <div className="body-sm" style={{ color: 'var(--muted)' }}>{u.roleLabel}{u.gradeLevel ? ` · ${u.gradeLevel}` : ''}</div>
        {s && (
          <div className="mt-8" style={{
            background: 'var(--bg)', borderRadius: 8, padding: '8px 10px',
            border: `1px solid ${s.isHighBurden ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{AssignPickerController.fitParts(s)}</div>
            <div className="text-2" style={{ fontSize: 11.5, marginTop: 4 }}>{AssignPickerController.whySentence(s)}</div>
            {AssignPickerController.certsFor(s).length > 0 && (
              <div className="row wrap gap-4 mt-8">
                {AssignPickerController.certsFor(s).map(({ cert, matched }) => (
                  <span key={cert.name} title={[cert.issuerLabel, cert.category, matched ? 'fits this task' : null].filter(Boolean).join(' · ')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 3px 2px 6px', borderRadius: 7, background: '#fff',
                      border: `1px solid ${matched ? 'rgba(34,197,94,0.6)' : 'var(--border)'}`, fontSize: 11, fontWeight: 600, maxWidth: '100%',
                    }}>
                    <Award size={12} color={matched ? 'var(--green)' : 'var(--muted)'} />
                    <span className="ellipsis">{cert.name}</span>
                    <CredibilityBadge credibility={cert.credibility} authenticity={cert.authenticity} compact />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: 18, height: 18, accentColor: 'var(--accent)', marginTop: 8 }} />
    </label>
  );
}

function Pill({ tone, children }: { tone: 'green' | 'blue' | 'gray'; children: ReactNode }) {
  const [fg, bg] = TONE[tone];
  return <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: fg, background: bg }}>{children}</span>;
}

function BurdenWarning({ people }: { people: AssigneeSuggestion[] }) {
  return (
    <div className="alert red mt-12" style={{ border: '1px solid rgba(239,68,68,0.4)' }}>
      <AlertTriangle size={20} style={{ flexShrink: 0 }} />
      <div>
        <div className="label" style={{ color: 'var(--red)' }}>
          {people.length === 1 ? `High burden: ${people[0].user.fullName}` : `High burden: ${people.length} selected people`}
        </div>
        {people.map((p) => (
          <div key={p.user.id} className="body-sm" style={{ color: 'var(--text-2)' }}>
            {people.length > 1 ? `${p.user.fullName}: ` : ''}{p.loadFactors.join(', ')}
          </div>
        ))}
        <div className="body-sm" style={{ color: 'var(--text-2)' }}>Consider someone with a lighter load, or keep them if this task needs them.</div>
      </div>
    </div>
  );
}

/** "Assign as" choice chips. Renders nothing when there is only one option. */
export function AssignRoleSelector({ options, value, onChange }: { options: string[]; value: string | null; onChange: (r: string) => void }) {
  if (options.length < 2) return null;
  return (
    <div className="row wrap gap-8">
      {options.map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)} aria-pressed={r === value}
          className="btn" style={{
            background: r === value ? 'var(--dark)' : '#fff', color: r === value ? '#fff' : 'var(--muted)',
            border: `1px solid ${r === value ? 'var(--dark)' : 'var(--border)'}`,
          }}>
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}
