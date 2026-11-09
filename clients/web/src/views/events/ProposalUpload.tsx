import { DragEvent, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, CircleCheck, CircleDashed, FileText, Image as ImageIcon, Upload } from 'lucide-react';
import { ProposalFormController } from '@shared/controllers/EventControllers';
import { PROPOSAL_FILE_TYPES } from '@shared/controllers/proposalReading';
import { useFeedback } from '../../ui/feedback';
import { Button, Spinner, pickFiles } from '../../ui/kit';

/** "Upload your event proposal": the first screen of a new proposal (and "Fill from proposal file"). */
export function ProposalDropArea({ c }: { c: ProposalFormController }) {
  const fb = useFeedback();
  const [over, setOver] = useState(false);
  const busy = c.state.reading;
  const read = async (files: File[]) => {
    if (!files.length) return;
    const r = await c.readFiles(files.map((f) => ({ name: f.name, type: f.type, blob: f })));
    if (typeof r === 'string') { fb.toast(r, 'error'); return; }
    if (c.isDirty && !(await fb.confirm({
      title: 'Replace what you entered?', confirmLabel: 'Replace', cancelLabel: 'Keep my entries',
      message: `The proposal fields will be filled from ${r.files.length > 1 ? 'the photos' : r.files[0]}, replacing what is in the form now.`,
    }))) return;
    c.applyReading(r);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void read(Array.from(e.dataTransfer.files)); };
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="ev-drop" data-over={over || undefined} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        {busy ? (
          <div className="col gap-8" style={{ alignItems: 'center', padding: '12px 0' }}>
            <Spinner />
            <div style={{ fontWeight: 600 }}>{busy}</div>
            <div className="caption">Photos and scans take longer: each page is read with OCR.</div>
          </div>
        ) : (
          <div className="col gap-12" style={{ alignItems: 'center' }}>
            <span className="att-icon" style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--accent-bg)', color: 'var(--accent-dark)' }}><Upload size={26} /></span>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Upload your event proposal</div>
            <div className="body-md" style={{ maxWidth: 520, color: 'var(--muted)' }}>
              TaskNet reads the title, date, venue, schedule, budget and working committee from the file and fills in the proposal for you to check.
            </div>
            <Button icon={<FileText size={18} />} onClick={async () => void read(await pickFiles(PROPOSAL_FILE_TYPES, true))}>Choose file</Button>
            <div className="caption">Word (.docx) or PDF works best. For a printed copy, select a photo of every page (PNG or JPG). Up to 15 MB each.</div>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button type="button" className="link-btn caption" onClick={() => c.showUpload(false)}>No file? Fill in the proposal by hand</button>
      </div>
    </div>
  );
}

/** What was read from the file: sections found or missing (click to open that step), things to check, and the committee. */
export function ReadingPanel({ c, onSubmitAsFile }: { c: ProposalFormController; onSubmitAsFile?: () => void }) {
  const [open, setOpen] = useState(true);
  const r = c.readingSummary;
  if (!r) return null;
  const ocr = c.state.d.reading?.method === 'ocr';
  const jump = (step: number) => { setOpen(false); c.goTo(step); };
  const m = r.members;
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="row wrap gap-12">
        <span className="att-icon" style={{ width: 36, height: 36, borderRadius: 8, background: ocr ? '#ffedd5' : '#dcfce7', color: ocr ? '#c2410c' : '#15803d' }}>
          {ocr ? <ImageIcon size={20} /> : <FileText size={20} />}
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 700 }}>{r.fileLabel}</div>
          <div className="caption">Filled in from this {r.methodLabel} · {r.found} of {r.total} sections found</div>
        </div>
        <Button size="sm" variant="outline-muted" icon={<Upload size={14} />} onClick={() => c.showUpload(true)}>Upload another</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? <>Hide <ChevronUp size={14} /></> : <>Details <ChevronDown size={14} /></>}</Button>
      </div>
      {open && (
        <div className="col gap-8 mt-12" style={{ fontSize: 13.5 }}>
          <div className="row-top gap-8">
            {r.missing.length ? <CircleDashed size={16} color="var(--light)" style={{ flexShrink: 0, marginTop: 2 }} /> : <CircleCheck size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />}
            <span>
              {r.missing.length ? <>Not in the file:{' '}
                {r.missing.map((x, i) => <span key={x.label}>{i > 0 && ', '}<button type="button" className="link-btn" onClick={() => jump(x.step)}>{x.label}</button></span>)}
                <span className="caption">{r.missing.length === 1 ? '. Fill it in by hand.' : '. Fill them in by hand.'}</span></>
                : 'Every section of the proposal was found in the file.'}
            </span>
          </div>
          {r.toCheck.map((w) => (
            <div key={w.text} className="row-top gap-8">
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <span className="grow">{w.text}</span>
              {w.action && <button type="button" className="link-btn" onClick={() => jump(w.action === 'link' ? 4 : 0)}>{w.action === 'link' ? 'Link accounts' : 'Change date'}</button>}
            </div>
          ))}
          {m.total > 0 && (
            <div className="caption">
              Working committee: {m.automated} to automate · {m.credited} top score{m.uncredited ? ` · ${m.uncredited} need${m.uncredited === 1 ? 's' : ''} a linked account to be credited` : ''}.
              Choose which members get a special task in the Budget step; the others are credited the top score on approval.
            </div>
          )}
          <div className="row wrap gap-8" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            {onSubmitAsFile && c.canSubmitAsFile && (
              <>
                <span className="caption grow">Happy with your file? Submit it as is: you'll only be asked for the time, the venue pin and the special tasks.</span>
                <Button size="sm" variant="outline" icon={<FileText size={14} />} onClick={onSubmitAsFile}>Submit this file as is</Button>
              </>
            )}
            <Button size="sm" onClick={() => jump(0)}>Review the proposal →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
