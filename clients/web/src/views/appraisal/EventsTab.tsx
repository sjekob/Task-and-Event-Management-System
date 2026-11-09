import { ReactNode, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, ChevronRight, ClipboardCheck, ClipboardList, Info, Link2, Percent, QrCode, SlidersHorizontal, Users } from 'lucide-react';
import { AppraisalController, EventAppraisal, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { EventForAppraisal } from '@shared/models';
import { IconButton, Modal } from '../../ui/kit';
import { DemographicsDialog, EventRatingDialog, LinkDialog } from './EventDialogs';
import { Chip, ErrorPanel, FilterDropdown, Stat, TONE, TabSkeleton } from './common';
import { shareOrigin } from '../../app/shareOrigin';

// Events tab: evidency rates, QR / link evaluation and results.
export function EventsTab({ c }: { c: AppraisalController }) {
  const s = c.state.events;
  const [title, setTitle] = useState<string | null>(null);
  const [options, setOptions] = useState<EventForAppraisal | null>(null);
  const [qr, setQr] = useState<EventForAppraisal | null>(null);
  const [link, setLink] = useState<EventForAppraisal | null>(null);
  const [demo, setDemo] = useState<EventForAppraisal | null>(null);
  const [results, setResults] = useState<EventForAppraisal | null>(null);
  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadEvents()} />;
  const cards = EventAppraisal.cards(s.items);
  const avgColor = cards.avg == null ? 'var(--muted)' : TONE[EventAppraisal.rateTone(cards.avg)];
  const rows = title ? s.items.filter((e) => e.title === title) : s.items;
  return (
    <div className="col gap-16">
      <div className="grid-3">
        <Stat value={String(cards.total)} label="Total Events" sub={`${cards.total} total · ${cards.pending} awaiting ratings`} icon={<CalendarDays size={22} />} color="var(--muted)" bg="#f3f4f6" />
        <Stat value={String(cards.rated)} label="Rated Events" icon={<ClipboardCheck size={22} />} color="#10b981" bg="#ecfdf5" />
        <Stat value={cards.avg == null ? '—' : `${cards.avg.toFixed(0)}%`} label="Avg Evidency Rate" icon={<Percent size={22} />} color={avgColor} bg="#f3f4f6" valueColor={avgColor} />
      </div>
      <div style={{ padding: 16, borderRadius: 8, background: 'var(--surface-2)', border: '0.8px solid var(--border)' }}>
        <div className="row gap-8" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}><Info size={18} color="var(--muted)" />Evidency Rate Legend</div>
        <div className="grid-3 mt-12" style={{ gap: 12 }}>
          {([['#16a34a', 'Green', 'High (≥ 80%)'], ['#ea580c', 'Yellow', 'Mid (50% - 79%)'], ['#ef4444', 'Red', 'Low (< 50%)']] as const).map(([col, l, d]) => (
            <div key={l} className="row gap-8" style={{ background: '#fff', border: '0.8px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: col }} /><span><b style={{ color: col }}>{l}:</b> {d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ap-card" style={{ padding: 0 }}>
        <div className="row wrap gap-8" style={{ padding: '16px 20px 14px' }}>
          <span className="grow" style={{ fontSize: 15, fontWeight: 700 }}>School-Wide Events</span>
          <FilterDropdown icon={<SlidersHorizontal size={14} />} label="Show All" options={[...new Set(s.items.map((e) => e.title).filter(Boolean))].sort()} selected={title} onSelect={setTitle} />
        </div>
        <div className="table-wrap">
          <table className="table ap-table">
            <thead><tr><th>EVENT NAME</th><th>DATE</th><th>DEPARTMENT</th><th>ORGANIZER</th><th style={{ textAlign: 'center' }}>RESPONSES</th><th style={{ textAlign: 'center' }}>EVIDENCY RATE</th><th style={{ textAlign: 'center' }}>STATUS</th><th style={{ textAlign: 'center' }}>DEMOGRAPHICS</th><th style={{ textAlign: 'center' }}>EVALUATION</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const has = e.evaluations.length > 0;
                const col = has ? TONE[EventAppraisal.rateTone(e.evidencyRate)] : 'var(--muted)';
                return (
                  <tr key={e.id}>
                    <td><b style={{ fontWeight: 600 }}>{e.title}</b></td>
                    <td className="muted">{SpecialTaskStats.fmtDate(e.targetDate)}</td>
                    <td className="muted">{e.department ?? '—'}</td>
                    <td className="muted">{e.organizerName ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{EventAppraisal.responses(e)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: col }}>{has ? `${e.evidencyRate.toFixed(0)}%` : '—'}</td>
                    <td style={{ textAlign: 'center' }}><Chip status={EventAppraisal.effectiveStatus(e)} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <IconButton small title={has ? 'Evaluator demographics' : 'No evaluations yet'} onClick={() => setDemo(e)}><Users size={20} color={has ? 'var(--accent)' : 'var(--light)'} /></IconButton>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <IconButton small title="Evaluation: QR code, link and results" onClick={() => setOptions(e)}><ClipboardList size={20} color="var(--accent)" /></IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {options && (
        <Modal title="Evaluation Options" onClose={() => setOptions(null)}>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{options.title}</div>
          {EventAppraisal.organizerLine(options) && <div className="caption" style={{ textAlign: 'center' }}>{EventAppraisal.organizerLine(options)}</div>}
          <div className="col gap-12 mt-16">
            <OptionCard icon={<QrCode size={20} />} title="Show QR Code" sub="Generate a QR code for attendees to scan on their devices" onClick={() => { setQr(options); setOptions(null); }} />
            <OptionCard icon={<Link2 size={20} />} title="Get Evaluation Link" sub="Copy the direct URL link to the evaluation web page" onClick={() => { setLink(options); setOptions(null); }} />
            {options.evaluations.length > 0
              ? <OptionCard icon={<ClipboardCheck size={20} />} title="View Results" sub={`See the ratings from ${options.evaluations.length} evaluation${options.evaluations.length === 1 ? '' : 's'}`} onClick={() => { setResults(options); setOptions(null); }} />
              : <div className="caption" style={{ textAlign: 'center' }}>Results appear here once attendees submit evaluations.</div>}
          </div>
        </Modal>
      )}
      {qr && (
        <Modal title="Event Evaluation QR Code" onClose={() => setQr(null)}>
          <div className="col center" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{qr.title}</div>
            {EventAppraisal.organizerLine(qr) && <div className="caption">{EventAppraisal.organizerLine(qr)}</div>}
            <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, marginTop: 20 }}><QRCodeSVG value={EventAppraisal.evalUrl(shareOrigin(), qr)} size={200} /></div>
            <div className="caption mt-16">Event ID: {qr.id}</div>
            <a href={EventAppraisal.evalUrl(shareOrigin(), qr)} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{EventAppraisal.evalUrl(shareOrigin(), qr)}</a>
          </div>
        </Modal>
      )}
      {link && <LinkDialog event={link} onClose={() => setLink(null)} />}
      {demo && <DemographicsDialog event={demo} onClose={() => setDemo(null)} />}
      {results && <EventRatingDialog event={results} onClose={(u) => { setResults(null); if (u) c.replaceEvent(u); }} />}
    </div>
  );
}

export function OptionCard({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="row-btn" style={{ background: 'var(--surface-2)', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }} onClick={onClick}>
      <span className="att-icon" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--accent)' }}>{icon}</span>
      <span className="grow"><span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{title}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{sub}</span></span>
      <ChevronRight size={20} color="var(--muted)" />
    </button>
  );
}
