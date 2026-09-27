import test from 'node:test';
import assert from 'node:assert/strict';
import { firmsDayUrl } from './firmsClient.js';

test('keeps bbox commas as separators in FIRMS area path', () => {
  const url = firmsDayUrl('test-key', 'MODIS_NRT', '-125,24,-66,50', '2026-09-27');
  assert.equal(url, 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/test-key/MODIS_NRT/-125,24,-66,50/1/2026-09-27');
});