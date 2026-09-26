const WORKER_URL = process.env.SCRAPER_WORKER_URL || 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = process.env.PROXY_API_KEY || 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

const SOKUJA_BASE = 'https://x6.sokuja.uk';

const headers = {
  'X-API-Key': API_KEY,
  'Accept': 'text/html',
};

async function fetchHtmlFromWorker(path: string) {
  const url = `${WORKER_URL}/proxy/html/${encodeURIComponent(path)}`;
  const res = await fetch(url, { 
    headers: { 'X-API-Key': API_KEY },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Worker error: ${res.status}`);
  return res.text();
}

async function fetchJsonFromWorker(path: string) {
  const url = `${WORKER_URL}/proxy/api/${encodeURIComponent(path)}`;
  const res = await fetch(url, { 
    headers: { 'X-API-Key': API_KEY },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Worker error: ${res.status}`);
  return res.json();
}

export async function getHomeHtml() {
  return fetchHtmlFromWorker('/');
}

export async function getOngoingHtml(page = 1) {
  return fetchHtmlFromWorker(`/anime/?status=ongoing&order=update${page > 1 ? `&page=${page}` : ''}`);
}

export async function getCompletedHtml(page = 1) {
  return fetchHtmlFromWorker(`/anime/?status=completed&order=update${page > 1 ? `&page=${page}` : ''}`);
}

export async function getGenreHtml(slug: string, page = 1) {
  return fetchHtmlFromWorker(`/genre/${slug}/${page > 1 ? `?page=${page}` : ''}`);
}

export async function getSearchHtml(keyword: string, page = 1) {
  return fetchHtmlFromWorker(`/?s=${encodeURIComponent(keyword)}${page > 1 ? `&page=${page}` : ''}`);
}

export async function getScheduleHtml() {
  return fetchHtmlFromWorker('/jadwal-rilis-anime/');
}

export async function getDetailHtml(slug: string) {
  return fetchHtmlFromWorker(`/anime/${slug}-subtitle-indonesia/`);
}

export async function getEpisodeHtml(slug: string) {
  return fetchHtmlFromWorker(`/${slug}/`);
}

export async function getVideoMirrors(episodeId: string) {
  return fetchJsonFromWorker(`/api/video-mirrors?e=${episodeId}`);
}

export function getProxyStreamUrl(targetUrl: string) {
  return `https://rino-eosin.vercel.app/api/proxy/stream/${encodeURIComponent(targetUrl)}`;
}