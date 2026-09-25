import type { Detection, SourceId } from '../types.js';
import { sensorForSource } from '../types.js';

const locations = [
  { lat: 38.55, lon: -120.4, region: 'California' }, { lat: 39.1, lon: -121.2, region: 'California' },
  { lat: -3.4, lon: -60.1, region: 'Amazon' }, { lat: -25.2, lon: 133.8, region: 'Australia' },
  { lat: 40.5, lon: -110.7, region: 'Mountain West' }, { lat: 34.7, lon: -111.8, region: 'Arizona' },
  { lat: 55.5, lon: 98.2, region: 'Siberia' }, { lat: 12.9, lon: 24.5, region: 'Central Africa' },
];
export function demoDetections(start: string, end: string, bbox: string, sources: SourceId[]): Detection[] {
  const [west, south, east, north] = bbox.trim().toLowerCase() === 'world' ? [-180, -90, 180, 90] : bbox.split(',').map(Number);
  const startDate = new Date(`${start}T00:00:00Z`), endDate = new Date(`${end}T00:00:00Z`);
  const result: Detection[] = [];
  let day = new Date(startDate), serial = 0;
  while (day <= endDate) {
    const date = day.toISOString().slice(0, 10), month = day.getUTCMonth();
    locations.forEach((point, i) => {
      const eligible = (i * 7 + day.getUTCDate() + month * 3) % 4 !== 0;
      if (!eligible || point.lon < west || point.lon > east || point.lat < south || point.lat > north) return;
      const count = 1 + ((i + day.getUTCDate()) % 3);
      for (let j = 0; j < count; j++) {
        const source = sources[(i + j) % sources.length]; if (!source) continue;
        const dlat = j === 0 ? 0 : 0.0016, dlon = j === 0 ? 0 : 0.0016;
        result.push({ id: `demo-${date}-${i}-${j}`, latitude: point.lat + dlat, longitude: point.lon + dlon, brightness: 310 + i * 3, scan: 1, track: 1, acqDate: date, acqTime: String(900 + i * 37 + j * 9).padStart(4, '0'), satellite: source, instrument: sensorForSource(source), confidence: 45 + ((i * 11 + j * 13) % 55), version: 'DEMO-SYNTHETIC', frp: 4 + i * 2.7, daynight: 'D', source, sensor: sensorForSource(source) });
        serial++;
      }
    });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}
