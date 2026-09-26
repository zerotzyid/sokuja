import { getGenre } from '@/lib/worker';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || '';
  const page = parseInt(searchParams.get('page') || '1');
  if (!slug) return Response.json({ ok: false, message: 'slug required' }, { status: 400 });
  const data = await getGenre(slug, page);
  return Response.json(data);
}