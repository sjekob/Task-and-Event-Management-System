import { BaseController } from './BaseController';
import { Services } from '../services';
import { EventItem, SchoolYearFilter } from '../models';

export interface ActivityState {
  events: EventItem[];
  loading: boolean;
  error: string | null;
  filter: SchoolYearFilter;
  open: EventItem | null;
}

/** Activity Calendar: every scheduled event, read-only. */
export class ActivityController extends BaseController<ActivityState> {
  constructor(private readonly services: Services) {
    super({ events: [], loading: true, error: null, filter: SchoolYearFilter.current, open: null });
  }

  async load() {
    this.setState({ loading: true, error: null });
    try {
      const sy = this.state.filter.schoolYear;
      this.setState({ events: await this.services.events.list(sy === 'current' ? null : sy), loading: false });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Failed to load events') });
    }
  }

  setFilter(filter: SchoolYearFilter) {
    this.setState({ filter });
    void this.load();
  }

  open(e: EventItem | null) { this.setState({ open: e }); }

  get heading() { return this.state.filter.equals(SchoolYearFilter.current) ? 'Upcoming Events' : 'Events'; }

  static statusLabel(status: string): string {
    switch (status) {
      case 'approved': return 'Approved';
      case 'disabled': return 'Disabled';
      case 'pending_approval': return 'Pending Approval';
      default: return status || 'Unknown';
    }
  }

  static statusTone(status: string): 'green' | 'gray' | 'amber' {
    return status === 'approved' ? 'green' : status === 'disabled' ? 'gray' : 'amber';
  }
}
