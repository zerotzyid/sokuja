/**
 * GET /agent
 *
 * Machine-readable manifest untuk AI agent yang ingin membangun aplikasi
 * di atas REST API ini. Berisi: overview arsitektur, daftar route,
 * parameter, format response, contoh pemakaian, dan cara kerja sistem.
 *
 * Static JSON — tidak butuh Node.js runtime, aman di Edge.
 */

const MANIFEST = {
  name: 'Z-SCRAPE Sokuja API',
  version: '1.0.0',
  description:
    'REST API publik untuk data anime dari sokuja.uk (update terbaru, ongoing, completed, genre, search, jadwal, detail, episode + link stream/download MP4 langsung). Tanpa API key, tanpa login.',
  baseUrl: 'https://rino-eosin.vercel.app',
  language: 'id',

  auth: {
    required: false,
    note: 'Semua endpoint publik Vercel bebas diakses (CORS *). API key HANYA dipakai internal server-to-server (Vercel -> Cloudflare Worker via header X-API-Key). Client TIDAK PERNAH memanggil Worker langsung.'
  },

  architecture: {
    summary:
      'Vercel = scraper utama (fetch HTML + parsing cheerio). Cloudflare Worker = mirror/proxy saja (bypass proteksi Cloudflare & IP block Vercel).',
    flow: [
      '1. Client (mis. aplikasi Android) hanya memanggil https://rino-eosin.vercel.app/api/*',
      '2. Vercel mengambil HTML mentah dari Worker endpoint /proxy/html/* (Worker meneruskan request ke sokuja.uk dengan header browser).',
      '3. Vercel mem-parsing HTML dengan cheerio (pola dari referensi ERASDOCU) lalu mengembalikan JSON.',
      '4. Untuk stream video: Vercel memanggil Worker /proxy/api/api/video-mirrors?e={episodeId} untuk mendapat URL MP4 langsung di storages.sokuja.uk.',
      '5. Client memutar URL MP4 langsung (support HTTP Range/seek). Endpoint /api/proxy/stream/* hanya fallback bila akses langsung gagal.'
    ],
    components: {
      vercel: 'Next.js 14 App Router (Node.js runtime). Scraper + cache file di /tmp + enrichment AniList di endpoint detail.',
      worker: 'Cloudflare Worker single-file (cf-worker/index.js). TIDAK ada logic scraping — hanya 3 proxy: /proxy/html/*, /proxy/api/*, /proxy/stream/* + /health. Privat, butuh X-API-Key.',
      workerUrl: 'https://otakuproxy.azizkalimorgo.workers.dev'
    }
  },

  conventions: {
    envelopes: [
      {
        name: 'sokuja',
        usedBy: 'Kebanyakan endpoint Vercel (/api/anime/*, /api/genres)',
        shape: '{ status: "success", author: "Z-SCRAPE", message: string, timestamp: ISOString, data: object }'
      },
      {
        name: 'worker',
        usedBy: 'Endpoint Worker langsung (tidak untuk client publik)',
        shape: '{ creator: "Z-SCRAPE", statusCode: 200, ok: true, message: string, data: object, pagination?: object }'
      }
    ],
    errors: '{ status: "error", author: "Z-SCRAPE", message: string, timestamp: ISOString } dengan HTTP status yang sesuai (400 validasi, 404 tidak ketemu, 500 upstream gagal).',
    slugs: {
      anime: 'Slug anime SELALU menyertakan akhiran "-subtitle-indonesia", cth: "tensei-shitara-slime-datta-ken-season-4". Untuk endpoint detail Vercel, kirim slug TANPA akhiran itu bila dokumentasi contoh menunjukkannya — route Vercel menambahkan sendiri. Aman: ikuti contoh di tiap route.',
      episode: 'Slug episode SELALU menyertakan akhiran "-subtitle-indonesia", cth: "tensei-shitara-slime-datta-ken-season-4-episode-24-subtitle-indonesia". Kirim apa adanya.'
    },
    caching: 'Response Vercel di-cache di edge (s-maxage=300, stale-while-revalidate=600). Data list segar ~5 menit. Jangan polling agresif.',
    rateLimit: 'Worker membatasi 100 req/menit per IP (server-to-server, bukan limit client). Gunakan response cache, jangan spam.'
  },

  routes: [
    {
      path: '/api/anime/home',
      method: 'GET',
      description: 'Beranda: 18 episode terbaru + 10 anime populer + daftar tahun arsip.',
      params: [],
      example: 'GET /api/anime/home',
      response: 'data: { totalLatest, latest[{title, slug, episodeNumber, url, thumbnail}], popular[{rank, title, type, status, year, score, views, slug, thumbnail}], seasons[{year}] }'
    },
    {
      path: '/api/anime/ongoing',
      method: 'GET',
      description: 'Daftar anime ongoing (sedang tayang).',
      params: [{ name: 'page', in: 'query', required: false, default: 1, example: '?page=2' }],
      example: 'GET /api/anime/ongoing?page=1',
      response: 'data: { total, list[{title, slug, url, type, thumbnail}] }'
    },
    {
      path: '/api/anime/completed',
      method: 'GET',
      description: 'Daftar anime completed (tamat).',
      params: [{ name: 'page', in: 'query', required: false, default: 1, example: '?page=2' }],
      example: 'GET /api/anime/completed?page=1',
      response: 'data: { total, list[{title, slug, url, type, thumbnail}] }'
    },
    {
      path: '/api/anime/genre',
      method: 'GET',
      description: 'Daftar anime berdasarkan genre.',
      params: [
        { name: 'slug', in: 'query', required: true, example: '?slug=action' },
        { name: 'page', in: 'query', required: false, default: 1 }
      ],
      example: 'GET /api/anime/genre?slug=action&page=1',
      response: 'data: { filters, total, list[{title, slug, url, type, thumbnail}] }'
    },
    {
      path: '/api/anime/search',
      method: 'GET',
      description: 'Cari anime berdasarkan kata kunci.',
      params: [
        { name: 'q', in: 'query', required: true, example: '?q=one+piece' },
        { name: 'page', in: 'query', required: false, default: 1 }
      ],
      example: 'GET /api/anime/search?q=one+piece',
      response: 'data: { filters, total, list[{title, slug, url, type, thumbnail}] }'
    },
    {
      path: '/api/anime/schedule',
      method: 'GET',
      description: 'Jadwal rilis anime per hari (Senin–Minggu).',
      params: [],
      example: 'GET /api/anime/schedule',
      response: 'data: { schedule: { Senin: [{title, slug, url, time, thumbnail}], ... } }'
    },
    {
      path: '/api/anime/filter',
      method: 'GET',
      description: 'Filter daftar anime (status/type/order/page).',
      params: [
        { name: 'status', in: 'query', required: false, default: 'ongoing', example: 'ongoing|completed' },
        { name: 'type', in: 'query', required: false, default: '', example: 'tv|movie' },
        { name: 'order', in: 'query', required: false, default: 'update', example: 'update' },
        { name: 'page', in: 'query', required: false, default: 1 }
      ],
      example: 'GET /api/anime/filter?status=ongoing&type=tv&order=update&page=1',
      response: 'data: { filters, total, list[{title, slug, url, type, thumbnail}] }'
    },
    {
      path: '/api/anime/list-mode',
      method: 'GET',
      description: 'Katalog anime A–Z.',
      params: [],
      example: 'GET /api/anime/list-mode',
      response: 'data: { alphabet: ["A", ...], catalog: { A: [{title, slug, url}], ... } }'
    },
    {
      path: '/api/genres',
      method: 'GET',
      description: 'Daftar semua genre yang tersedia.',
      params: [],
      example: 'GET /api/genres',
      response: 'data: { total, genres[{name, slug, url}] }'
    },
    {
      path: '/api/anime/detail/{slug}',
      method: 'GET',
      description: 'Detail anime + daftar episode, diperkaya data AniList (judul romaji/english/native, sinopsis bersih, skor, studio, staff, karakter, relasi).',
      params: [{ name: 'slug', in: 'path', required: true, example: 'tensei-shitara-slime-datta-ken-season-4' }],
      example: 'GET /api/anime/detail/tensei-shitara-slime-datta-ken-season-4',
      response: 'data: { title, titleRomaji, titleEnglish, titleNative, poster, synopsis, genres[], score, status, type, year, season, studio, cast[], totalEpisodes, episodes[{number, title, slug, url}], anilist:{id, score, status, totalEpisodes, coverImage, bannerImage, studios[], staff[], characters[], relations[], externalLinks[]} }',
      notes: 'Jika AniList tidak ketemu, field anilist = null dan data Sokuja tetap dikembalikan.'
    },
    {
      path: '/api/anime/episode/{slug}',
      method: 'GET',
      description: 'Detail episode + link STREAM MP4 langsung (480p/720p/1080p) + link download + navigasi prev/next.',
      params: [{ name: 'slug', in: 'path', required: true, example: 'tensei-shitara-slime-datta-ken-season-4-episode-24-subtitle-indonesia' }],
      example: 'GET /api/anime/episode/tensei-shitara-slime-datta-ken-season-4-episode-24-subtitle-indonesia',
      response: 'data: { title, slug, episodeId, anime{title, slug, url}, thumbnail, uploadDate, views, navigation{prev, next, allEpisodes}, mirrors[{id, server, quality, type, url, source, direct}], downloads[{quality, link}] }',
      notes: 'mirrors[].url adalah MP4 langsung di storages.sokuja.uk — putar langsung di player, support HTTP Range (seek). downloads[].link adalah mirror sokuja.id.'
    },
    {
      path: '/api/proxy/stream/{encodedTargetUrl}',
      method: 'GET',
      description: 'Fallback proxy video via Worker (meneruskan header Range). Hanya dipakai bila URL MP4 langsung tidak bisa diakses client.',
      params: [{ name: 'encodedTargetUrl', in: 'path', required: true, example: '/api/proxy/stream/https%3A%2F%2Fstorages.sokuja.uk%2F...%2Fvideo-720p-xxx.mp4' }],
      example: 'GET /api/proxy/stream/https%3A%2F%2Fstorages.sokuja.uk%2F...mp4 (dengan header Range untuk seek)',
      response: 'Binary video/mp4 dengan header Accept-Ranges, Content-Range. Bukan JSON.'
    }
  ],

  playerGuide: {
    for: 'Aplikasi Android (ExoPlayer/Media3) atau web player',
    steps: [
      '1. Panggil GET /api/anime/episode/{slug} untuk dapat mirrors[].',
      '2. Pilih quality (mulai dari 480p untuk start cepat, naikkan ke 720p/1080p setelah buffer).',
      '3. Putar mirrors[].url langsung dengan header Referer: https://x6.sokuja.uk/ dan User-Agent browser.',
      '4. Aktifkan disk cache player (±500MB) agar seek instan dan hemat kuota.',
      '5. Bila direct 403/404: fallback ke GET /api/proxy/stream/{encodeURIComponent(mirrors[].url)} dengan header Range diteruskan.',
      '6. Prefetch: saat user melihat list, prefetch detail + episode untuk 3 item berikutnya.'
    ]
  },

  quickstart: [
    'curl https://rino-eosin.vercel.app/api/anime/home',
    'curl "https://rino-eosin.vercel.app/api/anime/search?q=one+piece"',
    'curl https://rino-eosin.vercel.app/api/anime/detail/tensei-shitara-slime-datta-ken-season-4',
    'curl https://rino-eosin.vercel.app/api/anime/episode/tensei-shitara-slime-datta-ken-season-4-episode-24-subtitle-indonesia'
  ],

  workerEndpointsInternal: {
    note: 'Hanya untuk server (butuh header X-API-Key). JANGAN dipanggil dari client/aplikasi.',
    endpoints: [
      'GET /health -> { status: "ok", timestamp }',
      'GET /proxy/html/{encodedPath} -> HTML mentah sokuja.uk (bypass Cloudflare)',
      'GET /proxy/api/{encodedPath} -> JSON API internal sokuja.uk (cth. /api/video-mirrors?e=10854)',
      'GET /proxy/stream/{encodedUrl} -> binary video dengan Range support'
    ]
  }
};

export async function GET() {
  return Response.json(MANIFEST, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
