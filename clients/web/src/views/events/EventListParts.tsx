import { ReactNode, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical, FileText } from 'lucide-react';
import { Tooltip } from '../../ui/Tooltip';
import { EventsController } from '@shared/controllers/EventControllers';
import { EventItem } from '@shared/models';
import { CalendarMonth } from '@shared/utils/calendar';
import { ActionMenu, IconButton } from '../../ui/kit';

// Event cards and the side calendar of the Event Calendar page.
export function Section({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mb-16"><div className="ev-label">{label}</div>{children}</div>;
}

export function EventCard({ e, onTap, onPrint, menu }: {
  e: EventItem; onTap: () => void; onPrint: () => void; menu?: { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean }[];
}) {
  return (
    <div className="ev-card" onClick={onTap}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap-8">
          <span className="ev-title">{e.title}</span>
          <span className="ev-pill" style={{ background: `${e.statusColor}1f`, color: e.statusColor }}>{e.isPending ? 'Pending' : e.statusLabel}</span>
        </div>
        <div className="ev-desc clamp-2">{EventsController.description(e)}</div>
        {e.creatorName && <div style={{ fontSize: 11, color: 'var(--light)', marginTop: 4 }}>By {e.creatorName}</div>}
      </div>
      <IconButton small title="Print / Save as PDF" onClick={(ev) => { ev.stopPropagation(); onPrint(); }}><FileText size={18} /></IconButton>
      {menu && <ActionMenu icon={<MoreVertical size={20} />} items={menu} />}
    </div>
  );
}

export function SideCalendar({ c }: { c: EventsController }) {
  const s = c.state;
  const month = CalendarMonth.of(s.month);
  const byDay = useMemo(() => c.byDay, [c, s.events]);
  return (
    <div className="ev-cal">
      <div className="row between" style={{ padding: '12px 8px' }}>
        <IconButton small title="Previous month" onClick={() => c.setMonth(new Date(month.prev().year, month.prev().month, 1))}><ChevronLeft size={20} /></IconButton>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
          <div>{month.title.split(' ')[0]}</div><div>{month.year}</div>
        </div>
        <IconButton small title="Next month" onClick={() => c.setMonth(new Date(month.next().year, month.next().month, 1))}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="cal-grid" style={{ padding: '0 8px 8px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-dow" style={{ color: 'var(--muted)' }}>{d}</div>)}
        {month.cells().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const evs = byDay.get(cell.key) ?? [];
          const deped = c.depedOn(cell.key).length > 0;
          const sel = s.selectedDay === cell.key;
          return (
            <Tooltip key={cell.key} text={c.dayTooltip(cell.key)}>
            <button className="ev-day"
              style={{ background: sel ? '#1e2126' : cell.isToday ? 'var(--border-strong)' : 'transparent', color: sel || cell.isToday ? '#fff' : 'var(--text)', fontWeight: sel || cell.isToday ? 600 : 400 }}
              onClick={() => c.selectDay(cell.key)}>
              {cell.day}
              {(evs.length > 0 || deped) && (
                <span className="ev-dots">
                  {evs.length > 0 && <span className="ev-dot" />}
                  {deped && <span className="ev-dot" style={{ background: 'var(--deped)' }} />}
                </span>
              )}
            </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
