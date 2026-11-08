import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PhotoCrop, ProfileController } from '@shared/controllers/ProfileControllers';
import { useApp } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Avatar, Bone, Button, C, Card, Empty, FeatherName, Icon, IconTile, Row, Screen, Spinner, T } from '../../ui/kit';
import { pickImage } from '../../ui/files';
import { CertificatesPanel } from '../common/CertificatesPanel';
import { EditProfileDialog, SectionHeader } from './EditProfileDialog';
import { PhotoPositionDialog } from './PhotoPositionDialog';

const SECTION_ICON: Record<string, FeatherName> = { basic: 'credit-card', contact: 'phone', personal: 'users', employment: 'briefcase', education: 'book' };

/** /profile: my information, photo, certificates and skills. */
export default function ProfileScreen() {
  const app = useApp();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ProfileController(app.services, app.session), []);
  const [editing, setEditing] = useState(false);
  const [positionSrc, setPositionSrc] = useState<string | null>(null);
  useEffect(() => { void c.load(); }, [c]);

  if (s.loading) return <Screen><Bone h={120} r={14} /><Bone h={420} r={14} /></Screen>;
  if (s.error || !s.profile) {
    return <Screen><Empty icon="alert-circle" title={s.error ?? 'Could not load your profile'}><Button onPress={() => void c.load()}>Retry</Button></Empty></Screen>;
  }
  const p = s.profile;
  const position = async () => {
    const src = await c.photoSource();
    if (!src) { fb.toast('Upload the photo again to adjust its position.'); return; }
    setPositionSrc(src);
  };
  const upload = async () => {
    const f = await pickImage();
    if (!f) return;
    try { await c.uploadPhoto(f); fb.toast('Profile photo updated.', 'success'); await position(); } catch (e) { fb.error(e); }
  };
  const remove = async () => { try { await c.removePhoto(); fb.toast('Profile photo removed.'); } catch (e) { fb.error(e); } };
  const savePosition = async (crop: PhotoCrop | null) => {
    setPositionSrc(null);
    if (!crop) return;
    try { await c.setPhotoPosition(crop); fb.toast('Photo position saved.', 'success'); } catch (e) { fb.error(e); }
  };

  return (
    <Screen onRefresh={() => c.load()}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View>
          <Avatar url={p.avatarUrl} initials={p.initials} size={76} />
          {s.photoBusy && <View style={{ position: 'absolute', inset: 0, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}><Spinner color="#fff" /></View>}
          <View style={{ position: 'absolute', right: -6, bottom: -6, backgroundColor: '#fff', borderRadius: 16 }}>
            <ActionMenu icon="camera" items={[
              { label: 'Upload photo', icon: 'upload', onPress: () => void upload() },
              ...(p.avatarUrl ? [{ label: 'Adjust position', icon: 'crop' as const, onPress: () => void position() }, { label: 'Remove photo', icon: 'trash-2' as const, danger: true, onPress: () => void remove() }] : []),
            ]} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <T size={18} weight={700} lines={2}>{p.fullName}</T>
          <T size={13} color={C.muted}>{p.roleLabel}</T>
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <Row><T size={15} weight={700} style={{ flex: 1 }}>Personal Information</T><Button variant="outline-muted" size="sm" icon="edit-2" onPress={() => setEditing(true)}>Edit</Button></Row>
        {ProfileController.sections(p).map((sec) => (
          <View key={sec.key} style={{ gap: 8 }}>
            <SectionHeader icon={SECTION_ICON[sec.key] ?? 'info'} title={sec.title} />
            {sec.fields.map((f) => (
              <View key={f.label}>
                <T size={12} color={C.light}>{f.label}</T>
                <T size={14}>{f.value?.trim() ? f.value : '—'}</T>
              </View>
            ))}
          </View>
        ))}
        <SectionHeader icon="award" title="Certifications & Eligibility" />
        <CertificatesPanel canUpload onChanged={() => void c.refresh()} />
        <SectionHeader icon="cpu" title="Skills" />
        {p.skills.length === 0 ? <T size={13} color={C.muted}>None added yet</T> : (
          <Row wrap gap={8}>
            {p.skills.map((sk) => (
              <Row key={sk} gap={5} style={{ backgroundColor: '#eef2fa', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Icon name="check-circle" size={14} color="#1e3a8a" /><T size={12.5}>{sk}</T>
              </Row>
            ))}
          </Row>
        )}
      </Card>

      {p.subjects.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T size={15} weight={700}>Subject-grade Assignments</T>
          {p.subjects.map((sj, i) => (
            <Row key={i} gap={10}>
              <IconTile name="book-open" tone="gray" size={34} />
              <View style={{ flex: 1 }}><T weight={700}>{sj.subject}</T>{sj.gradeLevel ? <T size={12} color={C.muted}>{sj.gradeLevel}</T> : null}</View>
            </Row>
          ))}
        </Card>
      )}
      {editing && <EditProfileDialog profile={p} onClose={(saved) => { setEditing(false); if (saved) { void c.load(); fb.toast('Profile updated.', 'success'); } }} />}
      {positionSrc && <PhotoPositionDialog sourceUrl={positionSrc} onClose={(crop) => void savePosition(crop)} />}
    </Screen>
  );
}
