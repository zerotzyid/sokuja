const IS_VERCEL = !!process.env.VERCEL;
const CACHE_DIR = IS_VERCEL ? '/tmp/.cache' : './.cache';
const CACHE_TTL = {
  home: 300000,
  list: 300000,
  detail: 600000,
  episode: 300000,
  schedule: 3600000,
  genres: 86400000,
};

function getCacheKey(url: string): string {
  return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
}

function getCacheDir(): string {
  if (typeof process !== 'undefined' && process.env.VERCEL) {
    return '/tmp/.cache';
  }
  return './.cache';
}

function ensureCacheDir() {
  const fs = require('fs');
  const dir = getCacheDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_) {}
}

function getCacheKeyFromUrl(url: string): string {
  return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
}

export function getCache(url: string, type: keyof typeof CACHE_TTL = 'list'): any | null {
  ensureCacheDir();
  const fs = require('fs');
  const key = getCacheKeyFromUrl(url);
  const filePath = `${getCacheDir()}/${key}.json`;
  const ttl = CACHE_TTL[Object.keys(CACHE_TTL).find(k => url.includes(k)) || 'list'] || 300000;
  
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs < ttl) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }
  } catch (_) {}
  return null;
}

export function getCacheStale(url: string): any | null {
  ensureCacheDir();
  const fs = require('fs');
  const key = getCacheKeyFromUrl(url);
  const filePath = `${getCacheDir()}/${key}.json`;
  
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}
  return null;
}

export function setCache(url: string, data: any): void {
  ensureCacheDir();
  const fs = require('fs');
  const key = getCacheKeyFromUrl(url);
  const filePath = `${getCacheDir()}/${key}.json`;
  
  try {
    fs.writeFileSync(`${getCacheDir()}/${key}.json`, JSON.stringify(data));
  } catch (_) {}
}