import { ReactNode, useEffect, useState } from 'react';
import {
  AlertCircle, Award, BookOpen, Briefcase, Camera, CheckCircle2, Contact, Crop, GraduationCap, IdCard, Brain, Trash2, Upload, Users,
} from 'lucide-react';
import { PhotoCrop, ProfileController } from '@shared/controllers/ProfileControllers';
import { useApp } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { CertificatesPanel } from '../../ui/CertificatesPanel';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Avatar, Bone, Button, Spinner, pickFiles } from '../../ui/kit';
import { PhotoPositionDialog } from '../../ui/PhotoPositionDialog';
import './profile.css';
import { EditProfileDialog, SectionHeader } from './EditProfileDialog';

const SECTION_ICON: Record<string, ReactNode> = {
  basic: <IdCard size={16} />, contact: <Contact size={16} />, personal: <Users size={16} />, employment: <Briefcase size={16} />,
  education: <GraduationCap size={16} />,
};

export default function ProfileView() {
  const app = useApp();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ProfileController(app.services, app.session), []);
  const [editing, setEditing] = useState(false);
  const [positionSrc, setPositionSrc] = useState<string | null>(null);
  useEffect(() => { void c.load(); }, [c]);

  if (s.loading) return <div className="col gap-16"><Bone h={136} r={14} /><Bone h={500} r={14} /></div>;
  if (s.error || !s.profile) {
    return (
      <div className="empty">
        <AlertCircle size={40} color="var(--red)" />
        <div>{s.error}</div>
        <Button onClick={() => void c.load()}>Retry</Button>
      </div>
    );
  }
  const p = s.profile;

  const position = async () => {
    const src = await c.photoSource();
    if (!src) { fb.toast('Upload the photo again to adjust its position.'); return; }
    setPositionSrc(src);
  };
  const upload = async () => {
    const [f] = await pickFiles('.jpg,.jpeg,.png,.webp');
    if (!f) return;
    try {
      await c.uploadPhoto({ name: f.name, type: f.type, blob: f });
      fb.toast('Profile photo updated.');
      await position(); // straight away let them choose which part shows
    } catch (e) { fb.error(e); }
  };
  const remove = async () => {
    try { await c.removePhoto(); fb.toast('Profile photo removed.'); } catch (e) { fb.error(e); }
  };
  const savePosition = async (crop: PhotoCrop | null) => {
    setPositionSrc(null);
    if (!crop) return;
    try { await c.setPhotoPosition(crop); fb.toast('Photo position saved.'); } catch (e) { fb.error(e); }
  };

  return (
    <div className="col gap-16" style={{ paddingBottom: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0' }}>{p.roleLabel}</h1>
      <div className="pf-card row gap-16">
        <div style={{ position: 'relative' }}>
          <Avatar url={p.avatarUrl} initials={p.initials} size={80} />
          {s.photoBusy && <div className="pf-busy"><Spinner light /></div>}
          <div className="pf-cam-wrap" style={{ position: 'absolute', right: -4, bottom: -4 }}>
            <ActionMenu align="left" icon={<span className="pf-cam"><Camera size={15} /></span>} items={[
              { label: 'Upload photo', icon: <Upload size={16} />, onClick: () => void upload() },
              { label: 'Adjust position', icon: <Crop size={16} />, onClick: () => void position(), hidden: !p.avatarUrl },
              { label: 'Remove photo', icon: <Trash2 size={16} />, onClick: () => void remove(), hidden: !p.avatarUrl },
            ]} />
          </div>
        </div>
        <div className="grow">
          <div style={{ fontSize: 18, fontWeight: 700 }} className="clamp-2">{p.fullName}</div>
          <div className="body-md">{p.roleLabel}</div>
        </div>
      </div>

      <div className="pf-card">
        <div className="row">
          <span className="grow" style={{ fontSize: 15, fontWeight: 700 }}>Personal Information</span>
          <Button variant="outline-muted" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        </div>
        {ProfileController.sections(p).map((sec) => (
          <div key={sec.key}>
            <SectionHeader icon={SECTION_ICON[sec.key]} title={sec.title} />
            <div className="pf-info-grid">
              {sec.fields.map((f) => (
                <div key={f.label} style={{ gridColumn: f.span ? `span ${f.span}` : undefined }}>
                  <div className="pf-label">{f.label}</div>
                  <div className="pf-value">{f.value?.trim() ? f.value : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <SectionHeader icon={<Award size={16} />} title="Certifications & Eligibility" />
        <CertificatesPanel canUpload onChanged={() => void c.refresh()} />
        <SectionHeader icon={<Brain size={16} />} title="Skills" />
        {p.skills.length === 0 ? <div className="body-md">None added yet</div> : (
          <div className="row wrap gap-10" style={{ gap: 10 }}>
            {p.skills.map((sk) => <span key={sk} className="pf-skill"><CheckCircle2 size={16} color="var(--accent-dark)" />{sk}</span>)}
          </div>
        )}
      </div>

      {p.subjects.length > 0 && (
        <div className="pf-card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Subject-grade Assignments</div>
          <div className="row wrap gap-12">
            {p.subjects.map((sj, i) => (
              <div key={i} className="pf-subject">
                <span className="att-icon" style={{ width: 34, height: 34, background: 'var(--tint)', color: 'var(--dark)' }}><BookOpen size={18} /></span>
                <div className="grow">
                  <div className="ellipsis" style={{ fontSize: 14.5, fontWeight: 700 }}>{sj.subject}</div>
                  {sj.gradeLevel && <div className="body-sm">{sj.gradeLevel}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <EditProfileDialog profile={p} onClose={(saved) => { setEditing(false); if (saved) { void c.load(); fb.toast('Profile updated.'); } }} />}
      {positionSrc && <PhotoPositionDialog sourceUrl={positionSrc} onClose={(crop) => void savePosition(crop)} />}
    </div>
  );
}
