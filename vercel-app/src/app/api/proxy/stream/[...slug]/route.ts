import { getProxyUrl } from '@/lib/worker';

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  const targetUrl = decodeURIComponent(params.slug.join('/'));
  const proxyUrl = getProxyUrl(targetUrl);
  
  const range = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  
  const headers: HeadersInit = {
    'Accept': '*/*',
    'Referer': 'https://x6.sokuja.uk/',
    ...(range && { Range: range }),
    ...(ifRange && { 'If-Range': ifRange }),
  };
  
  const res = await fetch(proxyUrl, { headers, redirect: 'manual' });
  
  const responseHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range, Content-Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': res.headers.get('Content-Type') || 'video/mp4',
  });
  
  if (res.headers.has('Content-Length')) responseHeaders.set('Content-Length', res.headers.get('Content-Length')!);
  if (res.headers.has('Content-Range')) responseHeaders.set('Content-Range', res.headers.get('Content-Range')!);
  
  return new Response(res.body, { status: res.status, headers: responseHeaders });
}