import { parse } from 'csv-parse/sync';
import type { Detection, SourceId } from '../types.js';
import { sensorForSource } from '../types.js';

const API = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const value = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== '') return row[key];
  return '';
};
const numberOrNull = (input: string) => Number.isFinite(Number(input)) && input !== '' ? Number(input) : null;

export function parseFirmsCsv(csv: string, source: SourceId): Detection[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Record<string, string>[];
  return rows.map((row, index) => {
    const lower = Object.fromEntries(Object.entries(row).map(([key, val]) => [key.toLowerCase(), val]));
    const latitude = numberOrNull(value(lower, 'latitude', 'lat'));
    const longitude = numberOrNull(value(lower, 'longitude', 'lon'));
    if (latitude === null || longitude === null) return null;
    const date = value(lower, 'acq_date', 'date');
    const time = value(lower, 'acq_time', 'time').padStart(4, '0');
    const confidenceRaw = value(lower, 'confidence');
    const confidence = confidenceRaw.toLowerCase() === 'high' ? 90 : confidenceRaw.toLowerCase() === 'nominal' ? 65 : confidenceRaw.toLowerCase() === 'low' ? 35 : numberOrNull(confidenceRaw);
    const sensor = sensorForSource(source);
    return {
      id: `${source}:${date}:${time}:${latitude}:${longitude}:${index}`, latitude, longitude,
      brightness: numberOrNull(value(lower, 'brightness', 'bright_ti4', 'bright_t31', 'bright_ti5')),
      scan: numberOrNull(value(lower, 'scan')), track: numberOrNull(value(lower, 'track')),
      acqDate: date, acqTime: time, satellite: value(lower, 'satellite') || source,
      instrument: value(lower, 'instrument') || sensor, confidence,
      version: value(lower, 'version'), frp: numberOrNull(value(lower, 'frp')),
      daynight: value(lower, 'daynight'), source, sensor,
    } satisfies Detection;
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function fetchFirmsDay(mapKey: string, source: SourceId, bbox: string, date: string): Promise<Detection[]> {
  const url = `${API}/${encodeURIComponent(mapKey)}/${source}/${encodeURIComponent(bbox)}/1/${date}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`FIRMS ${response.status}: ${text.slice(0, 200)}`);
  if (/invalid map key|error/i.test(text.slice(0, 150)) && !text.toLowerCase().includes('latitude')) throw new Error(`FIRMS response: ${text.slice(0, 200)}`);
  return parseFirmsCsv(text, source);
}
