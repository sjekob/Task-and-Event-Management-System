import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../../ui/Tooltip';
import { DashboardController } from '@shared/controllers/DashboardController';
import { IconButton } from '../../ui/kit';
import { DateTile } from './DashboardParts';

// Month calendar (event, deadline and DepEd memo dots) and upcoming events.
export function CalendarCard({ c }: { c: DashboardController }) {
  const navigate = useNavigate();
  const s = c.state;
  const upcoming = c.upcoming();
  return (
    <div className="dash-card" style={{ padding: '14px 16px 16px' }}>
      <div className="row">
        <div className="grow" style={{ fontSize: 15, fontWeight: 700 }}>{s.month.title}</div>
        <IconButton small title="Previous month" onClick={() => c.prevMonth()}><ChevronLeft size={20} /></IconButton>
        <IconButton small title="Next month" onClick={() => c.nextMonth()}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="cal-grid mt-8">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <div key={i} className="cal-dow" style={{ color: 'var(--light)' }}>{x}</div>)}
        {s.month.cells().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const evs = c.eventsOn(cell.key);
          const deped = c.depedOn(cell.key).length > 0;
          const deadline = c.hasDeadline(cell.key);
          const tip = c.dayTooltip(cell.key);
          return (
            <Tooltip key={cell.key} text={tip}>
            <div className={`cal-day ${cell.isToday ? 'today' : ''}`} style={{ cursor: tip ? 'help' : 'default' }}>
              <span>{cell.day}</span>
              <span className="cal-dots">
                {evs.length > 0 && <span className="cal-dot" style={{ background: 'var(--accent)' }} />}
                {deadline && <span className="cal-dot" style={{ background: 'var(--amber)' }} />}
                {deped && <span className="cal-dot" style={{ background: 'var(--deped)' }} />}
              </span>
            </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="row gap-16 mt-8 caption">
        <span className="row gap-6"><span className="cal-dot" style={{ background: 'var(--accent)' }} />Event</span>
        <span className="row gap-6"><span className="cal-dot" style={{ background: 'var(--amber)' }} />Task deadline</span>
        <span className="row gap-6"><span className="cal-dot" style={{ background: 'var(--deped)' }} />DepEd memo</span>
      </div>
      <hr className="divider" style={{ margin: '14px 0' }} />
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Upcoming events</div>
      {upcoming.length === 0 ? <div className="body-sm">No upcoming events</div> : upcoming.map(({ date, event }) => (
        <button key={`${event.id}-${date.getTime()}`} className="dash-upcoming" onClick={() => navigate(DashboardController.eventPath(event))}>
          <DateTile date={date} compact />
          <div className="grow" style={{ textAlign: 'left' }}>
            <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{event.title || 'Event'}</div>
            {event.venue?.trim() && <div className="caption ellipsis">{event.venue}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}
