export const runtime = 'nodejs';

import { getHomeHtml } from '@/lib/sokuja/client';
import { parseHome } from '@/lib/sokuja/parser';
import { getCache, setCache } from '@/lib/sokuja/cache';

export async function GET() {
  const cacheKey = 'home';
  const cached = getCache('https://x6.sokuja.uk/', 'home');
  if (cached) return Response.json(cached);

  try {
    const html = await getHomeHtml();
    const data = parseHome(html);
    setCache('https://x6.sokuja.uk/', data);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}