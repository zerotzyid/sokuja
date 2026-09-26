import { getDetail } from '@/lib/worker';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const data = await getDetail(params.slug);
  return Response.json(data);
}