const WORKER_URL = process.env.SCRAPER_WORKER_URL || 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = process.env.PROXY_API_KEY || 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

const headers = {
  'X-API-Key': API_KEY,
  'Accept': 'application/json',
};

async function fetchWorker(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${WORKER_URL}/scrape/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString(), { 
    headers, 
    cache: 'no-store' // bypass Next.js cache to always get fresh data from worker
  });
  if (!res.ok) throw new Error(`Worker error: ${res.status}`);
  return res.json();
}

export async function getHome(page = 1) {
  return fetchWorker('home', { page: String(page) });
}

export async function getOngoing(page = 1) {
  return fetchWorker('ongoing', { page: String(page) });
}

export async function getCompleted(page = 1) {
  return fetchWorker('completed', { page: String(page) });
}

export async function getGenre(slug: string, page = 1) {
  return fetchWorker(`genre/${slug}`, { page: String(page) });
}

export async function getSearch(keyword: string, page = 1) {
  return fetchWorker(`search/${encodeURIComponent(keyword)}`, { page: String(page) });
}

export async function getSchedule() {
  return fetchWorker('schedule');
}

export async function getDetail(slug: string) {
  return fetchWorker(`detail/${slug}`);
}

export async function getEpisode(slug: string) {
  return fetchWorker(`episode/${slug}`);
}

export function getProxyUrl(targetUrl: string) {
  return `${WORKER_URL}/proxy/stream/${encodeURIComponent(targetUrl)}`;
}