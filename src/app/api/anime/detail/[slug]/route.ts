import { getDetailHtml } from '@/lib/sokuja/client';
import { parseAnimeDetail } from '@/lib/sokuja/parser';

const ANILIST_API = 'https://graphql.anilist.co';

async function fetchAniList(search: string) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title { romaji english native }
        description
        genres
        averageScore
        meanScore
        popularity
        episodes
        duration
        status
        season
        seasonYear
        coverImage { large medium }
        bannerImage
        studios { nodes { name } }
        staff { nodes { name { full } role } }
        characters { nodes { name { full } role image { large } } }
        relations { edges { relationType node { id title { romaji } type } } }
        externalLinks { site url }
      }
    }
  `;

  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search } }),
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.Media || null;
  } catch {
    return null;
  }
}

function cleanHtml(text: string) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .trim();
}

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  
  try {
    // Import dynamically to avoid circular dependency
    const { getDetailHtml } = await import('@/lib/sokuja/client');
    const { parseAnimeDetail } = await import('@/lib/sokuja/parser');
    
    const html = await getDetailHtml(slug);
    const sokujaData = parseAnimeDetail(html, slug);
    
    // Fetch AniList data
    const searchTitle = sokujaData.data?.title || slug;
    const anilist = await fetchAniList(searchTitle);

    if (anilist) {
      sokujaData.data = {
        ...sokujaData.data,
        titleRomaji: anilist.title?.romaji,
        titleEnglish: anilist.title?.english,
        titleNative: anilist.title?.native,
        synopsis: cleanHtml(anilist.description) || sokujaData.data?.synopsis,
        genres: anilist.genres?.length ? anilist.genres : sokujaData.data?.genres,
        poster: anilist.coverImage?.large || sokujaData.data?.poster,
        anilist: {
          id: anilist.id,
          score: anilist.averageScore,
          status: anilist.status,
          totalEpisodes: anilist.episodes,
          coverImage: anilist.coverImage?.large,
          bannerImage: anilist.bannerImage,
          studios: anilist.studios?.nodes?.map((s: any) => s.name) || [],
          staff: anilist.staff?.nodes?.map((s: any) => ({ name: s.name?.full, role: s.role })).filter((s: any) => s.name) || [],
          characters: anilist.characters?.nodes?.map((c: any) => ({ name: c.name?.full, role: c.role, image: c.image?.large })).filter((c: any) => c.name) || [],
          relations: anilist.relations?.edges?.map((e: any) => ({ type: e.relationType, title: e.node?.title?.romaji, animeType: e.node?.type })) || [],
          externalLinks: anilist.externalLinks || []
        }
      };
    }

    return Response.json(sokujaData);
  } catch (e: any) {
    return Response.json({ status: 'error', message: e.message }, { status: 500 });
  }
}