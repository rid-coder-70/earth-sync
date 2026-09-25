import test from 'node:test';
import assert from 'node:assert/strict';
import { harmonize } from './harmonize.js';
import type { Detection } from '../types.js';
const point = (id: string, latitude: number, longitude: number, sensor: 'MODIS' | 'VIIRS', time = '1200'): Detection => ({ id, latitude, longitude, brightness: 320, scan: 1, track: 1, acqDate: '2026-08-01', acqTime: time, satellite: sensor, instrument: sensor, confidence: sensor === 'MODIS' ? 75 : 90, version: 'test', frp: 10, daynight: 'D', source: sensor === 'MODIS' ? 'MODIS_NRT' : 'VIIRS_SNPP_NRT', sensor });
test('merges nearby MODIS and VIIRS detections from the same day', () => {
  const clusters = harmonize([point('m', 38.5, -120.5, 'MODIS'), point('v', 38.5005, -120.5, 'VIIRS')]);
  assert.equal(clusters.length, 1); assert.deepEqual(clusters[0]?.sources, ['MODIS', 'VIIRS']);
  assert.equal(clusters[0]?.detectionCount, 2); assert.equal(clusters[0]?.confidence, 90);
});
test('keeps distant and different-day detections separate', () => {
  const clusters = harmonize([point('a', 38.5, -120.5, 'MODIS'), point('b', 39, -120.5, 'VIIRS'), { ...point('c', 38.5001, -120.5, 'VIIRS'), acqDate: '2026-08-02' }]);
  assert.equal(clusters.length, 3);
});
test('keeps detections outside the time window separate', () => {
  assert.equal(harmonize([point('a', 38.5, -120.5, 'MODIS', '0100'), point('b', 38.5001, -120.5, 'VIIRS', '1200')]).length, 2);
});
