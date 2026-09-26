export const runtime = 'nodejs';

import { getSearchHtml } from '@/lib/sokuja/client';
import { parseAnimeFilter } from '@/lib/sokuja/parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || searchParams.get('query') || '';
  const page = parseInt(searchParams.get('page') || '1');
  
  if (!q) return Response.json({ status: 'error', message: 'query required' }, { status: 400 });
  
  try {
    const html = await getSearchHtml(q, page);
    const data = parseAnimeFilter(html, { status: '', type: '', order: 'update', page });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}