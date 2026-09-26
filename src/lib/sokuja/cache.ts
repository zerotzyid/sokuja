import fs from 'node:fs';
import path from 'node:path';

const CACHE_TTL: Record<string, number> = {
  home: 300000,
  list: 300000,
  detail: 600000,
  episode: 300000,
  schedule: 3600000,
  genres: 86400000,
};

function getCacheDir(): string {
  return process.env.VERCEL ? '/tmp/.cache' : path.join(process.cwd(), '.cache');
}

function ensureCacheDir() {
  const dir = getCacheDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_) {
    // ignore (read-only fs)
  }
}

function getCacheKeyFromUrl(url: string): string {
  return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
}

function ttlForUrl(url: string): number {
  if (url.includes('schedule')) return CACHE_TTL.schedule;
  if (url.includes('genre')) return CACHE_TTL.genres;
  return CACHE_TTL.list;
}

export function getCache(url: string, _type?: string): any | null {
  ensureCacheDir();
  const filePath = path.join(getCacheDir(), `${getCacheKeyFromUrl(url)}.json`);
  const ttl = ttlForUrl(url);

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
  const filePath = path.join(getCacheDir(), `${getCacheKeyFromUrl(url)}.json`);

  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}
  return null;
}

export function setCache(url: string, data: any): void {
  ensureCacheDir();
  const filePath = path.join(getCacheDir(), `${getCacheKeyFromUrl(url)}.json`);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch (_) {
    // ignore write errors (e.g. read-only fs)
  }
}
