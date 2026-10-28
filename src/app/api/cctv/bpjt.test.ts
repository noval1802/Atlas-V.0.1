import { describe, expect, it } from 'vitest';
import { bpjtCamera, parseBpjt } from './bpjt';

// A real-shaped record from bpjt.pu.go.id/cctv (JSON embedded in the page, \/ escaped).
const JM = String.raw`{"id":"6591","unique_id":"479-1-105","nama_ruas":"Jakarta-Bogor-Ciawi","nama_segment":"CILILITAN - TM MINI","nama_km":"JAGORAWI KM 04+500 | B","bujt":"jm","protocol":"m3u8","status":"1","lat":"-6.2856","lon":"106.8770","streamhls":"https:\/\/jmlive.jasamarga.com\/hls\/1\/abc\/index.m3u8","updated_at":"2026-05-11 10:47:27"}`;
const TOLL = String.raw`{"id":"7001","unique_id":"t-1","nama_ruas":"Pekanbaru - Dumai","nama_segment":"SEG 1","nama_km":"KM 10","bujt":"hk","protocol":"m3u8","status":"1","lat":"0.65","lon":"101.4","streamhls":"https:\/\/pub2.hk-opt.com\/live\/cam1.m3u8","updated_at":"2026-05-11 10:47:27"}`;

describe('bpjt cameras', () => {
  it('maps a non-Jasa-Marga toll camera to an HLS CctvCamera', () => {
    const camera = bpjtCamera(JSON.parse(TOLL));
    expect(camera).toMatchObject({
      id: 'bpjt-t-1',
      name: 'KM 10',
      city: 'Pekanbaru - Dumai',
      country: 'Indonesia',
      source: 'BPJT',
      stream_type: 'hls',
      stream_url: 'https://pub2.hk-opt.com/live/cam1.m3u8',
    });
    expect(camera?.lat).toBeCloseTo(0.65);
  });

  it('skips Jasa Marga records so they are not plotted twice', () => {
    expect(bpjtCamera(JSON.parse(JM))).toBeNull();
  });

  it('drops records outside Indonesia, without a playlist, or with a bad id', () => {
    const base = JSON.parse(TOLL);
    expect(bpjtCamera({ ...base, lat: '51.5', lon: '-0.1' })).toBeNull();
    expect(bpjtCamera({ ...base, streamhls: '' })).toBeNull();
    expect(bpjtCamera({ ...base, unique_id: 'a b', id: '' })).toBeNull();
  });

  it('parses the page, keeping toll cameras and dropping Jasa Marga', () => {
    const cameras = parseBpjt(`<html><script>var x=[${JM},${TOLL}];</script></html>`);
    expect(cameras.map(c => c.id)).toEqual(['bpjt-t-1']);
  });
});
