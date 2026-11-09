import { ApiClient } from './ApiClient';
import { AppNotification, Json } from '../models';

export class NotificationService {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<AppNotification[]> {
    const rows = await this.api.get<Json[]>('/api/notifications', { fallback: 'Failed to load notifications' });
    return rows.map(AppNotification.fromJson);
  }

  async unreadCount(): Promise<number> {
    try {
      return Number((await this.api.get('/api/notifications/unread-count'))?.count ?? 0);
    } catch {
      return 0;
    }
  }

  async markRead(id: number) { await this.api.post(`/api/notifications/${id}/read`, { background: true }).catch(() => undefined); }
  async markAllRead() { await this.api.post('/api/notifications/read-all', { background: true }).catch(() => undefined); }
  async remove(id: number) { await this.api.delete(`/api/notifications/${id}`).catch(() => undefined); }
}
