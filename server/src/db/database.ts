import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Detection } from '../types.js';

const configuredPath = process.env.DATABASE_PATH ?? './data/earth-sync.sqlite';
const dbPath = path.resolve(configuredPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS firms_cache (
    bbox TEXT NOT NULL, date TEXT NOT NULL, source TEXT NOT NULL,
    fetched_at INTEGER NOT NULL, records_json TEXT NOT NULL,
    PRIMARY KEY (bbox, date, source)
  );
  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY, bbox TEXT NOT NULL, date TEXT NOT NULL, source TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS observations_area_date ON observations(bbox, date);
`);

const getCache = db.prepare('SELECT records_json FROM firms_cache WHERE bbox = ? AND date = ? AND source = ?');
const putCache = db.prepare('INSERT OR REPLACE INTO firms_cache (bbox,date,source,fetched_at,records_json) VALUES (?,?,?,?,?)');
const putObservation = db.prepare('INSERT OR REPLACE INTO observations (id,bbox,date,source,payload_json) VALUES (?,?,?,?,?)');
export function getCachedRecords(bbox: string, date: string, source: string): Detection[] | undefined {
  const row = getCache.get(bbox, date, source) as { records_json: string } | undefined;
  return row ? JSON.parse(row.records_json) as Detection[] : undefined;
}
export function saveFetchedRecords(bbox: string, date: string, source: string, records: Detection[]): void {
  const tx = db.transaction(() => {
    putCache.run(bbox, date, source, Date.now(), JSON.stringify(records));
    for (const record of records) putObservation.run(record.id, bbox, record.acqDate, source, JSON.stringify(record));
  });
  tx();
}
export function observationsForArea(bbox: string, start?: string, end?: string): Detection[] {
  const rows = db.prepare(`SELECT payload_json FROM observations WHERE bbox = ? AND (? IS NULL OR date >= ?) AND (? IS NULL OR date <= ?)`)
    .all(bbox, start ?? null, start ?? null, end ?? null, end ?? null) as { payload_json: string }[];
  return rows.map(row => JSON.parse(row.payload_json) as Detection);
}
