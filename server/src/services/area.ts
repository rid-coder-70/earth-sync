export function parseBbox(input: string): [number, number, number, number] {
  if (input.trim().toLowerCase() === 'world') return [-180, -90, 180, 90];
  const parts = input.split(',').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) throw new Error('bbox must be west,south,east,north');
  const [west, south, east, north] = parts;
  if (west! < -180 || east! > 180 || south! < -90 || north! > 90 || west! >= east! || south! >= north!) throw new Error('bbox coordinates are out of range or inverted');
  return [west!, south!, east!, north!];
}
export function bboxContains(bbox: string, longitude: number, latitude: number): boolean {
  const [west, south, east, north] = parseBbox(bbox);
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}
export function listDates(start: string, end: string): string[] {
  const from = new Date(`${start}T00:00:00Z`), to = new Date(`${end}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new Error('start and end must be valid YYYY-MM-DD dates with start <= end');
  if ((to.getTime() - from.getTime()) / 86_400_000 > 365) throw new Error('Date range is limited to 366 days per request');
  const dates: string[] = [];
  while (from <= to) { dates.push(from.toISOString().slice(0, 10)); from.setUTCDate(from.getUTCDate() + 1); }
  return dates;
}
