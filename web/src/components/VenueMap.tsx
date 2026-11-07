import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  ActionIcon, Badge, Box, Button, Group, Loader, NumberInput, Paper, ScrollArea, SegmentedControl, Stack, Text, TextInput,
  ThemeIcon, UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown, IconChevronUp, IconCurrentLocation, IconMap2, IconMapPin, IconSearch, IconTrash, IconX,
} from '@tabler/icons-react';
import { api, formatDistance, VENUE_RADIUS_RANGE, type GeocodeResult } from '@tasknet/shared';
import { notifyError } from './ui';

// Leaflet's default marker images don't survive bundling: it prefixes a path it
// guesses from its CSS. Drop that guess and point at the bundled files.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

/** Map opens on Naga City when nothing is pinned yet. */
const DEFAULT_CENTER: [number, number] = [13.6240, 123.1850];
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PERIMETER = { color: '#2563EB', fillColor: '#3B82F6', fillOpacity: 0.15, weight: 2 };
const RADIUS_PRESETS = ['50', '100', '200', '500'];

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

/**
 * Read-only venue map: the pin and its attendance perimeter. With `you`, the
 * attendee's position too (blue dot), and the view fits both.
 */
export function VenueMap({ pin, radius, you, height = 260, label }: {
  pin: Pin; radius: number; you?: Pin | null; height?: number; label?: string;
}) {
  const center: LatLngExpression = [pin.lat, pin.lng];
  return (
    <Box className="tn-map" h={height}>
      <MapContainer center={center} zoom={17} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Circle center={center} radius={radius} pathOptions={PERIMETER} />
        <Marker position={center}>{label && <Tooltip direction="top" offset={[0, -36]}>{label}</Tooltip>}</Marker>
        {you && (
          <CircleMarker center={[you.lat, you.lng]} radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#F97316', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]} permanent>You</Tooltip>
          </CircleMarker>
        )}
        <FitView pin={pin} radius={radius} you={you} />
      </MapContainer>
    </Box>
  );
}

/**
 * Venue pin picker for the event proposal: search a place, click the map or
 * drag the marker to pin the exact spot, and set the perimeter radius used to
 * check attendance scans.
 */
export function VenueMapPicker({ venue, pin, radius, onChange }: {
  /** the Proposed Venue text, used as the default search */
  venue: string;
  pin: Pin | null;
  radius: number;
  onChange: (pin: Pin | null, radius: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const center = useMemo<[number, number]>(() => (pin ? [pin.lat, pin.lng] : DEFAULT_CENTER), [pin]);

  const search = async (text = query || venue) => {
    const q = text.trim();
    if (q.length < 3) { notifyError(new Error('Type at least 3 characters of the venue or address.')); return; }
    setSearching(true);
    try {
      const found = await api.events.geocode(q);
      setResults(found);
      if (found.length === 1) choose(found[0]);
    } catch (e) {
      notifyError(e, 'Could not search the map');
    } finally {
      setSearching(false);
    }
  };
  const choose = (r: GeocodeResult) => {
    onChange({ lat: r.latitude, lng: r.longitude }, radius);
    setResults(null);
  };
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { notifyError(new Error('This browser cannot share its location.')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onChange({ lat: p.coords.latitude, lng: p.coords.longitude }, radius); },
      (err) => {
        setLocating(false);
        notifyError(new Error(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Search for the venue or click it on the map instead.'
          : 'Your location could not be found. Search for the venue or click it on the map instead.'));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void search(); }
  };

  // Minimized: one line with the pin status; click to open the map.
  if (!open) {
    return (
      <UnstyledButton onClick={() => setOpen(true)} className="tn-venue-bar" aria-expanded={false}
        aria-label="Open the venue map to pin the location">
        <Group gap={12} wrap="nowrap">
          <ThemeIcon size={34} radius="md" variant="light" color={pin ? 'blue' : 'gray'}><IconMap2 size={18} /></ThemeIcon>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600}>Venue location for attendance</Text>
            <Text size="xs" c="dimmed" truncate>
              {pin
                ? `Pinned · scans accepted within ${formatDistance(radius)} of the venue`
                : 'Not pinned · attendance is checked by time only. Click to pin the venue on the map.'}
            </Text>
          </div>
          {pin
            ? <Badge variant="light" color="blue" tt="none" leftSection={<IconMapPin size={12} />} visibleFrom="xs">{formatDistance(radius)} radius</Badge>
            : <Badge variant="light" color="gray" tt="none" visibleFrom="xs">Not pinned</Badge>}
          <IconChevronDown size={18} color="#64748B" />
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <Paper withBorder radius="md" p="sm" className="tn-venue-picker">
      <Group justify="space-between" mb={6} gap="xs" wrap="nowrap" align="flex-start">
        <div>
          <Text size="sm" fw={600}>Venue location for attendance</Text>
          <Text size="xs" c="dimmed">
            Pin the exact spot. Time In / Time Out scans are accepted only within the perimeter. Leave it unpinned to check attendance by time only.
          </Text>
        </div>
        <Group gap={4} wrap="nowrap">
          {pin && (
            <Button size="compact-sm" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => onChange(null, radius)}>
              Remove pin
            </Button>
          )}
          <Button size="compact-sm" variant="subtle" color="dark" rightSection={<IconChevronUp size={14} />}
            onClick={() => { setOpen(false); setResults(null); }}>
            Hide map
          </Button>
        </Group>
      </Group>

      <Group gap={6} wrap="nowrap" align="flex-start">
        <TextInput style={{ flex: 1 }} size="sm" leftSection={<IconSearch size={16} />}
          placeholder={venue.trim() ? `Search "${venue.trim()}" or an address` : 'Search a place or address'}
          value={query} onChange={(e) => setQuery(e.currentTarget.value)} onKeyDown={onKey} aria-label="Search the map"
          rightSection={query ? <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => { setQuery(''); setResults(null); }} aria-label="Clear search"><IconX size={14} /></ActionIcon> : null} />
        <Button size="sm" color="ink.8" loading={searching} onClick={() => void search()}>Search</Button>
        <Button size="sm" variant="default" loading={locating} onClick={useMyLocation} leftSection={<IconCurrentLocation size={16} />}
          visibleFrom="sm">My location</Button>
        <ActionIcon size={36} variant="default" loading={locating} onClick={useMyLocation} aria-label="Use my location" hiddenFrom="sm">
          <IconCurrentLocation size={18} />
        </ActionIcon>
      </Group>

      {results && (
        <Paper withBorder radius="sm" mt={6} p={4}>
          {results.length === 0 ? (
            <Text size="sm" c="dimmed" p={8}>No places found. Try a shorter name or the street, or click the venue on the map.</Text>
          ) : (
            <ScrollArea.Autosize mah={180}>
              {results.map((r) => (
                <UnstyledButton key={`${r.latitude},${r.longitude}`} onClick={() => choose(r)} className="tn-row" w="100%" p={8} style={{ borderRadius: 6 }}>
                  <Group gap={8} wrap="nowrap" align="flex-start">
                    <IconMapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <Text size="sm" lineClamp={2}>{r.name}</Text>
                  </Group>
                </UnstyledButton>
              ))}
            </ScrollArea.Autosize>
          )}
        </Paper>
      )}

      <Box className="tn-map" h={300} mt={8}>
        <MapContainer center={center} zoom={pin ? 17 : 14} style={{ height: '100%', width: '100%' }}>
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
          <ClickToPin onPick={(p) => onChange(p, radius)} />
          {pin && (
            <>
              <Circle center={[pin.lat, pin.lng]} radius={radius} pathOptions={PERIMETER} />
              <Marker position={[pin.lat, pin.lng]} draggable eventHandlers={{
                dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onChange({ lat: ll.lat, lng: ll.lng }, radius); },
              }} />
            </>
          )}
          <FitView pin={pin} radius={radius} />
        </MapContainer>
      </Box>

      <Stack gap={6} mt={8}>
        {pin ? (
          <>
            <Group gap="sm" align="flex-end" wrap="wrap">
              <NumberInput size="sm" w={150} label="Perimeter radius" suffix=" m" value={radius} allowDecimal={false}
                min={VENUE_RADIUS_RANGE.min} max={VENUE_RADIUS_RANGE.max} clampBehavior="blur"
                onChange={(v) => onChange(pin, Math.max(VENUE_RADIUS_RANGE.min, Math.min(VENUE_RADIUS_RANGE.max, Number(v) || VENUE_RADIUS_RANGE.min)))} />
              <SegmentedControl size="xs" data={RADIUS_PRESETS.map((v) => ({ value: v, label: `${v} m` }))}
                value={RADIUS_PRESETS.includes(String(radius)) ? String(radius) : ''} onChange={(v) => onChange(pin, Number(v))} />
            </Group>
            <Text size="xs" c="dimmed">
              Pinned at {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} · scans accepted within {formatDistance(radius)}.
              Drag the pin or click the map to move it. Phones indoors are often 20–50 m off, so keep the radius at least 50 m.
            </Text>
          </>
        ) : (
          <Text size="xs" c="dimmed">Search for the venue, use your location, or click the map to drop the pin.</Text>
        )}
        {searching && <Group gap={6}><Loader size="xs" /><Text size="xs" c="dimmed">Searching the map…</Text></Group>}
      </Stack>
    </Paper>
  );
}
