import { BaseController } from './BaseController';
import { Services } from '../services';
import { TaskTemplate } from '../models';

/** Template list for "Use template". */
export class TemplatePickerController extends BaseController<{ templates: TaskTemplate[]; loading: boolean }> {
  constructor(private readonly services: Services) {
    super({ templates: [], loading: true });
    void this.load();
  }

  async load() {
    this.setState({ templates: await this.services.tasks.templates(), loading: false });
  }
}
