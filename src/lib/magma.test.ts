import { describe, it, expect } from 'vitest';
import { parseMagmaReport, parseMagmaVolcanoes, parseReportLinks } from './magma';

const page = `<script>
  var markersGunungApi = [{"ga_code":"AGU","ga_nama_gapi":"Agung","ga_prov_gapi":"Bali","ga_elev_gapi":3142,"ga_lon_gapi":115.508,"ga_lat_gapi":-8.342,"ga_status":1,"has_vona":false,"erupt_icon":false},
    {"ga_code":"SMR","ga_nama_gapi":"Semeru [Mahameru]","ga_prov_gapi":"Jawa Timur","ga_elev_gapi":3676,"ga_lon_gapi":112.92,"ga_lat_gapi":-8.108,"ga_status":3,"has_vona":true,"erupt_icon":true},
    {"ga_code":"BAD","ga_nama_gapi":"Broken","ga_lat_gapi":null,"ga_lon_gapi":110,"ga_status":2}],
    maxHeight = 0.8 * ($(window).height());
  var other = [1, 2];
</script>`;

describe('parseMagmaVolcanoes', () => {
  it('reads the embedded list, stopping at its own closing bracket', () => {
    const volcanoes = parseMagmaVolcanoes(page);
    expect(volcanoes.map(v => v.code)).toEqual(['AGU', 'SMR']);
    expect(volcanoes[1]).toEqual({
      code: 'SMR', name: 'Semeru [Mahameru]', province: 'Jawa Timur', elevation: 3676,
      lat: -8.108, lng: 112.92, level: 3, erupting: true, vona: true,
    });
  });

  it('throws when the page no longer carries the list', () => {
    expect(() => parseMagmaVolcanoes('<html>maintenance</html>')).toThrow();
  });
});

describe('parseReportLinks', () => {
  it('pairs each volcano with its signed report link', () => {
    const page = `<tr><td>
      Anak Krakatau - Lampung <a href="https://magma.esdm.go.id/v1/gunung-api/laporan/329643?signature=add111"><i class="fa"></i>Lihat laporan</a></td></tr>
      <tr><td>Merapi - Daerah Istimewa Yogyakarta dan Jawa Tengah <a href="https://magma.esdm.go.id/v1/gunung-api/laporan/329641?signature=0b2c"></a></td></tr>
      <tr><td>Fake - X <a href="https://evil.example/v1/gunung-api/laporan/1?signature=aa"></a></td></tr>`;
    expect([...parseReportLinks(page)]).toEqual([
      ['Anak Krakatau', 'https://magma.esdm.go.id/v1/gunung-api/laporan/329643?signature=add111'],
      ['Merapi', 'https://magma.esdm.go.id/v1/gunung-api/laporan/329641?signature=0b2c'],
    ]);
  });
});

describe('parseMagmaReport', () => {
  const page = `<h5><span class="badge bg-orange tx-white">Level III (Siaga)</span></h5>
    <h5 class="card-title tx-dark tx-medium mg-b-10">Anak Krakatau, Sabtu - 31 Oktober 2026, periode 12:00-18:00 WIB</h5>
    <p class="card-subtitle tx-normal mg-b-15">Dibuat oleh, Muhammad Dika Nurzaman</p>
    <img class="img-fluid" src="https://magma.vsi.esdm.go.id/img/ga/KRA/KRA202610311200.png" alt="Anak Krakatau">
    <div class="media-body"><h6 class="slim-card-title">Klimatologi</h6><p>Suhu udara sekitar 31-34.3&deg;C. </p></div>
    <div class="media-body"><h6 class="slim-card-title">Pengamatan Kegempaan</h6>
      <p>6 kali gempa Hembusan. </p><hr><p>1 kali gempa Low Frequency. </p><hr></div>
    <div class="media-body"><h6 class="slim-card-title">Rekomendasi</h6><p>1. Radius 5 km. <br />
2. Radius 1 km &amp; pulau baru.</p></div>`;

  it('reads the header and splits every section into its items', () => {
    expect(parseMagmaReport(page)).toEqual({
      title: 'Anak Krakatau, Sabtu - 31 Oktober 2026, periode 12:00-18:00 WIB',
      level: 'Level III (Siaga)',
      author: 'Muhammad Dika Nurzaman',
      image: 'https://magma.vsi.esdm.go.id/img/ga/KRA/KRA202610311200.png',
      sections: [
        { heading: 'Klimatologi', lines: ['Suhu udara sekitar 31-34.3°C.'] },
        { heading: 'Pengamatan Kegempaan', lines: ['6 kali gempa Hembusan.', '1 kali gempa Low Frequency.'] },
        { heading: 'Rekomendasi', lines: ['1. Radius 5 km.', '2. Radius 1 km & pulau baru.'] },
      ],
    });
  });

  it('takes an image only from an ESDM host', () => {
    const kra = 'https://magma.vsi.esdm.go.id/img/ga/KRA/KRA202610311200.png';
    for (const other of ['https://magma.esdm.go.id/storage/var/MER/MER202610311200.jpeg', 'https://vsi.esdm.go.id/command-center/api/files/af0289cb']) {
      expect(parseMagmaReport(page.replace(kra, other)).image).toBe(other);
    }
    expect(parseMagmaReport(page.replace('magma.vsi.esdm.go.id', 'evil.example')).image).toBeUndefined();
    expect(parseMagmaReport(page.replace('magma.vsi.esdm.go.id', 'esdm.go.id.evil.example')).image).toBeUndefined();
  });

  it('throws on a page that is not a report', () => {
    expect(() => parseMagmaReport('<html>Invalid signature.</html>')).toThrow();
  });
});
