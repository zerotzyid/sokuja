import { getGenreHtml } from '@/lib/sokuja/client';
import { parseGenres } from '@/lib/sokuja/parser';

export async function GET() {
  try {
    const { getGenreHtml } = await import('@/lib/sokuja/client');
    const { parseGenres } = await import('@/lib/sokuja/parser');
    
    const html = await getGenreHtml('', 1); // /genre/ for list
    const data = parseGenres(html);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}