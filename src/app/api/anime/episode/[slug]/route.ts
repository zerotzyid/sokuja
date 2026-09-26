export const runtime = 'nodejs';

import { getEpisodeHtml, getVideoMirrors } from '@/lib/sokuja/client';
import { parseEpisodeDetail } from '@/lib/sokuja/parser';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;

  try {
    const html = await getEpisodeHtml(slug);
    const episodeData: any = parseEpisodeDetail(html, slug);

    // Fetch mirrors via worker proxy (bypass Vercel IP block)
    if (episodeData.data.episodeId) {
      try {
        const mirrorsJson: any = await getVideoMirrors(String(episodeData.data.episodeId));
        const mirrors = mirrorsJson?.mirrors || mirrorsJson?.data?.mirrors || [];
        if (mirrors.length) {
          episodeData.data.mirrors = mirrors.map((m: any) => ({
            id: m.id,
            server: m.serverName || 'SOKUJA',
            quality: m.quality || 'auto',
            type: m.embedType || 'hls',
            url: m.embedUrl,
            source: 'api',
            direct: true
          }));
        }
      } catch (_) {}
    }

    return Response.json(episodeData);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}