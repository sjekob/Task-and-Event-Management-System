import { CalendarRange, FileSearch } from 'lucide-react';
import { TaskScanController } from '@shared/controllers/TaskScanController';
import { useControllerState } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Modal, pickFiles } from '../../ui/kit';

const ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,image/*,application/pdf,text/plain';

/**
 * "Scan a file": fills the form from a PDF, Word file, text file or photo. A
 * schedule (several dated rows) opens a picker; for templates each chosen row
 * becomes its own template, and [onTemplatesMade] runs afterwards.
 */
export function ScanFileButton({ scan, onTemplatesMade }: { scan: TaskScanController; onTemplatesMade: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(scan);

  const pick = async () => {
    const [file] = await pickFiles(ACCEPT);
    if (!file) return;
    const r = await scan.scan({ name: file.name, type: file.type, blob: file });
    if (r) fb.toast(r.message, r.error ? 'error' : 'success');
  };

  const apply = async () => {
    const r = await scan.apply();
    fb.toast(r.message, r.error ? 'error' : 'success');
    if (r.templatesMade > 0) onTemplatesMade();
  };

  return (
    <>
      <Button variant="outline" icon={<FileSearch size={16} />} loading={s.scanning} onClick={() => void pick()}>
        {s.scanning ? 'Reading file…' : 'Scan a file'}
      </Button>
      {s.items && <ScheduleDialog scan={scan} onApply={() => void apply()} />}
    </>
  );
}

function ScheduleDialog({ scan, onApply }: { scan: TaskScanController; onApply: () => void }) {
  const s = useControllerState(scan);
  const items = s.items ?? [];
  const multiple = scan.isTemplateForm;
  const all = s.checked.size === items.length;
  return (
    <Modal title="Schedule found" subtitle={`${items.length} dated items in ${s.fileName}`} icon={<CalendarRange size={20} />} size="wide"
      onClose={() => scan.close()}
      footer={<>
        <Button variant="ghost" onClick={() => scan.close()}>Cancel</Button>
        <Button disabled={s.checked.size === 0} onClick={onApply}>
          {multiple ? `Create ${s.checked.size} template${s.checked.size === 1 ? '' : 's'}` : 'Fill the form'}
        </Button>
      </>}>
      <div className="caption mb-12">
        {multiple ? 'Each ticked row becomes its own template, dated from the file.' : 'Pick the row this task is for; it fills the title and dates.'}
      </div>
      {multiple && (
        <label className="check mb-8" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={all} onChange={() => scan.toggleAll()} />Select all
        </label>
      )}
      <div className="col" style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 380, overflowY: 'auto' }}>
        {items.map((item, i) => (
          <label key={i} className="row gap-12" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <input type={multiple ? 'checkbox' : 'radio'} name="scan-row" checked={s.checked.has(i)} onChange={() => scan.toggle(i)} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title}</div>
              <div className="caption" style={{ color: 'var(--accent)' }}>{TaskScanController.dates(item)}</div>
            </div>
          </label>
        ))}
      </div>
    </Modal>
  );
}
