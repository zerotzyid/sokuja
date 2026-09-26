import { getHomeHtml, getOngoingHtml, getCompletedHtml, getScheduleHtml } from '@/lib/sokuja/client';

const WORKER_URL = 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

export async function GET() {
  const endpoints = [
    '/',
    '/anime/?status=ongoing&order=update&page=1',
    '/anime/?status=completed&order=update&page=1',
    '/jadwal-rilis-anime/',
  ];
  
  const results = await Promise.allSettled(
    endpoints.map(path => fetch(`${WORKER_URL}/proxy/html/${encodeURIComponent(path)}`, { 
      headers: { 'X-API-Key': API_KEY } 
    }))
  );
  
  return Response.json({ 
    warmed: results.filter(r => r.status === 'fulfilled').length,
    total: endpoints.length,
    timestamp: Date.now()
  });
}