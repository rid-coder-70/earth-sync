import type { Detection, HarmonizedHotspot } from '../types.js';

const EARTH_RADIUS_M = 6_371_000;
const distanceMeters = (a: Detection, b: Detection) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
};
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(2, 4));

export function harmonize(detections: Detection[], radiusMeters = Number(process.env.CLUSTER_RADIUS_METERS ?? 750), maxTimeGapMinutes = 360): HarmonizedHotspot[] {
  const sorted = [...detections].sort((a, b) => a.acqDate.localeCompare(b.acqDate) || minutes(a.acqTime) - minutes(b.acqTime));
  const groups: Detection[][] = [];
  for (const detection of sorted) {
    let best: Detection[] | undefined, bestDistance = Infinity;
    for (const group of groups) {
      const first = group[0];
      if (first.acqDate !== detection.acqDate || Math.abs(minutes(first.acqTime) - minutes(detection.acqTime)) > maxTimeGapMinutes) continue;
      const centroid = { latitude: group.reduce((sum, item) => sum + item.latitude, 0) / group.length, longitude: group.reduce((sum, item) => sum + item.longitude, 0) / group.length };
      const candidate = distanceMeters(detection, { ...first, ...centroid });
      if (candidate <= radiusMeters && candidate < bestDistance) { best = group; bestDistance = candidate; }
    }
    if (best) best.push(detection); else groups.push([detection]);
  }
  return groups.map((items, index) => {
    const times = items.map(item => item.acqTime).sort();
    const confidenceValues = items.map(item => item.confidence).filter((n): n is number => n !== null);
    const frpValues = items.map(item => item.frp).filter((n): n is number => n !== null);
    return {
      id: `harmonized:${items[0].acqDate}:${index}:${items[0].id}`,
      latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
      longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
      sources: [...new Set(items.map(item => item.sensor))],
      confidence: confidenceValues.length ? Math.max(...confidenceValues) : null,
      frp: frpValues.length ? frpValues.reduce((sum, n) => sum + n, 0) / frpValues.length : null,
      detectionCount: items.length, startTime: times[0], endTime: times[times.length - 1],
      date: items[0].acqDate, detections: items,
    };
  });
}
