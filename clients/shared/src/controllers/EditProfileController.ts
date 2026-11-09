import { BaseController } from './BaseController';
import { SessionController } from './SessionController';
import { Services, CatalogEntry } from '../services';
import { Education, User } from '../models';
import { Format } from '../utils/format';

export type ProfileTextField =
  | 'first_name' | 'middle_name' | 'last_name' | 'suffix' | 'email' | 'phone_number' | 'birthdate'
  | 'date_of_appointment' | 'address' | 'postgraduate_focus';

export type EduKey = 'highest_attainment' | 'undergraduate_degree' | 'specialization';

export interface EditProfileState {
  fields: Record<ProfileTextField, string>;
  edu: Record<EduKey, string | null>;
  eduOptions: Record<string, string[]>;
  skills: string[];
  skillOptions: CatalogEntry[];
  saving: boolean;
  error: string | null;
}

/** Edit Profile: personal info is edited only by its owner. */
export class EditProfileController extends BaseController<EditProfileState> {
  static readonly NAME_KEYS: ProfileTextField[] = ['first_name', 'middle_name', 'last_name', 'suffix'];
  static readonly DATE_KEYS: ProfileTextField[] = ['birthdate', 'date_of_appointment'];
  /** Must be filled in on the first-sign-in form (matches the server's list). */
  static readonly REQUIRED_KEYS: ProfileTextField[] = ['first_name', 'last_name', 'phone_number', 'birthdate', 'address'];
  static readonly LABELS: Partial<Record<ProfileTextField, string>> = {
    first_name: 'First name', last_name: 'Last name', phone_number: 'Phone number', birthdate: 'Birthdate', address: 'Address',
  };

  /** True on the first-sign-in form: the required details can't be left blank. */
  requireBasics = false;

  constructor(private readonly services: Services, private readonly session: SessionController, p: User) {
    super({
      fields: {
        first_name: p.firstName ?? '', middle_name: p.middleName ?? '', last_name: p.lastName ?? '', suffix: p.suffix ?? '',
        email: p.email ?? '', phone_number: p.phoneNumber ?? '', birthdate: p.birthdate ?? '',
        date_of_appointment: p.dateOfAppointment ?? '',
        address: p.address ?? '', postgraduate_focus: p.education.postgraduateFocus ?? '',
      },
      edu: {
        highest_attainment: p.education.highestAttainment,
        undergraduate_degree: p.education.undergraduateDegree,
        specialization: p.education.specialization,
      },
      eduOptions: {},
      skills: [...p.skills], skillOptions: [], saving: false, error: null,
    });
    services.personnel.educationOptions().then((eduOptions) => this.setState({ eduOptions }));
    services.personnel.skillCatalog().then((skillOptions) => this.setState({ skillOptions }));
  }

  /** Names are title-cased as typed. */
  setField(key: ProfileTextField, value: string) {
    let v = value;
    if (EditProfileController.NAME_KEYS.includes(key)) v = Format.titleCase(v);
    this.setState((s) => ({ fields: { ...s.fields, [key]: v }, error: null }));
  }

  setEdu(key: EduKey, value: string | null) { this.setState((s) => ({ edu: { ...s.edu, [key]: value } })); }
  setSkills(skills: string[]) { this.setState({ skills }); }

  /** Postgraduate focus applies from "With Master's Units" upward (options are ordered lowest first). */
  get hasPostgrad(): boolean {
    const opts = this.state.eduOptions.highest_attainment ?? [];
    return opts.indexOf(this.state.edu.highest_attainment ?? '') >= 1;
  }

  /** Required fields still blank (only checked on the first-sign-in form). */
  get blankRequired(): ProfileTextField[] {
    return this.requireBasics ? EditProfileController.REQUIRED_KEYS.filter((k) => !this.state.fields[k].trim()) : [];
  }

  private validate(): string | null {
    const blank = this.blankRequired;
    if (blank.length) return `Please fill in: ${blank.map((k) => EditProfileController.LABELS[k]).join(', ')}.`;
    for (const k of EditProfileController.DATE_KEYS) {
      const v = this.state.fields[k].trim();
      if (!v) continue;
      if (!Format.isIsoDate(v)) return `${k === 'birthdate' ? 'Birthdate' : 'Date of appointment'} must be a valid date.`;
      if (Format.isFuture(v)) return `${k === 'birthdate' ? 'Birthdate' : 'Date of appointment'} can't be in the future.`;
    }
    return null;
  }

  async save(): Promise<boolean> {
    const invalid = this.validate();
    if (invalid) {
      this.setState({ error: invalid });
      return false;
    }
    const s = this.state;
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.fields)) {
      if (k !== 'postgraduate_focus' && v.trim()) body[k] = v.trim();
    }
    body.skills = s.skills; // always sent so entries can be cleared
    body.education = new Education(
      s.edu.highest_attainment, s.edu.undergraduate_degree, s.edu.specialization,
      this.hasPostgrad && s.fields.postgraduate_focus.trim() ? s.fields.postgraduate_focus.trim() : null,
    ).toJson();
    this.setState({ saving: true, error: null });
    try {
      await this.services.personnel.updateMyProfile(body);
      await this.session.refreshUser();
      return true;
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e, 'Failed to update profile') });
      return false;
    } finally {
      this.setState({ saving: false });
    }
  }
}
