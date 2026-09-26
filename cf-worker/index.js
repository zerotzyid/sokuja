const SOKUJA_BASE = 'https://x6.sokuja.uk';
const VALID_API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';
const CACHE_TTL = { list: 300, detail: 1800, episode: 600, schedule: 3600 };
const WORKER_VERSION = '2024-09-26-v2';

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

function extractJsonLd(html) {
  const results = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      results.push(data);
    } catch (e) {}
  }
  return results;
}

function extractNextData(html) {
  const results = [];
  const regex = /self\.__next_f\.push\(\[1,"([^"]+)"\]\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let jsonStr = match[1];
    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\\//g, '/');
    try {
      const data = JSON.parse(jsonStr);
      results.push(data);
    } catch (e) {}
  }
  return results;
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
  const jsonLd = extractJsonLd(html);
  const nextData = extractNextData(html);
  
  let title = '', poster = '', synopsis = '', genres = [], episodes = [];

  // From JSON-LD TVSeries
  for (const ld of jsonLd) {
    if (ld['@type'] === 'TVSeries') {
      title = ld.name || '';
      poster = ld.image || '';
      synopsis = ld.description || '';
      genres = ld.genre || [];
      break;
    }
  }

  // Fallback from meta tags
  if (!title) {
    const ogTitle = html.match(/property="og:title" content="([^"]+)"/);
    if (ogTitle) title = ogTitle[1].replace(' Sub Indo', '').replace(' Subtitle Indonesia', '').trim();
  }
  if (!poster) {
    const ogImage = html.match(/property="og:image" content="([^"]+)"/);
    if (ogImage) poster = ogImage[1];
  }
  if (!synopsis) {
    const desc = html.match(/name="description" content="([^"]+)"/);
    if (desc) synopsis = desc[1];
  }

  // Episodes from Next.js data
  for (const data of nextData) {
    if (data && data.episodes && Array.isArray(data.episodes)) {
      episodes = data.episodes.map(ep => ({
        title: ep.title || `Episode ${ep.episodeNumber}`,
        episodeId: ep.slug,
        href: `/anime/episode/${ep.slug}`,
        sourceUrl: new URL(ep.slug, SOKUJA_BASE).href
      }));
      break;
    }
  }

  return { title, poster: poster.startsWith('http') ? poster : (poster ? new URL(poster, SOKUJA_BASE).href : ''), synopsis, genres, episodes };
}

async function parseEpisode(html, env) {
  const jsonLd = extractJsonLd(html);
  const nextData = extractNextData(html);
  
  let title = '';
  const streams = [];
  const downloads = [];

  // From JSON-LD TVEpisode
  for (const ld of jsonLd) {
    if (ld['@type'] === 'TVEpisode') {
      title = ld.name || '';
      break;
    }
  }

  // Fallback from meta tags
  if (!title) {
    const ogTitle = html.match(/property="og:title" content="([^"]+)"/);
    if (ogTitle) title = ogTitle[1].replace(' Sub Indo', '').replace(' Subtitle Indonesia', '').trim();
  }

  // Download links from Next.js data (Download component)
  for (const data of nextData) {
    if (data && data.children && Array.isArray(data.children)) {
      const findDownloadLinks = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.href && typeof obj.href === 'string' && obj.href.includes('sokuja.id/x.php')) {
          const qualityMatch = obj.href.match(/[?&]q=([^&]+)/) || obj.children?.[0]?.children?.[0]?.match(/(\d{3,4}p)/);
          const quality = qualityMatch ? qualityMatch[1].toUpperCase() : '720p';
          downloads.push({ quality, url: obj.href, direct: false, mirror: 'sokuja' });
        }
        for (const key of Object.keys(obj)) {
          findDownloadLinks(obj[key]);
        }
      };
      findDownloadLinks(data);
    }
  }

  // Also search for download links in the raw HTML
  const downloadRegex = /href="(https:\/\/sokuja\.id\/x\.php\?y=[^"]+)"[^>]*>(?:<[^>]+>)*\s*(\d{3,4}p)\s*(?:<[^>]+>)*/gi;
  let dlMatch;
  while ((dlMatch = downloadRegex.exec(html)) !== null) {
    const quality = dlMatch[2].toUpperCase();
    downloads.push({ quality, url: dlMatch[1], direct: false, mirror: 'sokuja' });
  }

  // ============ STREAM EXTRACTION (ERASDOCU approach) ============
  // 1. Try to get episodeId and call Sokuja's internal API
  const epIdMatch = html.match(/episodeId[^\d]{1,10}(\d+)/i);
  const episodeId = epIdMatch ? parseInt(epIdMatch[1], 10) : null;

  if (episodeId) {
    try {
      const apiUrl = `${SOKUJA_BASE}/api/video-mirrors?e=${episodeId}`;
      const res = await fetch(apiUrl, {
        headers: {
          ...BROWSER_HEADERS,
          'Referer': SOKUJA_BASE + '/',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mirrors && Array.isArray(data.mirrors)) {
          data.mirrors.forEach(m => {
            streams.push({
              id: m.id,
              server: m.serverName || 'SOKUJA',
              quality: m.quality || 'auto',
              type: m.embedType || 'hls',
              url: m.embedUrl,
              source: 'api',
              direct: true
            });
          });
        }
      }
    } catch (e) {
      console.error('Stream API error:', e);
    }
  }

  // 2. Fallback: scrape stream URLs from HTML (regex patterns from ERASDOCU)
  const patterns = [
    /"url"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /"file"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /"src"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /source\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)["']/gi,
    /video\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)["']/gi,
    /https?:\/\/[^\s"']+\.(m3u8|mp4)/gi
  ];

  const scrapedStreams = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1] || match[0];
        if (url && url.startsWith('http') && !url.includes('google') && !url.includes('doubleclick')) {
          const qMatch = url.match(/-(\d{3,4}p)-/i);
          const quality = qMatch ? qMatch[1].toUpperCase() : 
                         url.includes('1080') ? '1080p' : 
                         url.includes('720') ? '720p' : 
                         url.includes('480') ? '480p' : 'auto';
          scrapedStreams.push({
            url,
            quality,
            type: url.includes('.m3u8') ? 'hls' : 'mp4',
            server: 'Scraped',
            source: 'html'
          });
        }
      }
    });
  }

  // 3. Add scraped streams
  streams.push(...scrapedStreams);

  // 4. If no streams found, add a marker for proxy fallback
  if (streams.length === 0) {
    const episodeUrl = (html.match(/property="og:url" content="([^"]+)"/) || [])[1] || '';
    if (episodeUrl) {
      streams.push({
        episodeUrl,
        server: 'proxy',
        source: 'proxy',
        needsProxy: true
      });
    }
  }

  const uniq = (arr) => Array.from(new Map(arr.map(x => [x.quality + x.url, x])).values());
  const sortQual = (a, b) => {
    const qa = parseInt(a.quality) || 0;
    const qb = parseInt(b.quality) || 0;
    return qb - qa;
  };

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
      url = `${SOKUJA_BASE}/anime/${params.slug}-subtitle-indonesia/`; ttl = CACHE_TTL.detail; parser = parseDetail; break;
    case 'episode':
      url = `${SOKUJA_BASE}/${params.slug}/`; ttl = CACHE_TTL.episode; parser = parseEpisode; break;
    default:
      return error('Unknown scrape endpoint', 404);
  }

  try {
    const { html } = await fetchWithCache(url, ttl);
    const data = await parser(html, env);
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

    if (path.startsWith('stream/')) {
      if (!authCheck(req)) return error('Unauthorized', 401);
      const parts = path.split('/');
      const episodeId = parts[1];
      if (!episodeId) return error('episodeId required', 400);
      
      try {
        const apiUrl = `${SOKUJA_BASE}/api/video-mirrors?e=${episodeId}`;
        const res = await fetch(apiUrl, {
          headers: {
            ...BROWSER_HEADERS,
            'Referer': SOKUJA_BASE + '/',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          }
        });
        if (!res.ok) return error(`Upstream error: ${res.status}`, res.status);
        const data = await res.json();
        return json(buildResponse({ episodeId, mirrors: data.mirrors || [], source: 'api' }));
      } catch (e) {
        console.error('Stream API error:', e);
        return error(e.message, 500);
      }
    }

    if (path === 'health') {
      return json({ status: 'ok', timestamp: Date.now(), cacheSize: memoryCache.size });
    }

    return error('Not found', 404);
  }
};/ /   f o r c e   d e p l o y  
 