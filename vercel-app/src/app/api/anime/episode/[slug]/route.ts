import { getEpisode } from '@/lib/worker';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const data = await getEpisode(params.slug);
  return Response.json(data);
}