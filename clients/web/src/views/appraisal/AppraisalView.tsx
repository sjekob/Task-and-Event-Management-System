import { ReactNode, useEffect } from 'react';
import { BarChart3, CalendarDays, ClipboardList, Timer } from 'lucide-react';
import { APPRAISAL_TAB_LABELS, AppraisalController, AppraisalTab } from '@shared/controllers/AppraisalControllers';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Banner } from '../../ui/kit';
import { SchoolYearPicker } from '../../ui/SchoolYearPicker';
import './appraisal.css';
import { AnalyticsTab } from './AnalyticsTab';
import { EventsTab } from './EventsTab';
import { SpecialTab } from './SpecialTab';
import { TimingTab } from './TimingTab';

const TAB_ICON: Record<AppraisalTab, ReactNode> = {
  timing: <Timer size={15} />, special: <ClipboardList size={15} />, events: <CalendarDays size={15} />, analytics: <BarChart3 size={15} />,
};

export default function AppraisalView() {
  const services = useServices();
  const { user } = useSession();
  const [c, s] = useScreenController(() => new AppraisalController(services, user), [user?.id]);
  useEffect(() => { c.load(); }, [c]);

  let body: ReactNode;
  switch (s.tab) {
    case 'timing': body = <TimingTab c={c} />; break;
    case 'special': body = <SpecialTab c={c} />; break;
    case 'events': body = <EventsTab c={c} />; break;
    default: body = <AnalyticsTab c={c} />;
  }

  return (
    <div className="col gap-16">
      <Banner title="Performance Appraisal" subtitle="Evaluate special tasks and events · Track faculty performance · View annual analytics" />
      <div className="row wrap between gap-12">
        <div className="row wrap gap-8">
          {c.tabs.map((t) => {
            const n = c.badgeCount(t);
            return (
              <button key={t} className={`ap-tab ${s.tab === t ? 'on' : ''}`} onClick={() => c.setTab(t)}>
                {TAB_ICON[t]}{APPRAISAL_TAB_LABELS[t]}
                {n > 0 && <span className="ap-count">{n}</span>}
              </button>
            );
          })}
        </div>
        <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} includeTerms />
      </div>
      {body}
    </div>
  );
}
