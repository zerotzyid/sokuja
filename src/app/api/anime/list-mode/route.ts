import { getGenreHtml } from '@/lib/sokuja/client';
import { parseAnimeListMode } from '@/lib/sokuja/parser';

export async function GET() {
  try {
    const { getGenreHtml } = await import('@/lib/sokuja/client');
    const { parseAnimeListMode } = await import('@/lib/sokuja/parser');
    
    const html = await getGenreHtml('/anime/list-mode/');
    const data = parseAnimeListMode(html);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}