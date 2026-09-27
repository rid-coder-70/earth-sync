export type Sensor = 'MODIS' | 'VIIRS';
export type SourceId = 'MODIS_NRT' | 'MODIS_SP' | 'VIIRS_SNPP_NRT' | 'VIIRS_SNPP_SP' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
export type ViewMode = 'harmonized' | 'modis' | 'viirs';
export interface Detection { id: string; latitude: number; longitude: number; brightness: number | null; acqDate: string; acqTime: string; satellite: string; confidence: number | null; frp: number | null; source: SourceId; sensor: Sensor; }
export interface Cluster { id: string; latitude: number; longitude: number; sources: Sensor[]; confidence: number | null; frp: number | null; detectionCount: number; startTime: string; endTime: string; date: string; detections: Detection[]; }
export interface HotspotsResponse { demoMode: boolean; records: Detection[]; harmonized: Cluster[]; totals: { modis: number; viirs: number; harmonized: number }; errors: string[]; }
export interface Day { date: string; count: number; activity: 'low' | 'medium' | 'high' | 'unusual'; }
export interface CalendarResponse { demoMode: boolean; days: Day[]; }
export interface HistoricalResponse { demoMode: boolean; years: { year: number; months: { month: number; count: number }[] }[]; }
export interface UnusualResponse { unusual: boolean; date: string; count: number; explanation: string; baseline: { mean: number; standardDeviation: number; sampleDays: number; thresholdZScore: number }; }
export interface CriticalPeriod { month: number; label: string; averageCount: number; recurrence: string; startMonth: number; endMonth: number; }
export interface CriticalResponse { demoMode: boolean; periods: CriticalPeriod[]; }
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

async function get<T>(path: string): Promise<T> { const response = await fetch(`${API_BASE_URL}${path}`); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Request failed'); return data as T; }
export const api = {
  hotspots: (params: { bbox: string; start: string; end: string; sources: SourceId[]; view: ViewMode }) => get<HotspotsResponse>(`/api/hotspots?${new URLSearchParams({ ...params, sources: params.sources.join(',') })}`),
  calendar: (area: string, year: number, month: number) => get<CalendarResponse>(`/api/calendar?${new URLSearchParams({ area, year: String(year), month: String(month) })}`),
  historical: (area: string) => get<HistoricalResponse>(`/api/historical?${new URLSearchParams({ area })}`),
  unusual: (area: string, date: string) => get<UnusualResponse>(`/api/unusual?${new URLSearchParams({ area, date })}`),
  criticalPeriods: (area: string) => get<CriticalResponse>(`/api/critical-periods?${new URLSearchParams({ area })}`),
};
