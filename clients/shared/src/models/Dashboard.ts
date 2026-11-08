import { Json, JsonReader as R } from './json';
import { Task } from './Task';
import { EventItem } from './Event';

export class DashboardData {
  constructor(
    readonly pending: number,
    readonly submitted: number,
    readonly missing: number,
    readonly totalTasks: number,
    readonly taskManagerTasks: Task[],
    readonly myTasks: Task[],
    readonly events: EventItem[],
    readonly eventsTotal: number,
    /** Days (YYYY-MM-DD) with open task deadlines. */
    readonly deadlineDates: Set<string>,
  ) {}

  static fromJson(j: Json): DashboardData {
    return new DashboardData(
      R.num(j.pending),
      R.num(j.submitted),
      R.num(j.missing),
      R.num(j.total_tasks),
      R.list(j.task_manager_tasks, Task.fromJson),
      R.list(j.my_tasks, Task.fromJson),
      R.list(j.events, EventItem.fromJson),
      R.num(j.events_total),
      new Set(R.strList(j.deadline_dates).map((d) => d.slice(0, 10))),
    );
  }
}
