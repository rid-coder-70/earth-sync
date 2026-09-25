export type SourceId = 'MODIS_NRT' | 'MODIS_SP' | 'VIIRS_SNPP_NRT' | 'VIIRS_SNPP_SP' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
export type Sensor = 'MODIS' | 'VIIRS';
export interface Detection {
  id: string; latitude: number; longitude: number; brightness: number | null;
  scan: number | null; track: number | null; acqDate: string; acqTime: string;
  satellite: string; instrument: string; confidence: number | null; version: string;
  frp: number | null; daynight: string; source: SourceId; sensor: Sensor;
}
export interface HarmonizedHotspot {
  id: string; latitude: number; longitude: number; sources: Sensor[];
  confidence: number | null; frp: number | null; detectionCount: number;
  startTime: string; endTime: string; date: string; detections: Detection[];
}
export const SOURCE_IDS: SourceId[] = ['MODIS_NRT', 'MODIS_SP', 'VIIRS_SNPP_NRT', 'VIIRS_SNPP_SP', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
export const sensorForSource = (source: SourceId): Sensor => source.startsWith('MODIS') ? 'MODIS' : 'VIIRS';
