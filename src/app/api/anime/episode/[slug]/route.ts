export const runtime = 'nodejs';

import { getEpisodeHtml, getVideoMirrors } from '@/lib/sokuja/client';
import { parseEpisodeDetail } from '@/lib/sokuja/parser';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  
  try {
    const { getEpisodeHtml, getVideoMirrors } = await import('@/lib/sokuja/client');
    const { parseEpisodeDetail } = await import('@/lib/sokuja/parser');
    
    const [html, mirrorsData] = await Promise.all([
      getEpisodeHtml(slug),
      getVideoMirrors('').catch(() => null) // Will be called with episodeId from HTML
    ]);
    
    const episodeData = parseEpisodeDetail(html, slug);
    
    // If we have episodeId, fetch mirrors
    if (episodeData.data.episodeId) {
      try {
        const mirrorsResponse = await fetch(`https://x6.sokuja.uk/api/video-mirrors?e=${episodeData.data.episodeId}`, {
          headers: { 'Referer': `https://x6.sokuja.uk/${slug}/`, 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (mirrorsResponse.ok) {
          const mirrorsJson = await mirrorsResponse.json();
          if (mirrorsJson.mirrors?.length) {
            episodeData.data.mirrors = mirrorsJson.mirrors.map((m: any) => ({
              id: m.id,
              server: m.serverName || 'SOKUJA',
              quality: m.quality || 'auto',
              type: m.embedType || 'hls',
              url: m.embedUrl,
              source: 'api',
              direct: true
            }));
          }
        }
      } catch (_) {}
    }

    return Response.json(episodeData);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}