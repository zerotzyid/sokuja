const SOKUJA_BASE = 'https://x6.sokuja.uk';
const VALID_API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';
const CACHE_TTL = { list: 300, detail: 1800, episode: 600, schedule: 3600 };

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': SOKUJA_BASE + '/',
  'Origin': SOKUJA_BASE,
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const memoryCache = new Map();
const rateLimitMap = new Map();

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...init.headers }
  });
}

function error(message, status = 400) {
  return json({ ok: false, creator: 'Z-SCRAPE', statusCode: status, message }, { status });
}

function authCheck(req) {
  const key = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
  return key === VALID_API_KEY;
}

async function fetchWithCache(url, ttl) {
  const now = Date.now();
  const cached = memoryCache.get(url);
  if (cached && now - cached.time < ttl * 1000) return { html: cached.html, cached: true };

  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  memoryCache.set(url, { html, time: now });
  if (memoryCache.size > 500) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  return { html, cached: false };
}

function buildResponse(data, pagination = null) {
  const res = { creator: 'Z-SCRAPE', statusCode: 200, ok: true, message: '', data };
  if (pagination) res.pagination = pagination;
  return res;
}

function parseAnimeList(html) {
  const items = [];
  const linkRegex = /<a[^>]*href="(\/anime\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];
    const titleMatch = inner.match(/<p[^>]*class="[^"]*line-clamp-2[^"]*"[^>]*>([^<]+)<\/p>/);
    const typeMatch = inner.match(/<p[^>]*class="[^"]*text-gray-400[^"]*"[^>]*>([^<]+)<\/p>/);
    const thumbMatch = inner.match(/<img[^>]*src="([^"]+)"[^>]*>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    if (!title) continue;
    const slug = href.split('/anime/')[1]?.replace(/\/$/, '') || href.split('/').filter(Boolean).pop();
    items.push({
      title,
      poster: thumbMatch ? (thumbMatch[1].startsWith('http') ? thumbMatch[1] : new URL(thumbMatch[1], SOKUJA_BASE).href) : null,
      type: typeMatch ? typeMatch[1].trim() : null,
      animeId: slug,
      href: `/anime/detail/${slug}`,
      sourceUrl: new URL(href, SOKUJA_BASE).href
    });
  }
  return items;
}

function parseDetail(html) {
  const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim() || '';
  const poster = (html.match(/<img[^>]*class="[^"]*poster[^"]*"[^>]*src="([^"]+)"/) || [])[1] || '';
  const synopsis = (html.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';

  const genres = [];
  const genreRegex = /<a[^>]*href="\/genre\/[^"]+"[^>]*>([^<]+)<\/a>/g;
  let gMatch;
  while ((gMatch = genreRegex.exec(html)) !== null) genres.push(gMatch[1].trim());

  const eps = [];
  const epRegex = /<a[^>]*href="(\/[^"]*episode[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((gMatch = epRegex.exec(html)) !== null) {
    const epTitle = gMatch[2].replace(/<[^>]+>/g, '').trim();
    const slug = gMatch[1].split('/').filter(Boolean).pop();
    if (epTitle && slug) eps.push({ title: epTitle, episodeId: slug, href: `/anime/episode/${slug}`, sourceUrl: new URL(gMatch[1], SOKUJA_BASE).href });
  }
  return { title, poster: poster.startsWith('http') ? poster : new URL(poster, SOKUJA_BASE).href, synopsis, genres, episodes: eps };
}

function parseEpisode(html) {
  const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim() || '';
  const streams = [];
  const downloads = [];

  const mp4Regex = /https:\/\/storages\.sokuja\.uk\/[^"'\s]+\.mp4/g;
  let urls = html.match(mp4Regex) || [];
  urls = [...new Set(urls)];

  for (const url of urls) {
    const qMatch = url.match(/-(\d{3,4}p)-/i);
    const quality = qMatch ? qMatch[1].toUpperCase() : 'AUTO';
    streams.push({ quality, url, direct: true, server: 'storages' });
  }

  const mirrorRegex = /<a[^>]*href="(https?:\/\/[^"]*(?:gdrive|drive\.google|mirrorace|mega\.nz|mediafire)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((gMatch = mirrorRegex.exec(html)) !== null) {
    const q = gMatch[2].match(/(\d{3,4}p)/i);
    downloads.push({ quality: q ? q[1].toUpperCase() : '720p', url: gMatch[1], direct: false, mirror: gMatch[1].includes('drive.google') ? 'gdrive' : gMatch[1].includes('mirrorace') ? 'mirrorace' : 'other' });
  }

  const uniq = (arr) => Array.from(new Map(arr.map(x => [x.quality + x.url, x])).values());
  const sortQual = (a, b) => parseInt(b.quality) - parseInt(a.quality);

  return { title, stream: uniq(streams).sort(sortQual), download: uniq(downloads).sort(sortQual) };
}

function parseSchedule(html) {
  const schedule = { Senin: [], Selasa: [], Rabu: [], Kamis: [], Jumat: [], Sabtu: [], Minggu: [] };
  const dayBlocks = html.split(/<div[^>]*class="[^"]*schedule-day[^"]*"[^>]*>/).slice(1);
  for (const block of dayBlocks) {
    const dayMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>|<h4[^>]*>([^<]+)<\/h4>/);
    const day = (dayMatch?.[1] || dayMatch?.[2] || '').trim();
    const key = Object.keys(schedule).find(k => day.toLowerCase().includes(k.toLowerCase()));
    if (!key) continue;
    const linkRegex = /<a[^>]*href="(\/anime\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = linkRegex.exec(block)) !== null) {
      const slug = m[1].split('/anime/')[1]?.replace(/\/$/, '');
      schedule[key].push({ title: m[2].trim(), href: `/anime/detail/${slug}`, sourceUrl: new URL(m[1], SOKUJA_BASE).href });
    }
  }
  return schedule;
}

function extractPagination(html) {
  const current = parseInt((html.match(/<span[^>]*class="[^"]*active[^"]*"[^>]*>(\d+)<\/span>/) || [])[1] || '1');
  const lastPage = parseInt((html.match(/<a[^>]*href="[^"]*page=(\d+)[^"]*"[^>]*>(\d+)<\/a>/) || [])[2] || current + 1);
  return { currentPage: current, hasPrevPage: current > 1, prevPage: current > 1 ? current - 1 : null, hasNextPage: current < lastPage, nextPage: current < lastPage ? current + 1 : null, totalPages: lastPage };
}

async function handleScrape(req, path, params) {
  if (!authCheck(req)) return error('Unauthorized', 401);

  let url, ttl, parser;
  switch (path) {
    case 'home':
      url = SOKUJA_BASE + '/'; ttl = CACHE_TTL.list; parser = parseAnimeList; break;
    case 'ongoing':
      url = `${SOKUJA_BASE}/anime/?status=ongoing&order=update${params.page ? `&page=${params.page}` : ''}`; ttl = CACHE_TTL.list; parser = parseAnimeList; break;
    case 'completed':
      url = `${SOKUJA_BASE}/anime/?status=completed&order=update${params.page ? `&page=${params.page}` : ''}`; ttl = CACHE_TTL.list; parser = parseAnimeList; break;
    case 'genre':
      url = `${SOKUJA_BASE}/genre/${params.slug}/${params.page ? `?page=${params.page}` : ''}`; ttl = CACHE_TTL.list; parser = parseAnimeList; break;
    case 'search':
      url = `${SOKUJA_BASE}/?s=${encodeURIComponent(params.kw)}${params.page ? `&page=${params.page}` : ''}`; ttl = CACHE_TTL.list; parser = parseAnimeList; break;
    case 'schedule':
      url = `${SOKUJA_BASE}/jadwal-rilis-anime/`; ttl = CACHE_TTL.schedule; parser = parseSchedule; break;
    case 'detail':
      url = `${SOKUJA_BASE}/anime/${params.slug}/`; ttl = CACHE_TTL.detail; parser = parseDetail; break;
    case 'episode':
      url = `${SOKUJA_BASE}/${params.slug}/`; ttl = CACHE_TTL.episode; parser = parseEpisode; break;
    default:
      return error('Unknown scrape endpoint', 404);
  }

  try {
    const { html } = await fetchWithCache(url, ttl);
    const data = parser(html);
    if (path === 'schedule') return json(buildResponse(data));
    const pagination = ['home','ongoing','completed','genre','search'].includes(path) ? extractPagination(html) : null;
    return json(buildResponse(data, pagination));
  } catch (e) {
    console.error('Scrape error:', e);
    return error(e.message, 500);
  }
}

async function handleProxy(req, targetUrl) {
  if (!authCheck(req)) return error('Unauthorized', 401);

  try {
    const range = req.headers.get('Range');
    const ifRange = req.headers.get('If-Range');
    const headers = {
      ...BROWSER_HEADERS,
      'Accept': '*/*',
      'Referer': SOKUJA_BASE + '/',
      ...(range && { Range: range }),
      ...(ifRange && { 'If-Range': ifRange }),
    };
    const res = await fetch(targetUrl, { headers, redirect: 'manual' });
    if (!res.ok && res.status !== 206) return error(`Upstream error: ${res.status}`, res.status);

    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range, Content-Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': res.headers.get('Content-Type') || 'video/mp4',
    });
    if (res.headers.has('Content-Length')) responseHeaders.set('Content-Length', res.headers.get('Content-Length'));
    if (res.headers.has('Content-Range')) responseHeaders.set('Content-Range', res.headers.get('Content-Range'));

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  } catch (e) {
    console.error('Proxy error:', e);
    return error(e.message, 500);
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const limit = 100;
  const key = `rl:${ip}`;
  const data = rateLimitMap.get(key) || { count: 0, windowStart: now };
  if (now - data.windowStart > windowMs) {
    data.count = 0;
    data.windowStart = now;
  }
  data.count++;
  rateLimitMap.set(key, data);
  if (rateLimitMap.size > 10000) {
    const firstKey = rateLimitMap.keys().next().value;
    rateLimitMap.delete(firstKey);
  }
  return data.count <= limit;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Range', 'Access-Control-Max-Age': '86400' } });
    }

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) return error('Rate limit exceeded (100 req/min)', 429);

    const url = new URL(req.url);
    const path = url.pathname.slice(1);

    if (path.startsWith('scrape/')) {
      const parts = path.split('/');
      const endpoint = parts[1];
      const params = { page: url.searchParams.get('page'), slug: parts[2], kw: parts[2] };
      return handleScrape(req, endpoint, params);
    }

    if (path.startsWith('proxy/stream/')) {
      const target = decodeURIComponent(path.replace('proxy/stream/', ''));
      return handleProxy(req, target);
    }

    if (path === 'health') {
      return json({ status: 'ok', timestamp: Date.now(), cacheSize: memoryCache.size });
    }

    return error('Not found', 404);
  }
};