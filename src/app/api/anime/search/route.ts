import { getSearch } from '@/lib/worker';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  if (!keyword) return Response.json({ ok: false, message: 'q required' }, { status: 400 });
  const data = await getSearch(keyword, page);
  return Response.json(data);
}