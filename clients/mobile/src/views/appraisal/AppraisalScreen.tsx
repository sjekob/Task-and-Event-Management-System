import { ReactNode, useEffect } from 'react';
import { APPRAISAL_TAB_LABELS, AppraisalController } from '@shared/controllers/AppraisalControllers';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Banner, Screen, Tabs } from '../../ui/kit';
import { SchoolYearPicker } from '../common/SchoolYearPicker';
import { AnalyticsTab } from './AnalyticsTab';
import { EventsTab } from './EventsTab';
import { SpecialTab } from './SpecialTab';
import { TimingTab } from './TimingTab';

/** /appraisal: timing points, special-task ratings, event evaluations and analytics. */
export default function AppraisalScreen() {
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
    <Screen onRefresh={() => c.load()}>
      <Banner title="Performance Appraisal" subtitle="Evaluate special tasks and events · Track faculty performance" />
      <Tabs value={s.tab} onChange={(t) => c.setTab(t)}
        tabs={c.tabs.map((t) => ({ value: t, label: APPRAISAL_TAB_LABELS[t], count: c.badgeCount(t) || undefined }))} />
      <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} includeTerms />
      {body}
    </Screen>
  );
}
