import { getCompletedHtml } from '@/lib/sokuja/client';
import { parseAnimeDetail } from '@/lib/sokuja/parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  
  try {
    const html = await getCompletedHtml(page);
    const data = parseAnimeDetail(html, 'completed');
    return Response.json({
      status: 'success',
      author: 'Z-SCRAPE',
      message: 'Completed OK',
      timestamp: new Date().toISOString(),
      data: { total: data.data.episodes?.length || 0, list: data.data.episodes || [] }
    });
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}