const SOKUJA_BASE = 'https://x6.sokuja.uk';
const VALID_API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

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

async function handleProxyHtml(req, targetUrl) {
  if (!authCheck(req)) return error('Unauthorized', 401);

  try {
    const headers = {
      ...BROWSER_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    const res = await fetch(`${SOKUJA_BASE}${targetUrl}`, { headers, redirect: 'follow' });
    if (!res.ok) return error(`Upstream error: ${res.status}`, res.status);
    
    const html = await res.text();
    return new Response(html, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      } 
    });
  } catch (e) {
    console.error('Proxy HTML error:', e);
    return error(e.message, 500);
  }
}

async function handleProxyStream(req, targetUrl) {
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
    console.error('Proxy stream error:', e);
    return error(e.message, 500);
  }
}

async function handleProxyApi(req, targetUrl) {
  if (!authCheck(req)) return error('Unauthorized', 401);

  try {
    const headers = {
      ...BROWSER_HEADERS,
      'Accept': 'application/json',
      'Referer': SOKUJA_BASE + '/',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const res = await fetch(`${SOKUJA_BASE}${targetUrl}`, { headers, redirect: 'follow' });
    if (!res.ok) return error(`Upstream API error: ${res.status}`, res.status);
    
    const data = await res.json();
    return json(data);
  } catch (e) {
    console.error('Proxy API error:', e);
    return error(e.message, 500);
  }
}

function checkRateLimitFn(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const limit = 100;
  const key = `rl:${ip}`;
  const data = rateLimitMap.get(key) || { count: 0, windowStart: now };
  if (now - data.windowStart > 60000) {
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

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://x6.sokuja.uk/',
  'Origin': 'https://x6.sokuja.uk',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const SOKUJA_BASE = 'https://x6.sokuja.uk';
const VALID_API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        headers: { 
          'Access-Control-Allow-Origin': '*', 
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Range', 
          'Access-Control-Max-Age': '86400' 
        } 
      });
    }

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimitFn(ip)) return error('Rate limit exceeded (100 req/min)', 429);

    const url = new URL(req.url);
    const path = url.pathname.slice(1);

    if (path.startsWith('proxy/html/')) {
      const target = decodeURIComponent(path.replace('proxy/html/', ''));
      return handleProxyHtml(req, target);
    }

    if (path.startsWith('proxy/stream/')) {
      const target = decodeURIComponent(path.replace('proxy/stream/', ''));
      return handleProxyStream(req, target);
    }

    if (path.startsWith('proxy/api/')) {
      const target = decodeURIComponent(path.replace('proxy/api/', ''));
      return handleProxyApi(req, target);
    }

    if (path === 'health') {
      return json({ status: 'ok', timestamp: Date.now() });
    }

    return error('Not found - Worker is proxy only. Use Vercel for scraping.', 404);
  }
};