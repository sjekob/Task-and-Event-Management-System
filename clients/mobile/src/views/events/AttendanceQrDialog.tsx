import { useEffect } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AttendanceQrController } from '@shared/controllers/AttendanceQrController';
import { useServices } from '../../core/AppModel';
import { webOrigin } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Button, C, Empty, Icon, Loading, Modal, Row, T } from '../../ui/kit';

/**
 * One attendance QR per activity: Time In, then (after it ends) the evaluation as Time Out. Attendees scan them with the app's
 * scanner (or any camera, which opens the web scan page).
 */
export function AttendanceQrDialog({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new AttendanceQrController(services, eventId, webOrigin()), [eventId]);
  useEffect(() => { void c.load(); }, [c]);
  return (
    <Modal title="Attendance QR Codes" subtitle={s.data?.title} icon="grid" onClose={onClose} footer={<Button variant="ghost" onPress={onClose}>Close</Button>}>
      {s.loading ? <Loading /> : s.error ? <T color={C.red} center>{s.error}</T>
        : !s.data?.activities.length ? <Empty icon="grid" title="This event has no Activity Matrix rows." /> : (
          <>
            <T size={12.5} color={C.muted}>{AttendanceQrController.HOW}</T>
            {s.data.activities.map((a) => (
              <View key={a.index} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, gap: 8 }}>
                <T size={15} weight={700}>{AttendanceQrController.title(a)}</T>
                <T size={12} color={C.muted}>{AttendanceQrController.when(a) || 'No schedule'}</T>
                <Row wrap gap={18} style={{ justifyContent: 'center', marginTop: 6 }}>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <QRCode value={c.link(a)} size={180} />
                    <T weight={700}>{AttendanceQrController.LABEL}</T>
                  </View>
                </Row>
                {!a.schedule_readable && (
                  <Row gap={6} style={{ alignItems: 'flex-start' }}>
                    <Icon name="alert-triangle" size={14} color={C.amberDark} />
                    <T size={12} color={C.amberDark} style={{ flex: 1 }}>The day/time of this row can't be read, so scans will be refused. Fix it in the Activity Matrix (e.g. "7:00-8:00 AM").</T>
                  </Row>
                )}
              </View>
            ))}
          </>
        )}
    </Modal>
  );
}
