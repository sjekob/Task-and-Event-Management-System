import { BaseController } from './BaseController';
import { Services } from '../services';
import { AppNotification } from '../models';

export interface NotificationState {
  unread: number;
  items: AppNotification[];
  loading: boolean;
}

/** Unread badge (polled every 30 s) and the notification panel. */
export class NotificationController extends BaseController<NotificationState> {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly services: Services) {
    super({ unread: 0, items: [], loading: false });
  }

  start(intervalMs = 30_000) {
    this.stop();
    void this.refreshCount();
    this.timer = setInterval(() => void this.refreshCount(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refreshCount() {
    const unread = await this.services.notifications.unreadCount();
    this.setState({ unread });
  }

  /** Opening the panel marks everything read and loads the list. */
  async open() {
    this.setState({ loading: true, unread: 0 });
    await this.services.notifications.markAllRead();
    try {
      this.setState({ items: await this.services.notifications.list(), loading: false });
    } catch {
      this.setState({ loading: false });
    }
  }

  async remove(id: number) {
    await this.services.notifications.remove(id);
    this.setState((s) => ({ items: s.items.filter((n) => n.id !== id) }));
  }

  override dispose() {
    this.stop();
    super.dispose();
  }
}
