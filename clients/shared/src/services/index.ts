import { ApiClient, TokenStore } from './ApiClient';
import { AuthService } from './AuthService';
import { TaskService } from './TaskService';
import { PersonnelService } from './PersonnelService';
import {
  AppraisalService, AuditService, CertificateService, DashboardService, DepedCalendarService, EventService, NotificationService, SchoolYearService,
} from './DomainServices';

export * from './ApiClient';
export * from './AuthService';
export * from './TaskService';
export * from './PersonnelService';
export * from './DomainServices';

/** Every service, sharing one ApiClient. Created once per app by the platform entry point. */
export class Services {
  readonly api: ApiClient;
  readonly auth: AuthService;
  readonly tasks: TaskService;
  readonly personnel: PersonnelService;
  readonly dashboard: DashboardService;
  readonly certificates: CertificateService;
  readonly audit: AuditService;
  readonly appraisal: AppraisalService;
  readonly schoolYears: SchoolYearService;
  readonly events: EventService;
  readonly deped: DepedCalendarService;
  readonly notifications: NotificationService;

  constructor(baseUrl: string, tokenStore: TokenStore) {
    this.api = new ApiClient(baseUrl.replace(/\/+$/, ''), tokenStore);
    this.auth = new AuthService(this.api);
    this.tasks = new TaskService(this.api);
    this.personnel = new PersonnelService(this.api);
    this.dashboard = new DashboardService(this.api);
    this.certificates = new CertificateService(this.api);
    this.audit = new AuditService(this.api);
    this.appraisal = new AppraisalService(this.api);
    this.schoolYears = new SchoolYearService(this.api);
    this.events = new EventService(this.api);
    this.deped = new DepedCalendarService(this.api);
    this.notifications = new NotificationService(this.api);
  }
}
