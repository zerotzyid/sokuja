import { getHomeHtml } from '@/lib/sokuja/client';

const WORKER_URL = 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

async function testProxy(url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'X-API-Key': API_KEY } });
    return { url, ok: res.ok, latency: Date.now() - start };
  } catch {
    return { url, ok: false, latency: Date.now() - start };
  }
}

export async function GET() {
  const testUrls = [
    `${WORKER_URL}/health`,
    `${WORKER_URL}/proxy/stream/https://storages.sokuja.uk/test.mp4`,
  ];
  
  const results = await Promise.all(testUrls.map(testProxy));
  
  return Response.json({ proxies: results, timestamp: Date.now() });
}