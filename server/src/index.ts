import dotenv from 'dotenv';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { SOURCE_IDS, type SourceId } from './types.js';
import { db, getCachedRecords, observationsForArea, saveFetchedRecords } from './db/database.js';
import { fetchFirmsDay } from './services/firmsClient.js';
import { harmonize } from './services/harmonize.js';
import { activityLevel, calendarForMonth, criticalPeriods, historicalForYears, unusualForDate } from './services/aggregate.js';
import { demoDetections } from './services/demo.js';
import { listDates, parseBbox } from './services/area.js';

// Workspace scripts execute from server/, while the documented .env lives at the monorepo root.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
app.use(express.json());
const demoMode = !process.env.FIRMS_MAP_KEY;
const DEFAULT_SOURCES: SourceId[] = ['MODIS_NRT', 'VIIRS_SNPP_NRT'];
const DEFAULT_BBOX = '-125,24,-66,50';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, amount: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };

async function loadObservations(bbox: string, dates: string[], sources: SourceId[]) {
  const records = [] as Awaited<ReturnType<typeof fetchFirmsDay>>;
  const errors: string[] = [];
  const mapKey = process.env.FIRMS_MAP_KEY;
  for (const date of dates) {
    for (const source of sources) {
      const cached = getCachedRecords(bbox, date, source);
      if (cached) { records.push(...cached); continue; }
      if (!mapKey) continue;
      try {
        const fetched = await fetchFirmsDay(mapKey, source, bbox, date);
        saveFetchedRecords(bbox, date, source, fetched);
        records.push(...fetched);
      } catch (error) {
        errors.push(`${source} ${date}: ${error instanceof Error ? error.message : 'FIRMS request failed'}`);
      }
    }
  }
  return { records, errors };
}
function areaParam(input: unknown): string {
  const bbox = typeof input === 'string' ? input : DEFAULT_BBOX;
  parseBbox(bbox);
  return bbox;
}
function readSources(input: unknown): SourceId[] {
  if (typeof input !== 'string' || !input.trim()) return DEFAULT_SOURCES;
  const sources = input.split(',').filter((item): item is SourceId => SOURCE_IDS.includes(item as SourceId));
  if (!sources.length) throw new Error(`sources must include one or more of: ${SOURCE_IDS.join(', ')}`);
  return [...new Set(sources)];
}
function demoOrCached(bbox: string, start: string, end: string, sources: SourceId[]) {
  return demoMode ? demoDetections(start, end, bbox, sources) : observationsForArea(bbox, start, end);
}
function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, demoMode }));

app.get('/api/hotspots', asyncRoute(async (req, res) => {
  const bbox = areaParam(req.query.bbox);
  const end = typeof req.query.end === 'string' ? req.query.end : today();
  const start = typeof req.query.start === 'string' ? req.query.start : addDays(end, -4);
  const dates = listDates(start, end);
  const sources = readSources(req.query.sources);
  const view = typeof req.query.view === 'string' ? req.query.view : 'all';
  const loaded = await loadObservations(bbox, dates, sources);
  const records = demoMode ? demoDetections(start, end, bbox, sources) : loaded.records;
  const visible = records.filter(item => view === 'modis' ? item.sensor === 'MODIS' : view === 'viirs' ? item.sensor === 'VIIRS' : true);
  const clusters = harmonize(visible);
  res.json({ bbox, start, end, view, demoMode, records: visible, harmonized: clusters, totals: { modis: records.filter(item => item.sensor === 'MODIS').length, viirs: records.filter(item => item.sensor === 'VIIRS').length, harmonized: harmonize(records).length }, errors: loaded.errors });
}));

app.get('/api/calendar', asyncRoute(async (req, res) => {
  const bbox = areaParam(req.query.area);
  const year = Number(req.query.year ?? new Date().getUTCFullYear());
  const month = Number(req.query.month ?? new Date().getUTCMonth() + 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'year or month is invalid' });
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const sourceSet = DEFAULT_SOURCES;
  const records = demoOrCached(bbox, start, end, sourceSet);
  const days = calendarForMonth(records, year, month);
  const unusual = new Map(days.map(day => [day.date, unusualForDate(records, day.date).unusual]));
  res.json({ area: bbox, year, month, demoMode, days: days.map(day => ({ ...day, activity: unusual.get(day.date) ? 'unusual' : day.activity })) });
}));

app.get('/api/historical', asyncRoute(async (req, res) => {
  const bbox = areaParam(req.query.area);
  const currentYear = new Date().getUTCFullYear();
  const years = typeof req.query.years === 'string' ? [...new Set(req.query.years.split(',').map(Number).filter(year => Number.isInteger(year) && year >= 2000 && year <= currentYear))].slice(0, 10) : [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
  if (!years.length) return res.status(400).json({ error: 'years must contain years between 2000 and the current year' });
  const start = `${Math.min(...years)}-01-01`, end = `${Math.max(...years)}-12-31`;
  const records = demoOrCached(bbox, start, end, DEFAULT_SOURCES);
  res.json({ area: bbox, demoMode, years: historicalForYears(records, years) });
}));

app.get('/api/unusual', asyncRoute(async (req, res) => {
  const bbox = areaParam(req.query.area);
  const date = typeof req.query.date === 'string' ? req.query.date : today();
  if (listDates(date, date).length !== 1) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const start = `${date.slice(0, 4)}-01-01`, end = `${date.slice(0, 4)}-12-31`;
  const records = demoOrCached(bbox, start, end, DEFAULT_SOURCES);
  res.json({ area: bbox, demoMode, ...unusualForDate(records, date) });
}));

app.get('/api/critical-periods', asyncRoute(async (req, res) => {
  const bbox = areaParam(req.query.area);
  const records = demoMode ? demoDetections('2022-01-01', today(), bbox, DEFAULT_SOURCES) : observationsForArea(bbox);
  res.json({ area: bbox, demoMode, periods: criticalPeriods(records) });
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`EARTH SYNC API listening on http://localhost:${port}${demoMode ? ' (synthetic demo mode: FIRMS_MAP_KEY is not configured)' : ''}`));
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
