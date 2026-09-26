import * as cheerio from 'cheerio';

const SOKUJA_BASE = 'https://x6.sokuja.uk';

function cleanImageUrl(img: string): string {
  if (!img) return '';
  const match = img.match(/url=([^&]+)/);
  if (match) {
    const decoded = decodeURIComponent(match[1]);
    return decoded.startsWith('http') ? decoded : `${SOKUJA_BASE}${decoded.startsWith('/') ? '' : '/'}${decoded}`;
  }
  return img.startsWith('http') ? img : `${SOKUJA_BASE}${img.startsWith('/') ? '' : '/'}${img}`;
}

function extractRscPayload(html: string): string {
  const chunks = html.split('self.__next_f.push([1,');
  let full = '';
  for (let i = 1; i < chunks.length; i++) {
    let c = chunks[i];
    const end = c.lastIndexOf('])');
    if (end !== -1) c = c.slice(0, end);
    try { full += JSON.parse(c); } catch (_) {}
  }
  return full;
}

function extractJsonLd(html: string): any[] {
  const $ = cheerio.load(html);
  const results: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { results.push(JSON.parse($(el).html() || '{}')); } catch (_) {}
  });
  return results;
}

export function parseHome(html: string) {
  const $ = cheerio.load(html);
  const rsc = extractRscPayload(html);

  const latest: any[] = [];
  const epRegex = /href":"\/([^"]+-episode-[^"]+)".*?"src":"([^"]+)","alt":"([^"]+)".*?children":\["EP ","([^"]+)"\]/g;
  let m;
  while ((m = epRegex.exec(rsc)) !== null) {
    const slug = m[1].replace(/^\/|\/$/g, '');
    if (!latest.some(e => e.slug === slug)) {
      latest.push({
        title: `${m[3].trim()} Episode ${m[4]}`,
        slug,
        episodeNumber: parseInt(m[4], 10),
        url: `https://x6.sokuja.uk/${slug}/`,
        thumbnail: cleanImageUrl(m[2])
      });
    }
  }

  let popular: any[] = [];
  const popMatch = rsc.match(/"weekly":\s*(\[[^\]]+\])/);
  if (popMatch) {
    try {
      popular = JSON.parse(popMatch[1]).map((item: any, idx: number) => ({
        rank: idx + 1,
        id: item.id,
        title: item.title,
        type: item.type || 'TV',
        status: item.status || 'Ongoing',
        year: item.year || null,
        score: item.score ? parseFloat(item.score) : null,
        views: item.viewCount || 0,
        slug: item.slug,
        url: `https://x6.sokuja.uk/anime/${item.slug}/`,
        thumbnail: cleanImageUrl(item.thumbnailUrl || item.coverUrl)
      }));
    } catch (_) {}
  }

  const $home = cheerio.load(html);
  const seasons: any[] = [];
  $home('aside button span.font-medium, a[href*="/season/"]').each((_, el) => {
    const text = $home(el).text().trim();
    if (text && /^\d{4}$/.test(text)) {
      seasons.push({ year: parseInt(text, 10), url: `https://x6.sokuja.uk/season/${text}/` });
    }
  });

  return {
    status: 'success',
    author: 'Z-SCRAPE',
    message: 'Home data OK',
    timestamp: new Date().toISOString(),
    data: {
      totalLatest: latest.length,
      latest: latest.slice(0, 18),
      popular: popular.slice(0, 10),
      seasons: seasons.slice(0, 10)
    }
  };
}

export function parseAnimeDetail(html: string, slug: string) {
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);
  const meta = jsonLd.find(d => d['@type'] === 'TVSeries') || {};

  const title = $('h1').text().replace('Subtitle Indonesia', '').trim() || meta.name || slug;
  const altTitle = meta.alternateName || $('p.text-sm.text-gray-400').first().text().trim() || null;
  const score = meta.aggregateRating?.ratingValue || $('span.text-2xl.font-bold').first().text().trim() || null;
  const ratingCount = meta.aggregateRating?.ratingCount || null;
  const poster = meta.image || $('img[alt="' + title + '"]').attr('src') || $('img').eq(1).attr('src') || null;
  const synopsis = meta.description || $('div.prose p').text().trim() || null;
  const genres = meta.genre || $('a[href*="/genre/"]').map((_, el) => $(el).text().trim()).get();

  const info: Record<string, string> = {};
  $('dl div').each((_, el) => {
    const key = $(el).find('dt').text().trim().toLowerCase();
    const val = $(el).find('dd').text().trim();
    if (key && val) info[key] = val;
  });

  const cast: any[] = [];
  $('a[href*="/cast/"]').each((_, el) => {
    const name = $(el).text().trim();
    const slug = $(el).attr('href')?.replace(/^\/cast\/|\/$/g, '');
    if (name && slug && !cast.some(c => c.slug === slug)) {
      cast.push({ name, slug, url: `https://x6.sokuja.uk/cast/${slug}/` });
    }
  });

  const episodes: any[] = [];
  $('a[href*="-episode-"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const epSlug = href.replace(/^\/|\/$/g, '');
    const epTitle = $el.find('span').first().text().trim() || $el.text().trim();
    const epTime = $el.find('span.text-xs').text().trim() || 'Tersedia';
    if (epSlug && !episodes.some(ep => ep.slug === epSlug)) {
      const numMatch = epSlug.match(/episode-(\d+)/i) || epTitle.match(/episode\s*(\d+)/i);
      episodes.push({
        number: numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1,
        title: epTitle,
        slug: epSlug,
        url: `https://x6.sokuja.uk/${epSlug}/`,
        released: epTime
      });
    }
  });
  episodes.sort((a, b) => a.number - b.number);

  return {
    status: 'success',
    author: 'Z-SCRAPE',
    message: `Detail anime '${title}' OK`,
    timestamp: new Date().toISOString(),
    data: {
      title,
      altTitle,
      slug: slug.replace(/^\/anime\/|\/$/g, ''),
      url: `https://x6.sokuja.uk/anime/${slug}/`,
      poster: cleanImageUrl(poster),
      score: score ? parseFloat(score) : null,
      ratingCount,
      status: info['status'] || 'Ongoing',
      type: info['tipe'] || 'TV',
      year: info['tahun'] || null,
      season: info['musim'] || null,
      studio: info['studio'] || null,
      director: info['sutradara'] || null,
      producer: info['produser'] || null,
      fansub: info['fansub'] || 'SOKUJA.NET',
      genres: [...new Set(genres)],
      synopsis,
      cast,
      totalEpisodes: episodes.length,
      episodes: episodes.slice(0, 50)
    }
  };
}

export function parseEpisodeDetail(html: string, slug: string) {
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);
  const meta = jsonLd.find(d => d['@type'] === 'TVEpisode') || {};

  const title = $('h1').text().replace('Subtitle Indonesia', '').trim() || meta.name || slug;
  const animeTitle = meta.partOfSeries?.name || $('nav a[href*="/anime/"]').text().trim() || null;
  const animeUrl = meta.partOfSeries?.url || $('nav a[href*="/anime/"]').attr('href') || null;
  const animeSlug = animeUrl ? animeUrl.replace(/.*\/anime\/|\/$/g, '') : null;
  const uploadDate = meta.uploadDate || $('span:contains("202")').first().text().trim() || null;
  const views = meta.interactionStatistic?.userInteractionCount || $('span:contains("views")').text().trim() || null;
  const thumbnail = meta.thumbnailUrl || $('img[fetchpriority="high"]').attr('src') || null;

  const epIdMatch = html.match(/episodeId[^\d]{1,10}(\d+)/i);
  const episodeId = epIdMatch ? parseInt(epIdMatch[1], 10) : null;

  let mirrors: any[] = [];
  const sources: any[] = [];

  // Will be populated from API separately
  const epIdMatch = html.match(/episodeId[^\d]{1,10}(\d+)/i);
  const episodeId2 = epIdMatch ? parseInt(epIdMatch[1], 10) : null;

  // Fallback scrape from HTML
  const scraped = scrapeStreamsFromHtml(html);
  const seen = new Set();
  const mirrors2 = scraped.filter(s => {
    if (!s.url) return false;
    const key = s.url.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Download links
  const downloads: any[] = [];
  $('a[href*="sokuja.id/x.php"], a:contains("Download")').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const quality = $el.find('span').text().trim() || $el.text().trim();
    if (href && (href.includes('x.php') || href.includes('http'))) {
      downloads.push({ quality: quality.replace(/Download/i, '').trim() || 'Default', link: href });
    }
  });

  const prevSlug = $('a:contains("Episode Sebelumnya")').attr('href')?.replace(/^\/|\/$/g, '') || null;
  const nextSlug = $('a:contains("Episode Selanjutnya")').attr('href')?.replace(/^\/|\/$/g, '') || null;

  return {
    status: 'success',
    author: 'Z-SCRAPE',
    message: `Episode '${title}' OK`,
    timestamp: new Date().toISOString(),
    data: {
      title,
      slug: slug.replace(/^\/|\/$/g, ''),
      episodeId: episodeId2,
      anime: { title: animeTitle, slug: animeSlug, url: animeSlug ? `https://x6.sokuja.uk/anime/${animeSlug}/` : null },
      thumbnail: cleanImageUrl(thumbnail),
      uploadDate,
      views: typeof views === 'number' ? views : (views ? parseInt(views.replace(/\D/g, '')) || null : null),
      navigation: {
        prev: prevSlug ? { slug: prevSlug, url: `https://x6.sokuja.uk/${prevSlug}/` } : null,
        next: nextSlug ? { slug: nextSlug, url: `https://x6.sokuja.uk/${nextSlug}/` } : null,
        allEpisodes: animeSlug ? `https://x6.sokuja.uk/anime/${animeSlug}/` : null
      },
      mirrors: mirrors2,
      downloads
    }
  };
}

function scrapeStreamsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const streams: any[] = [];
  const patterns = [
    /"url"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /"file"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /"src"\s*:\s*"([^"]+\.(m3u8|mp4)[^"]*)"/gi,
    /source\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)["']/gi,
    /video\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)["']/gi,
    /https?:\/\/[^\s"']+\.(m3u8|mp4)/gi
  ];

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1] || match[0];
        if (url && url.startsWith('http') && !url.includes('google')) {
          streams.push({
            url,
            quality: url.includes('1080') ? '1080p' : url.includes('720') ? '720p' : url.includes('480') ? '480p' : 'auto',
            type: url.includes('.m3u8') ? 'hls' : 'mp4',
            server: 'Scraped',
            source: 'html'
          });
        }
      }
    });
  });
  return streams;
}

export function parseAnimeFilter(html: string, filters: { status: string; type: string; order: string; page: number }) {
  const $ = cheerio.load(html);
  const list: any[] = [];

  $('main a[href*="/anime/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (href === '/anime/' || href === '/anime/list-mode/') return;
    const slug = href.replace(/^\/anime\/|\/$/g, '');
    const title = $el.find('p, h3, div.text-sm').first().text().trim() || $el.attr('title') || '';
    const img = $el.find('img').attr('src') || $el.find('img').attr('srcset') || '';
    const typeTag = $el.find('span:contains("TV"), span:contains("Movie")').text().trim() || 'TV';
    if (slug && title && !list.some(a => a.slug === slug)) {
      list.push({ title, slug, url: `https://x6.sokuja.uk/anime/${slug}/`, type: typeTag, thumbnail: cleanImageUrl(img) });
    }
  });

  return {
    status: 'success',
    author: 'Z-SCRAPE',
    message: 'Filter OK',
    timestamp: new Date().toISOString(),
    data: { filters: { status: filters.status, type: filters.type, order: filters.order, page: filters.page }, total: list.length, list }
  };
}

export function parseSchedule(html: string) {
  const $ = cheerio.load(html);
  const schedule: Record<string, any[]> = {};
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random / Belum Pasti', 'Libur', 'Hiatus', 'Sudah Selesai (END)'];

  $('main h2').each((_, el) => {
    const day = $(el).text().trim();
    if (!['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random / Belum Pasti', 'Libur', 'Hiatus', 'Sudah Selesai (END)'].includes(day)) return;
    const container = $(el).parent().parent();
    const animes: any[] = [];
    container.find('a[href*="/anime/"]').each((_, a) => {
      const $a = $(a);
      const href = $a.attr('href') || '';
      const slug = href.replace(/^\/anime\/|\/$/g, '');
      const title = $a.find('h3').text().trim() || $a.text().replace(/\d{2}:\d{2}\s*WIB/i, '').replace(/TV|Movie/i, '').trim();
      const img = $a.find('img').attr('src') || '';
      const timeMatch = $a.text().match(/(\d{2}:\d{2}\s*WIB)/i);
      const time = timeMatch ? timeMatch[1] : ($a.find('span.text-primary').text().trim() || 'TBA');
      if (slug && title && !animes.some(item => item.slug === slug)) {
        animes.push({ title, slug, url: `https://x6.sokuja.uk/anime/${slug}/`, time, thumbnail: cleanImageUrl(img) });
      }
    });
    if (animes.length > 0) schedule[day] = animes;
  });

  return { status: 'success', author: 'Z-SCRAPE', message: 'Schedule OK', timestamp: new Date().toISOString(), data: { schedule } };
}

export function parseGenres(html: string) {
  const $ = cheerio.load(html);
  const genres: any[] = [];

  $('main a[href*="/genre/"], footer a[href*="/genre/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const slug = href.replace(/^\/genre\/|\/$/g, '');
    const name = $el.text().trim();
    if (slug && name && !genres.some(g => g.slug === slug)) {
      genres.push({ name, slug, url: `https://x6.sokuja.uk/genre/${slug}/` });
    }
  });

  return { status: 'success', author: 'Z-SCRAPE', message: 'Genres OK', timestamp: new Date().toISOString(), data: { total: genres.length, genres } };
}

export function parseAnimeByGenre(html: string, genreSlug: string, page: number) {
  const $ = cheerio.load(html);
  const list: any[] = [];

  $('main a[href*="/anime/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (href === '/anime/' || href === '/anime/list-mode/') return;
    const slug = href.replace(/^\/anime\/|\/$/g, '');
    const title = $el.find('p, h3, div.text-sm').first().text().trim() || $el.text().trim();
    const img = $el.find('img').attr('src') || '';
    const typeTag = $el.find('span:contains("TV"), span:contains("Movie")').text().trim() || 'TV';
    if (slug && title && !list.some(a => a.slug === slug)) {
      list.push({ title, slug, url: `https://x6.sokuja.uk/anime/${slug}/`, type: typeTag, thumbnail: cleanImageUrl(img) });
    }
  });

  return { status: 'success', author: 'Z-SCRAPE', message: 'Genre OK', timestamp: new Date().toISOString(), data: { genre: genreSlug, page, total: list.length, list } };
}

export function parseAnimeListMode(html: string) {
  const $ = cheerio.load(html);
  const catalog: Record<string, any[]> = {};

  $('div.space-y-6 > div, div[id]').each((_, section) => {
    const letter = $(section).find('h2, span.text-xl, div.font-bold').first().text().trim() || '#';
    const items: any[] = [];
    $(section).find('a[href*="/anime/"]').each((_, a) => {
      const $a = $(a);
      const title = $a.text().trim();
      const href = $a.attr('href') || '';
      const slug = href.replace(/^\/anime\/|\/$/g, '');
      if (slug && title) items.push({ title, slug, url: `https://x6.sokuja.uk/anime/${slug}/` });
    });
    if (items.length > 0) catalog[letter] = items;
  });

  return { status: 'success', author: 'Z-SCRAPE', message: 'A-Z OK', timestamp: new Date().toISOString(), data: { alphabet: Object.keys(catalog), catalog } };
}