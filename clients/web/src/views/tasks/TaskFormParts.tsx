import { ReactNode } from 'react';
import { ChevronRight, FileText, HardDrive, Library, Link2, PlayCircle } from 'lucide-react';
import { TemplatePickerController } from '@shared/controllers/TaskFormController';
import { TaskTemplate } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Loading, Modal } from '../../ui/kit';

// Section cards, date/time fields and the template picker of the task form.
export const ATT_ICON: Record<string, ReactNode> = {
  link: <Link2 size={16} />, file: <FileText size={16} />, gdrive: <HardDrive size={16} />, youtube: <PlayCircle size={16} />,
};

export function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="sec-card">
      <div className="sec-head"><span className="sec-icon">{icon}</span><span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span></div>
      {children}
    </div>
  );
}

/** A date/time field: shows the friendly value; the native picker is the input underneath. */
export function PickerField({ icon, label, set, display, children }: { icon: ReactNode; label: string; set: boolean; display: string | null; children: ReactNode }) {
  return (
    <label className="picker-field">
      <span style={{ color: set ? 'var(--accent)' : 'var(--light)', display: 'flex' }}>{icon}</span>
      <span className="grow">
        <span style={{ fontSize: 11, color: 'var(--light)', fontWeight: 500, display: 'block' }}>
          {label}{display ? ` · ${display}` : ''}
        </span>
        {children}
      </span>
      <ChevronRight size={18} color="var(--light)" />
    </label>
  );
}

export function TemplatePicker({ onClose, onPick }: { onClose: () => void; onPick: (t: TaskTemplate) => void }) {
  const services = useServices();
  const [, s] = useScreenController(() => new TemplatePickerController(services), []);
  return (
    <Modal title="Use a Template" onClose={onClose} icon={<Library size={20} color="var(--accent)" style={{ marginTop: 2 }} />}>
      {s.loading ? <Loading /> : s.templates.length === 0 ? <div className="empty">No templates yet.</div> : (
        <div>
          {s.templates.map((t) => (
            <button key={t.id} className="row-btn" onClick={() => onPick(t)}>
              <span className="att-icon" style={{ background: 'var(--blue-bg)', color: 'var(--accent)', width: 38, height: 38, borderRadius: 10 }}><FileText size={18} /></span>
              <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                <span className="label" style={{ display: 'block' }}>{t.title}</span>
                {t.instructions && <span className="body-sm ellipsis" style={{ display: 'block' }}>{t.instructions.replace(/\n/g, ' ')}</span>}
                {t.createdByName && <span style={{ fontSize: 10, color: 'var(--muted)' }}>By {t.createdByName}</span>}
              </span>
              <ChevronRight size={16} color="var(--muted)" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
