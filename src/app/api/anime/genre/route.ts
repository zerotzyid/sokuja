export const runtime = 'nodejs';

import { getGenreHtml } from '@/lib/sokuja/client';
import { parseAnimeFilter } from '@/lib/sokuja/parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || '';
  const page = parseInt(searchParams.get('page') || '1');
  
  if (!slug) return Response.json({ status: 'error', message: 'slug required' }, { status: 400 });
  
  try {
    const html = await getGenreHtml(slug, page);
    const data = parseAnimeFilter(html, { status: '', type: '', order: 'update', page });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}