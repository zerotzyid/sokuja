export const runtime = 'nodejs';

import { getOngoingHtml } from '@/lib/sokuja/client';
import { parseAnimeDetail } from '@/lib/sokuja/parser';
import { getCache, setCache } from '@/lib/sokuja/cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  
  const cacheKey = `ongoing_${page}`;
  const cached = getCache(`https://x6.sokuja.uk/anime/?status=ongoing&order=update&page=${page}`, 'list');
  if (cached) return Response.json(cached);

  try {
    const html = await getOngoingHtml(page);
    const data = parseAnimeDetail(html, 'ongoing'); // Reuse parser for list
    // Transform for list format
    const result = {
      status: 'success',
      author: 'Z-SCRAPE',
      message: 'Ongoing OK',
      timestamp: new Date().toISOString(),
      data: { total: data.data.episodes?.length || 0, list: data.data.episodes || [] }
    };
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}