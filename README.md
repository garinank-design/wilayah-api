# Wilayah Indonesia API

API data wilayah administrasi Indonesia berdasarkan **Kepmendagri No 300.2.2-2430 Tahun 2025**.

## Data

| Level | Jumlah | Koordinat | Kode Pos |
|---|---|---|---|
| Provinsi | 38 | ✅ | - |
| Kabupaten/Kota | 514 | ✅ | - |
| Kecamatan | 7.265 | ❌ | - |
| Kelurahan/Desa | 83.345 | ❌ | ✅ |

## Stack

- **Runtime**: Cloudflare Workers (free tier: 100rb request/hari)
- **Database**: Cloudflare D1 (SQLite di edge)
- **Biaya**: Gratis

## Deploy

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Buat D1 Database

```bash
wrangler d1 create wilayah-db
```

Copy `database_id` yang muncul, paste ke `wrangler.toml`.

### 3. Import Data

```bash
wrangler d1 execute wilayah-db --remote --file=migrations/0001_init.sql
```

> File migration ~6.5 MB, proses import butuh beberapa menit.
> Jika timeout, split file dan jalankan per bagian:
>
> ```bash
> split -l 5000 migrations/0001_init.sql migrations/part_
> for f in migrations/part_*; do
>   wrangler d1 execute wilayah-db --remote --file="$f"
> done
> ```

### 4. Deploy Worker

```bash
npm install
wrangler deploy
```

Worker akan live di `https://wilayah-api.<subdomain>.workers.dev`

## Custom Domain (opsional)

Tambahkan di `wrangler.toml`:

```toml
routes = [
  { pattern = "api.wilayah.yourdomain.com", custom_domain = true }
]
```

## Endpoints

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | Dokumentasi API |
| GET | `/stats` | Statistik jumlah data |
| GET | `/provinsi` | Semua provinsi |
| GET | `/provinsi/:kode` | Detail provinsi |
| GET | `/kabupaten?provinsi=:kode` | Kab/kota di provinsi |
| GET | `/kabupaten/:kode` | Detail kab/kota |
| GET | `/kecamatan?kabupaten=:kode` | Kecamatan di kab/kota |
| GET | `/kecamatan/:kode` | Detail kecamatan |
| GET | `/kelurahan?kecamatan=:kode` | Kel/desa di kecamatan |
| GET | `/kelurahan/:kode` | Detail kel/desa |
| GET | `/search?q=palangka&limit=20` | Pencarian nama wilayah |
| GET | `/kodepos/:kode` | Cari berdasarkan kode pos |

### Contoh Response

```json
GET /kabupaten/62.71

{
  "success": true,
  "data": {
    "kode": "62.71",
    "kode_bps": "6271",
    "nama": "Kota Palangka Raya",
    "lat": -2.2161,
    "lng": 113.9135,
    "provinsi_kode": "62",
    "provinsi_nama": "Kalimantan Tengah"
  }
}
```

### Cascading Dropdown (Frontend)

```javascript
// 1. Load provinsi
const prov = await fetch('/provinsi').then(r => r.json());

// 2. User pilih provinsi → load kabupaten
const kab = await fetch('/kabupaten?provinsi=62').then(r => r.json());

// 3. User pilih kabupaten → load kecamatan
const kec = await fetch('/kecamatan?kabupaten=62.71').then(r => r.json());

// 4. User pilih kecamatan → load kelurahan
const kel = await fetch('/kelurahan?kecamatan=62.71.01').then(r => r.json());
```

## Sumber Data

- [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) — Kode wilayah administrasi
- [cahyadsn/wilayah_kodepos](https://github.com/cahyadsn/wilayah_kodepos) — Kode pos
- Koordinat: centroid polygon dari data boundaries

## Lisensi

Data: sesuai lisensi sumber (MIT). Kode API: MIT.
