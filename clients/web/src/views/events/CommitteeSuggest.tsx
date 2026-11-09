import { useEffect, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { MemberRow } from '@shared/controllers/proposalDraft';
import { CommitteeSuggestion } from '@shared/services/EventService';
import { Avatar, Spinner } from '../../ui/kit';

/**
 * "Suggest" beside a committee member's account picker: staff ranked for this
 * member's role (Terms of Reference, output, designation) by the same fit score
 * as task assignment, the person named in the proposal first. Picking one links
 * their account.
 */
export function CommitteeSuggest({ c, g, i, m }: { c: ProposalFormController; g: number; i: number; m: MemberRow }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CommitteeSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const scrolled = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', scrolled);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', scrolled);
    };
  }, [open]);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    // Placed on the page (fixed), so tables and dialogs that scroll can't clip it.
    const r = box.current?.getBoundingClientRect();
    if (r) {
      const up = r.bottom + 380 > window.innerHeight && r.top > 380;
      setAt({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 368)), up });
    }
    setOpen(true);
    setList(null);
    setError(null);
    try { setList(await c.suggestMembers(g, i)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load suggestions'); }
  };

  const described = !!(m.tor.trim() || m.output.trim() || m.designation.trim());

  return (
    <div className="cs" ref={box}>
      <button type="button" className="cs-btn" onClick={() => void toggle()} aria-expanded={open}
        title="Suggest who fits this role, from their skills, certificates and workload">
        <Sparkles size={14} />Suggest
      </button>
      {open && (
        <div className="cs-pop" style={{ top: at.top, left: at.left, transform: at.up ? 'translateY(-100%)' : undefined }} role="dialog" aria-label={`Suggestions for ${m.name || 'this member'}`}>
          <div className="cs-head">
            <b>Who fits this role</b>
            <span className="caption">{described ? 'From their skills, certificates and current workload' : 'Add the Terms of Reference or output for better matches'}</span>
          </div>
          {error ? <div className="cs-empty" style={{ color: 'var(--red)' }}>{error}</div>
            : !list ? <div className="cs-empty"><Spinner /></div>
            : !list.length ? <div className="cs-empty">No staff to suggest.</div>
            : list.map(({ s, nameMatch }) => {
              const on = m.userId === s.user.id;
              const tone = s.score >= 70 ? 'green' : s.score >= 40 ? 'amber' : 'gray';
              return (
                <button key={s.user.id} type="button" className={`cs-item ${on ? 'on' : ''}`}
                  onClick={() => { c.linkMember(g, i, s.user.id, s.user.fullName); setOpen(false); }}>
                  <Avatar url={s.user.avatarUrl} initials={s.user.initials} size={30} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row gap-6" style={{ flexWrap: 'wrap' }}>
                      <b className="ellipsis">{s.user.fullName}</b>
                      {nameMatch && <span className="badge blue">Named in proposal</span>}
                    </span>
                    <span className="caption ellipsis" style={{ display: 'block' }}>
                      {[s.user.roleLabel, s.user.gradeLevel].filter(Boolean).join(' · ')} · {s.openTasks} open task{s.openTasks === 1 ? '' : 's'}
                      {s.isHighBurden ? ' · busy' : ''}
                    </span>
                    <span className="cs-reason">{s.reasons[0] ?? 'No matching skills or certificates on file'}</span>
                  </span>
                  <span className={`badge ${tone}`} title="Fit score (competency 0-70 + workload 0-30)">{Math.round(s.score)}</span>
                  {on && <Check size={16} color="var(--accent)" />}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
