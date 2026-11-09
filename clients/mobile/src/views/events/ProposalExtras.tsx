import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Location from 'expo-location';
import { EventDetailController, ProposalFormController } from '@shared/controllers/EventControllers';
import { formatDistance } from '@shared/utils/geo';
import { useFeedback } from '../../ui/feedback';
import { pickFiles } from '../../ui/files';
import { Button, C, Card, Icon, Input, Row, Spinner, T } from '../../ui/kit';

const PROPOSAL_TYPES = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'image/*'];
const PRESETS = [50, 100, 200, 500];

/**
 * The venue pin for attendance (geofence): on a phone, pinned where you stand
 * at the venue. Scans are then accepted only within the radius. (On a computer
 * the pin can be placed on a map.)
 */
export function VenuePinCard({ c }: { c: ProposalFormController }) {
  const fb = useFeedback();
  const [locating, setLocating] = useState(false);
  const d = c.state.d;
  const pin = d.venuePin;
  const here = async () => {
    setLocating(true);
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') { fb.toast('Location permission was denied.', 'error'); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      c.setVenuePin({ lat: p.coords.latitude, lng: p.coords.longitude });
    } catch { fb.toast('Your location could not be found. Turn on Location/GPS and try again.', 'error'); } finally { setLocating(false); }
  };
  return (
    <Card style={{ gap: 8 }}>
      <Row gap={8}><Icon name="map" size={18} color={pin ? '#A11A33' : C.muted} /><T weight={700} style={{ flex: 1 }}>Venue location for attendance</T></Row>
      <T size={12.5} color={C.muted}>
        {pin ? `Pinned · Time In / Time Out accepted within ${formatDistance(d.venueRadius)} of ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.`
          : 'Not pinned · attendance is checked by time only. Stand at the venue and pin it to require attendees to be there.'}
      </T>
      <Row wrap gap={8}>
        <Button size="sm" variant={pin ? 'outline-muted' : 'dark'} icon="crosshair" loading={locating} onPress={() => void here()}>{pin ? 'Re-pin here' : 'Pin where I am'}</Button>
        {pin && <Button size="sm" variant="ghost" icon="map" onPress={() => void Linking.openURL(EventDetailController.mapLink(pin.lat, pin.lng))}>View map</Button>}
        {pin && <Button size="sm" variant="ghost-danger" icon="trash-2" onPress={() => c.setVenuePin(null)}>Remove pin</Button>}
      </Row>
      {pin && (
        <Row wrap gap={8}>
          <T size={12.5} weight={600}>Radius (m)</T>
          <View style={{ width: 90 }}><Input keyboardType="number-pad" value={String(d.venueRadius)} onChangeText={(v) => c.setVenueRadius(Number(v.replace(/\D/g, '')))} /></View>
          {PRESETS.map((v) => <Button key={v} size="sm" variant={d.venueRadius === v ? 'dark' : 'outline-muted'} onPress={() => c.setVenueRadius(v)}>{`${v}`}</Button>)}
        </Row>
      )}
    </Card>
  );
}

/** "Upload your event proposal": the first screen of a new proposal on the phone too. */
export function ProposalUploadCard({ c }: { c: ProposalFormController }) {
  const fb = useFeedback();
  const busy = c.state.reading;
  const choose = async () => {
    const files = await pickFiles(PROPOSAL_TYPES);
    if (!files.length) return;
    const r = await c.readFiles(files);
    if (typeof r === 'string') { fb.toast(r, 'error'); return; }
    if (c.isDirty && !(await fb.confirm({ title: 'Replace what you entered?', confirmLabel: 'Replace', cancelLabel: 'Keep my entries',
      message: `The proposal fields will be filled from ${r.files.length > 1 ? 'the photos' : r.files[0]}, replacing what is in the form now.` }))) return;
    c.applyReading(r);
  };
  return (
    <Card style={{ alignItems: 'center', gap: 10, padding: 22 }}>
      {busy ? (
        <>
          <Spinner />
          <T weight={600} center>{busy}</T>
          <T size={12} color={C.muted} center>Photos and scans take longer: each page is read with OCR.</T>
        </>
      ) : (
        <>
          <Icon name="upload" size={34} color="#A11A33" />
          <T size={17} weight={700} center>Upload your event proposal</T>
          <T size={13} color={C.muted} center>TaskNet reads the title, date, venue, schedule, budget and working committee from the file and fills in the proposal for you to check.</T>
          <Button icon="file-text" onPress={() => void choose()}>Choose file</Button>
          <T size={12} color={C.muted} center>Word (.docx) or PDF works best. For a printed copy, choose a photo of every page.</T>
          <Button variant="ghost" size="sm" onPress={() => c.showUpload(false)}>No file? Fill in the proposal by hand</Button>
        </>
      )}
    </Card>
  );
}

/** What was read from the file, and what still needs checking. */
export function ReadingCard({ c }: { c: ProposalFormController }) {
  const r = c.readingSummary;
  if (!r) return null;
  return (
    <Card style={{ gap: 6 }}>
      <Row gap={8}><Icon name="file-text" size={18} color={C.green} /><T weight={700} style={{ flex: 1 }} lines={1}>{r.fileLabel}</T></Row>
      <T size={12.5} color={C.muted}>Filled in from this {r.methodLabel} · {r.found} of {r.total} sections found</T>
      {r.missing.length > 0 && <T size={13}>Not in the file: {r.missing.map((x) => x.label).join(', ')}. Fill them in by hand.</T>}
      {r.toCheck.map((w) => <T key={w.text} size={13} color="#b45309">• {w.text}</T>)}
      {r.members.total > 0 && (
        <T size={12.5} color={C.muted}>Committee: {r.members.automated} to automate · {r.members.credited} top score{r.members.uncredited ? ` · ${r.members.uncredited} need a linked account` : ''}. Choose in the Budget step.</T>
      )}
      <Button size="sm" variant="outline-muted" icon="upload" style={{ alignSelf: 'flex-start' }} onPress={() => c.showUpload(true)}>Upload another</Button>
    </Card>
  );
}
