import { getHome } from '@/lib/worker';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const data = await getHome(page);
  return Response.json(data);
}