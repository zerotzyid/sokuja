import { getGenreHtml } from '@/lib/sokuja/client';
import { parseAnimeFilter } from '@/lib/sokuja/parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'ongoing';
  const type = searchParams.get('type') || '';
  const order = searchParams.get('order') || 'update';
  const page = parseInt(searchParams.get('page') || '1');
  
  try {
    const { getGenreHtml } = await import('@/lib/sokuja/client');
    const { parseAnimeFilter } = await import('@/lib/sokuja/parser');
    
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (order) params.set('order', order);
    if (page > 1) params.set('page', String(page));
    
    const html = await getGenreHtml(`/anime/?${params.toString()}`);
    const data = parseAnimeFilter(html, { status, type, order, page });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}