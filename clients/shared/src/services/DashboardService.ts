import { ApiClient } from './ApiClient';
import { DashboardData } from '../models';

export class DashboardService {
  constructor(private readonly api: ApiClient) {}

  async load(): Promise<DashboardData> {
    return DashboardData.fromJson(await this.api.get('/api/dashboard', { fallback: 'Failed to load dashboard' }));
  }
}
