import { describe, expect, it } from 'vitest';
import { jasamargaBatasKm, jasamargaCamera, jasamargaVms } from './jasamarga';

const secret = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InBpbSJ9.signature';

describe('jasamarga cameras', () => {
  it('maps an HLS camera without forwarding the session or the encoder address', () => {
    const camera = jasamargaCamera({
      geometry: { type: 'Point', coordinates: [106.82, -6.2] },
      properties: {
        camera_id: 42,
        nama: 'Gerbang Cililitan',
        cabang: 'Jakarta',
        km: '010+200',
        enabled: '1',
        reload: false,
        id_ruas: 7,
        key_id: '88d929ac-3d29-45d5-8c6f-3082491faa9b',
        token: secret,
        ip_address: '192.168.150.47:80',
      },
    });
    expect(camera).toMatchObject({
      id: 'jm-arteri-42',
      stream_type: 'hls',
      stream_url: 'https://jmlive.jasamarga.com/hls/7/88d929ac-3d29-45d5-8c6f-3082491faa9b/index.m3u8',
      source: 'Jasa Marga',
    });
    const packed = JSON.stringify(camera);
    expect(packed.includes(secret)).toBe(false);
    expect(packed.includes('192.168')).toBe(false);
  });

  it('keeps the ZoneMinder frame address as an mjpeg stream', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [109.201, -7.5622] },
      properties: {
        camera_id: 14218,
        nama: 'AtMS Dome Simpang 3 Sampang',
        cabang: 'AtMS Hubdat',
        enabled: 1,
        reload: 'false',
        petunjuk: 'https://jid.jasamarga.com/vmzm4&monitor=1863',
      },
    });
    expect(camera?.stream_type).toBe('mjpeg');
    expect(camera?.stream_url).toContain('vmzm4&monitor=1863');
    expect(camera?.id).toBe('jm-arteri-14218');
  });

  it('keeps a main-road camera distinct from an arterial camera with the same id', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [107.6, -6.9] },
      properties: { camera_id: 42, nama: 'Tol Cipularang', cabang: 'Purbaleunyi', enabled: '1', reload: false },
    }, 'main');
    expect(camera?.id).toBe('jm-main-42');
  });

  it('keeps a monitoring camera distinct from the other layers', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [106.8, -6.2] },
      properties: { camera_id: 42, nama: 'Pos Pemantauan', cabang: 'Jakarta', enabled: '1', reload: false },
    }, 'pemantauan');
    expect(camera?.id).toBe('jm-pemantauan-42');
  });

  it('keeps a toll-gate camera distinct from the other layers', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [106.9, -6.3] },
      properties: { camera_id: 42, nama: 'Gerbang Cikampek', cabang: 'JAPEK', enabled: '1', reload: false },
    }, 'gerbang');
    expect(camera?.id).toBe('jm-gerbang-42');
  });

  it('keeps an interchange camera distinct from the other layers', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [107.1, -6.4] },
      properties: { camera_id: 42, nama: 'SS Kopo', cabang: 'JAPEK', enabled: '1', reload: false },
    }, 'ss');
    expect(camera?.id).toBe('jm-ss-42');
  });

  it('keeps a ramp camera distinct from the other layers', () => {
    const camera = jasamargaCamera({
      geometry: { coordinates: [106.7, -6.1] },
      properties: { camera_id: 42, nama: 'Ramp Cikampek', cabang: 'JAPEK', enabled: '1', reload: false },
    }, 'ramp');
    expect(camera?.id).toBe('jm-ramp-42');
  });

  it('keeps a message sign and drops an encoder address', () => {
    const sign = jasamargaVms({
      geometry: { coordinates: [107.2, -6.5] },
      properties: {
        fid: 9,
        nama_vms: 'VMS Cikampek',
        cabang: 'JAPEK',
        km: 'KM 20',
        url_cctv_public: 'http://202.162.214.246:8001/video.mjpg',
      },
    });
    expect(sign).toMatchObject({ id: 'jm-vms-9', name: 'VMS Cikampek · KM 20', source: 'Jasa Marga' });
    expect(sign?.stream_url).toBeUndefined();
    expect(JSON.stringify(sign).includes('202.162.214.246')).toBe(false);
  });

  it('keeps a public Jasa Marga link on a message sign', () => {
    const sign = jasamargaVms({
      geometry: { coordinates: [107.2, -6.5] },
      properties: {
        fid: 10,
        nama_vms: 'VMS Dalam',
        url_cctv_public: 'https://jid.jasamarga.com/cctv2/example.mjpg',
      },
    });
    expect(sign?.stream_type).toBe('mjpeg');
    expect(sign?.stream_url).toBe('https://jid.jasamarga.com/cctv2/example.mjpg');
  });

  it('maps a kilometre post without a picture', () => {
    const post = jasamargaBatasKm({
      geometry: { coordinates: [106.8, -6.2] },
      properties: { id: 55, id_ruas: 4, label: 'KM 12+000' },
    });
    expect(post).toMatchObject({
      id: 'jm-batas-km-55',
      name: 'KM 12+000',
      city: 'Ruas 4',
      source: 'Jasa Marga',
    });
    expect(post?.stream_url).toBeUndefined();
  });

  it('drops a camera switched off or sitting outside Indonesia', () => {
    expect(jasamargaCamera({
      geometry: { coordinates: [106.8, -6.2] },
      properties: { enabled: '0', camera_id: 1, nama: 'Mati' },
    })).toBeNull();
    expect(jasamargaCamera({
      geometry: { coordinates: [2.3, 48.8] },
      properties: { enabled: '1', camera_id: 2, nama: 'Paris' },
    })).toBeNull();
  });
});
