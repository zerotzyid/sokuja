const WORKER_URL = process.env.SCRAPER_WORKER_URL || 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = process.env.PROXY_API_KEY || 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

const endpoints = [
  'home',
  'ongoing?page=1',
  'completed?page=1',
  'schedule',
];

export async function GET() {
  const results = await Promise.allSettled(
    endpoints.map(path => fetch(`${WORKER_URL}/scrape/${path}`, { 
      headers: { 'X-API-Key': API_KEY } 
    }))
  );
  
  return Response.json({ 
    warmed: results.filter(r => r.status === 'fulfilled').length,
    total: endpoints.length,
    timestamp: Date.now()
  });
}