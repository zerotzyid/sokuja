const WORKER_URL = 'https://otakuproxy.azizkalimorgo.workers.dev';
const API_KEY = 'e1d31716fcc84a54bb39da93c0bb4db911a9126459af4dd3922895e888f5ec78';

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  const targetUrl = decodeURIComponent(params.slug.join('/'));
  const proxyUrl = `${WORKER_URL}/proxy/stream/${encodeURIComponent(targetUrl)}`;
  
  const range = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  
  const headers: HeadersInit = {
    'X-API-Key': API_KEY,
    'Accept': '*/*',
    'Referer': 'https://x6.sokuja.uk/',
    ...(range && { Range: range }),
    ...(ifRange && { 'If-Range': ifRange }),
  };
  
  try {
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
  } catch (e: any) {
    return new Response(JSON.stringify({ status: 'error', message: e.message }), { status: 500 });
  }
}