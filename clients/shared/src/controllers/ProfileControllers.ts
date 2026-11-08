import { BaseController } from './BaseController';
import { SessionController } from './SessionController';
import { Services, FilePart } from '../services';
import { User } from '../models';
import { Format } from '../utils/format';
import { PhotoCrop } from './PhotoPositioner';

/** The signed-in person's own profile, including their photo. */
export class ProfileController extends BaseController<{ profile: User | null; loading: boolean; error: string | null; photoBusy: boolean }> {
  constructor(private readonly services: Services, private readonly session: SessionController) {
    super({ profile: null, loading: true, error: null, photoBusy: false });
  }

  async load() {
    try {
      this.setState({ profile: await this.services.personnel.myProfile(), loading: false, error: null });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Failed to load profile') });
    }
  }

  /** After a change: reload the profile and the session user (top bar / sidebar). */
  async refresh() {
    await this.load();
    await this.session.refreshUser();
  }

  private async photo(action: () => Promise<unknown>): Promise<void> {
    this.setState({ photoBusy: true });
    try {
      await action();
      await this.refresh();
    } finally {
      this.setState({ photoBusy: false });
    }
  }

  uploadPhoto(file: FilePart) { return this.photo(() => this.services.personnel.uploadAvatar(file)); }
  removePhoto() { return this.photo(() => this.services.personnel.removeAvatar()); }
  setPhotoPosition(crop: PhotoCrop) { return this.photo(() => this.services.personnel.setAvatarPosition(crop.left, crop.top, crop.size)); }

  /** Absolute URL of the kept full photo, or null when there is none. */
  async photoSource(): Promise<string | null> {
    try {
      return this.services.api.mediaUrl(await this.services.personnel.avatarSource());
    } catch {
      return null;
    }
  }

  static longDate(iso: string | null): string | null {
    return iso ? Format.longDate(iso, iso) : null;
  }

  /** Read-only sections of the profile card. */
  static sections(p: User): { key: string; title: string; fields: { label: string; value: string | null; span?: number }[] }[] {
    const ld = ProfileController.longDate;
    return [
      { key: 'basic', title: 'Basic Information', fields: [
        { label: 'First Name', value: p.firstName }, { label: 'Middle Name', value: p.middleName },
        { label: 'Last Name', value: p.lastName }, { label: 'Suffix', value: p.suffix },
      ] },
      { key: 'contact', title: 'Contact Information', fields: [
        { label: 'Email Address', value: p.email }, { label: 'Phone Number', value: p.phoneNumber }, { label: 'Address', value: p.address, span: 2 },
      ] },
      { key: 'personal', title: 'Personal Details', fields: [
        { label: 'Birthdate', value: ld(p.birthdate) },
      ] },
      { key: 'employment', title: 'Employment', fields: [
        { label: 'Administrative Role', value: p.roleLabel }, { label: 'Date of Appointment', value: ld(p.dateOfAppointment) },
      ] },
      { key: 'education', title: 'Educational Background', fields: [
        { label: 'Highest Educational Attainment', value: p.education.highestAttainment, span: 2 },
        { label: 'Undergraduate Degree', value: p.education.undergraduateDegree, span: 2 },
        { label: 'Area of Specialization', value: p.education.specialization, span: 2 },
        { label: 'Postgraduate Program Focus', value: p.education.postgraduateFocus, span: 2 },
      ] },
    ];
  }
}

export * from './EditProfileController';
export * from './PhotoPositioner';
