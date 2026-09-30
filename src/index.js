/**
 * Wilayah Indonesia API
 * Data: Kepmendagri No 300.2.2-2430 Tahun 2025
 * Stack: Cloudflare Workers + D1
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function success(data, meta = {}) {
  return json({ success: true, data, meta });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

// --- Route handlers ---

async function getProvinsi(db) {
  const { results } = await db.prepare(
    `SELECT kode, kode_bps, nama, lat, lng FROM wilayah WHERE level = 1 ORDER BY kode`
  ).all();
  return success(results, { total: results.length });
}

async function getProvinsiDetail(db, kode) {
  const row = await db.prepare(
    `SELECT kode, kode_bps, nama, lat, lng FROM wilayah WHERE kode = ? AND level = 1`
  ).bind(kode).first();
  if (!row) return error('Provinsi tidak ditemukan', 404);
  return success(row);
}

async function getKabupaten(db, url) {
  const provinsi = url.searchParams.get('provinsi');
  if (!provinsi) return error('Parameter "provinsi" wajib diisi');
  const { results } = await db.prepare(
    `SELECT kode, kode_bps, nama, lat, lng FROM wilayah WHERE level = 2 AND parent_kode = ? ORDER BY kode`
  ).bind(provinsi).all();
  return success(results, { total: results.length, provinsi });
}

async function getKabupatenDetail(db, kode) {
  const row = await db.prepare(
    `SELECT w.kode, w.kode_bps, w.nama, w.lat, w.lng, p.nama as provinsi_nama, p.kode as provinsi_kode
     FROM wilayah w LEFT JOIN wilayah p ON w.parent_kode = p.kode
     WHERE w.kode = ? AND w.level = 2`
  ).bind(kode).first();
  if (!row) return error('Kabupaten/Kota tidak ditemukan', 404);
  return success(row);
}

async function getKecamatan(db, url) {
  const kabupaten = url.searchParams.get('kabupaten');
  if (!kabupaten) return error('Parameter "kabupaten" wajib diisi');
  const { results } = await db.prepare(
    `SELECT kode, kode_bps, nama, lat, lng FROM wilayah WHERE level = 3 AND parent_kode = ? ORDER BY kode`
  ).bind(kabupaten).all();
  return success(results, { total: results.length, kabupaten });
}

async function getKecamatanDetail(db, kode) {
  const row = await db.prepare(
    `SELECT w.kode, w.kode_bps, w.nama, w.lat, w.lng, 
            k.nama as kabupaten_nama, k.kode as kabupaten_kode,
            p.nama as provinsi_nama, p.kode as provinsi_kode
     FROM wilayah w 
     LEFT JOIN wilayah k ON w.parent_kode = k.kode
     LEFT JOIN wilayah p ON k.parent_kode = p.kode
     WHERE w.kode = ? AND w.level = 3`
  ).bind(kode).first();
  if (!row) return error('Kecamatan tidak ditemukan', 404);
  return success(row);
}

async function getKelurahan(db, url) {
  const kecamatan = url.searchParams.get('kecamatan');
  if (!kecamatan) return error('Parameter "kecamatan" wajib diisi');
  const { results } = await db.prepare(
    `SELECT kode, kode_bps, nama, lat, lng, kodepos FROM wilayah WHERE level = 4 AND parent_kode = ? ORDER BY kode`
  ).bind(kecamatan).all();
  return success(results, { total: results.length, kecamatan });
}

async function getKelurahanDetail(db, kode) {
  const row = await db.prepare(
    `SELECT w.kode, w.kode_bps, w.nama, w.lat, w.lng, w.kodepos,
            kec.nama as kecamatan_nama, kec.kode as kecamatan_kode,
            kab.nama as kabupaten_nama, kab.kode as kabupaten_kode,
            prov.nama as provinsi_nama, prov.kode as provinsi_kode
     FROM wilayah w
     LEFT JOIN wilayah kec ON w.parent_kode = kec.kode
     LEFT JOIN wilayah kab ON kec.parent_kode = kab.kode
     LEFT JOIN wilayah prov ON kab.parent_kode = prov.kode
     WHERE w.kode = ? AND w.level = 4`
  ).bind(kode).first();
  if (!row) return error('Kelurahan/Desa tidak ditemukan', 404);
  return success(row);
}

async function search(db, url) {
  const q = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const level = url.searchParams.get('level');
  
  if (!q || q.length < 2) return error('Parameter "q" minimal 2 karakter');
  
  let query = `SELECT kode, kode_bps, nama, level, parent_kode, lat, lng, kodepos FROM wilayah WHERE nama LIKE ?`;
  const params = [`%${q}%`];
  
  if (level) {
    query += ` AND level = ?`;
    params.push(parseInt(level));
  }
  
  query += ` ORDER BY level, nama LIMIT ?`;
  params.push(limit);
  
  const { results } = await db.prepare(query).bind(...params).all();
  return success(results, { total: results.length, query: q });
}

async function getByKodepos(db, kodepos) {
  const { results } = await db.prepare(
    `SELECT w.kode, w.kode_bps, w.nama, w.kodepos,
            kec.nama as kecamatan_nama,
            kab.nama as kabupaten_nama,
            prov.nama as provinsi_nama
     FROM wilayah w
     LEFT JOIN wilayah kec ON w.parent_kode = kec.kode
     LEFT JOIN wilayah kab ON kec.parent_kode = kab.kode
     LEFT JOIN wilayah prov ON kab.parent_kode = prov.kode
     WHERE w.kodepos = ? AND w.level = 4
     ORDER BY w.kode`
  ).bind(kodepos).all();
  if (results.length === 0) return error('Kode pos tidak ditemukan', 404);
  return success(results, { total: results.length, kodepos });
}

async function getStats(db) {
  const levels = [
    { level: 1, label: 'provinsi' },
    { level: 2, label: 'kabupaten_kota' },
    { level: 3, label: 'kecamatan' },
    { level: 4, label: 'kelurahan_desa' },
  ];
  const stats = {};
  for (const { level, label } of levels) {
    const row = await db.prepare('SELECT COUNT(*) as total FROM wilayah WHERE level = ?').bind(level).first();
    stats[label] = row.total;
  }
  return success({
    ...stats,
    sumber: 'Kepmendagri No 300.2.2-2430 Tahun 2025',
    repo: 'https://github.com/cahyadsn/wilayah',
  });
}

function getDocs() {
  return success({
    name: 'Wilayah Indonesia API',
    version: '1.0.0',
    description: 'API data wilayah administrasi Indonesia (Kepmendagri 2025)',
    endpoints: {
      'GET /': 'Dokumentasi API',
      'GET /stats': 'Statistik jumlah data',
      'GET /provinsi': 'Daftar seluruh provinsi',
      'GET /provinsi/:kode': 'Detail provinsi (contoh: /provinsi/62)',
      'GET /kabupaten?provinsi=:kode': 'Daftar kab/kota di provinsi (contoh: ?provinsi=62)',
      'GET /kabupaten/:kode': 'Detail kab/kota (contoh: /kabupaten/62.71)',
      'GET /kecamatan?kabupaten=:kode': 'Daftar kecamatan di kab/kota (contoh: ?kabupaten=62.71)',
      'GET /kecamatan/:kode': 'Detail kecamatan (contoh: /kecamatan/62.71.01)',
      'GET /kelurahan?kecamatan=:kode': 'Daftar kel/desa di kecamatan (contoh: ?kecamatan=62.71.01)',
      'GET /kelurahan/:kode': 'Detail kel/desa (contoh: /kelurahan/62.71.01.1001)',
      'GET /search?q=:query&limit=20&level=1-4': 'Cari wilayah berdasarkan nama',
      'GET /kodepos/:kode': 'Cari wilayah berdasarkan kode pos',
    },
    notes: {
      kode_format: 'Kode Kemendagri dengan titik (62.71.01.1001)',
      kode_bps: 'Kode tanpa titik (6271011001) untuk kemudahan integrasi',
      level: '1=Provinsi, 2=Kab/Kota, 3=Kecamatan, 4=Kel/Desa',
      koordinat: 'Tersedia untuk level provinsi dan kabupaten/kota',
      kodepos: 'Tersedia untuk level kelurahan/desa',
    },
  });
}

// --- Router ---

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return error('Method not allowed', 405);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const db = env.DB;

    try {
      // Static routes
      if (path === '/') return getDocs();
      if (path === '/stats') return getStats(db);
      if (path === '/provinsi') return getProvinsi(db);
      if (path === '/search') return search(db, url);

      // Parameterized routes
      const segments = path.split('/').filter(Boolean);

      if (segments[0] === 'provinsi' && segments.length === 2) {
        return getProvinsiDetail(db, segments[1]);
      }

      if (segments[0] === 'kabupaten') {
        if (segments.length === 1) return getKabupaten(db, url);
        return getKabupatenDetail(db, segments[1]);
      }

      if (segments[0] === 'kecamatan') {
        if (segments.length === 1) return getKecamatan(db, url);
        return getKecamatanDetail(db, segments[1]);
      }

      if (segments[0] === 'kelurahan') {
        if (segments.length === 1) return getKelurahan(db, url);
        return getKelurahanDetail(db, segments[1]);
      }

      if (segments[0] === 'kodepos' && segments.length === 2) {
        return getByKodepos(db, segments[1]);
      }

      return error('Endpoint tidak ditemukan. Buka / untuk dokumentasi.', 404);
    } catch (e) {
      return error(`Internal server error: ${e.message}`, 500);
    }
  },
};
