import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { ChevronDown, ChevronUp, Crosshair, Map as MapIcon, MapPin, Search, Trash2 } from 'lucide-react';
import { VENUE_RADIUS_RANGE } from '@shared/models';
import { GeocodeResult } from '@shared/services/EventService';
import { formatDistance } from '@shared/utils/geo';
import { useServices } from '../../app/AppContext';
import { useFeedback } from '../../ui/feedback';
import { Button, TextInput } from '../../ui/kit';

// Leaflet's default marker images don't survive bundling: point it at the bundled files.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

/** The map opens on Naga City when nothing is pinned yet. */
const DEFAULT_CENTER: [number, number] = [13.624, 123.185];
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PERIMETER = { color: '#2563EB', fillColor: '#3B82F6', fillOpacity: 0.15, weight: 2 };
const PRESETS = [50, 100, 200, 500];

export interface Pin { lat: number; lng: number }

/** Keeps the view on the pin and its perimeter (and the attendee, when shown). */
function FitView({ pin, radius, you }: { pin: Pin | null; radius: number; you?: Pin | null }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    const bounds = L.latLng(pin.lat, pin.lng).toBounds(radius * 2.4);
    if (you) bounds.extend([you.lat, you.lng]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
  }, [map, pin, radius, you]);
  return null;
}

function ClickToPin({ onPick }: { onPick: (p: Pin) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Read-only venue map: the pin and its attendance perimeter, plus the attendee ([you]) when given. */
export function VenueMap({ pin, radius, you, height = 260, label }: { pin: Pin; radius: number; you?: Pin | null; height?: number; label?: string }) {
  const center: [number, number] = [pin.lat, pin.lng];
  return (
    <div className="ev-map" style={{ height }}>
      <MapContainer center={center} zoom={17} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <Circle center={center} radius={radius} pathOptions={PERIMETER} />
        <Marker position={center}>{label && <Tooltip direction="top" offset={[0, -36]}>{label}</Tooltip>}</Marker>
        {you && (
          <CircleMarker center={[you.lat, you.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#F97316', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]} permanent>You</Tooltip>
          </CircleMarker>
        )}
        <FitView pin={pin} radius={radius} you={you} />
      </MapContainer>
    </div>
  );
}

/**
 * Venue pin picker for the proposal: search a place, click the map or drag the
 * marker to pin the exact spot, and set the perimeter radius attendance scans
 * are checked against. Collapsed to one line until opened.
 */
export function VenueMapPicker({ venue, pin, radius, onPin, onRadius }: {
  /** The Proposed Venue text, the default search. */
  venue: string;
  pin: Pin | null;
  radius: number;
  onPin: (pin: Pin | null) => void;
  onRadius: (radius: number) => void;
}) {
  const services = useServices();
  const fb = useFeedback();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const center = useMemo<[number, number]>(() => (pin ? [pin.lat, pin.lng] : DEFAULT_CENTER), [pin]);

  const choose = (r: GeocodeResult) => { onPin({ lat: r.latitude, lng: r.longitude }); setResults(null); };
  const search = async () => {
    const q = (query || venue).trim();
    if (q.length < 3) { fb.toast('Type at least 3 characters of the venue or address.', 'error'); return; }
    setSearching(true);
    try {
      const found = await services.events.geocode(q);
      setResults(found);
      if (found.length === 1) choose(found[0]);
    } catch (e) { fb.error(e); } finally { setSearching(false); }
  };
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { fb.toast('This browser cannot share its location.', 'error'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onPin({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      (err) => {
        setLocating(false);
        fb.toast(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Search for the venue or click it on the map instead.'
          : 'Your location could not be found. Search for the venue or click it on the map instead.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } };

  if (!open) {
    return (
      <button type="button" className="ev-venue-bar" onClick={() => setOpen(true)} aria-expanded={false}>
        <span className="ev-venue-icon" data-on={pin ? 'true' : undefined}><MapIcon size={18} /></span>
        <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>Venue location for attendance</span>
          <span className="caption ellipsis" style={{ display: 'block' }}>
            {pin ? `Pinned · scans accepted within ${formatDistance(radius)} of the venue`
              : 'Not pinned · attendance is checked by time only. Click to pin the venue on the map.'}
          </span>
        </span>
        <span className={`badge ${pin ? 'blue' : 'gray'}`}>{pin ? `${formatDistance(radius)} radius` : 'Not pinned'}</span>
        <ChevronDown size={18} color="var(--muted)" />
      </button>
    );
  }
  return (
    <div className="ev-venue-picker col gap-8">
      <div className="row-top gap-8">
        <div className="grow">
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Venue location for attendance</div>
          <div className="caption">Pin the exact spot. Time In / Time Out scans are accepted only within the perimeter. Leave it unpinned to check attendance by time only.</div>
        </div>
        {pin && <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} style={{ color: 'var(--red)' }} onClick={() => onPin(null)}>Remove pin</Button>}
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setResults(null); }}>Hide map <ChevronUp size={14} /></Button>
      </div>
      <div className="row gap-8">
        <div className="grow" style={{ position: 'relative' }}>
          <Search size={16} color="var(--light)" style={{ position: 'absolute', left: 10, top: 11 }} />
          <TextInput style={{ paddingLeft: 32 }} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
            placeholder={venue.trim() ? `Search "${venue.trim()}" or an address` : 'Search a place or address'} aria-label="Search the map" />
        </div>
        <Button loading={searching} onClick={() => void search()}>Search</Button>
        <Button variant="outline-muted" loading={locating} icon={<Crosshair size={16} />} onClick={useMyLocation}>My location</Button>
      </div>
      {results && (
        <div className="ev-venue-results">
          {results.length === 0 ? <div className="caption" style={{ padding: 8 }}>No places found. Try a shorter name or the street, or click the venue on the map.</div>
            : results.map((r) => (
              <button key={`${r.latitude},${r.longitude}`} type="button" className="ev-venue-result" onClick={() => choose(r)}>
                <MapPin size={15} style={{ flexShrink: 0, marginTop: 2 }} /><span className="clamp-2">{r.name}</span>
              </button>
            ))}
        </div>
      )}
      <div className="ev-map" style={{ height: 300 }}>
        <MapContainer center={center} zoom={pin ? 17 : 14} style={{ height: '100%', width: '100%' }}>
          <TileLayer url={TILES} attribution={ATTRIBUTION} />
          <ClickToPin onPick={onPin} />
          {pin && (
            <>
              <Circle center={[pin.lat, pin.lng]} radius={radius} pathOptions={PERIMETER} />
              <Marker position={[pin.lat, pin.lng]} draggable eventHandlers={{
                dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onPin({ lat: ll.lat, lng: ll.lng }); },
              }} />
            </>
          )}
          <FitView pin={pin} radius={radius} />
        </MapContainer>
      </div>
      {pin ? (
        <>
          <div className="row wrap gap-8">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Perimeter radius</span>
            <TextInput type="number" min={VENUE_RADIUS_RANGE.min} max={VENUE_RADIUS_RANGE.max} value={radius} style={{ width: 110 }}
              aria-label="Perimeter radius in metres" onChange={(e) => onRadius(Number(e.target.value))} />
            <span className="caption">m</span>
            {PRESETS.map((v) => (
              <button key={v} type="button" className={`chip selectable ${radius === v ? 'on' : ''}`} onClick={() => onRadius(v)}>{v} m</button>
            ))}
          </div>
          <div className="caption">
            Pinned at {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} · scans accepted within {formatDistance(radius)}. Drag the pin or click the map to move it.
            Phones indoors are often 20–50 m off, so keep the radius at least 50 m.
          </div>
        </>
      ) : <div className="caption">Search for the venue, use your location, or click the map to drop the pin.</div>}
    </div>
  );
}
