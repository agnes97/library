import type { BookResult, EditionCover } from './types';

const SEARCH_URL = 'https://openlibrary.org/search.json';
const WORKS_URL = 'https://openlibrary.org/works';
const FIELDS = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn';

type SearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
};

/** Searches Open Library by title, author or ISBN. */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookResult[]> {
  const params = new URLSearchParams({ q: query, limit: '10', fields: FIELDS });
  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Open Library search failed (${response.status})`);

  const { docs }: { docs: SearchDoc[] } = await response.json();
  return docs.map((doc) => ({
    key: doc.key,
    title: doc.title,
    authors: doc.author_name ?? [],
    year: doc.first_publish_year,
    pages: doc.number_of_pages_median,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    isbn: doc.isbn?.[0],
  }));
}

type Edition = {
  title?: string;
  publish_date?: string;
  languages?: { key: string }[];
  covers?: number[];
  publishers?: string[];
  physical_format?: string;
};

/** MARC's bibliographic codes that differ from the ISO ones `Intl.DisplayNames` knows */
const MARC_CODES: Record<string, string> = {
  alb: 'sqi',
  arm: 'hye',
  baq: 'eus',
  bur: 'mya',
  chi: 'zho',
  cze: 'ces',
  dut: 'nld',
  fre: 'fra',
  geo: 'kat',
  ger: 'deu',
  gre: 'ell',
  ice: 'isl',
  mac: 'mkd',
  mao: 'mri',
  may: 'msa',
  per: 'fas',
  rum: 'ron',
  scc: 'srp',
  scr: 'hrv',
  slo: 'slk',
  tib: 'bod',
  wel: 'cym',
};

const languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

/** "cze" → "Czech", or undefined for a code nobody can name */
function languageName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  try {
    return languageNames.of(MARC_CODES[code] ?? code);
  } catch {
    return undefined;
  }
}

/** English, then named languages alphabetically, then the editions nobody tagged */
function languageRank({ language }: EditionCover): string {
  return language === 'English' ? '0' : language ? `1${language}` : '2';
}

/**
 * One cover per edition of the work that has one: English ones first, then the rest grouped by
 * language, and within each the newest first, undated ones last. Of the same year, those titled
 * like `title` go first, so a book renamed to its translation finds that edition's cover sooner.
 */
export async function editionCovers(
  workId: string,
  title: string,
  signal?: AbortSignal
): Promise<EditionCover[]> {
  const params = new URLSearchParams({
    limit: '100',
    fields: 'title,publish_date,languages,covers,publishers,physical_format',
  });
  const response = await fetch(`${WORKS_URL}/${workId}/editions.json?${params}`, { signal });
  if (!response.ok) throw new Error(`Open Library editions failed (${response.status})`);

  const { entries }: { entries: Edition[] } = await response.json();
  const seen = new Set<number>();
  const covers: (EditionCover & { year: number; matches: boolean })[] = [];
  for (const edition of entries) {
    // -1 marks a cover that was taken down
    const id = edition.covers?.find((cover) => cover > 0);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const language = languageName(edition.languages?.[0]?.key.replace('/languages/', ''));
    const year = edition.publish_date?.match(/\d{4}/)?.[0];
    const details = [year, edition.publishers?.[0], edition.physical_format]
      .filter(Boolean)
      .join(' · ');
    covers.push({
      url: `https://covers.openlibrary.org/b/id/${id}-M.jpg`,
      label: [edition.title, language, details].filter(Boolean).join(' · '),
      language,
      details,
      year: Number(year ?? 0),
      matches: edition.title?.trim().toLowerCase() === title.trim().toLowerCase(),
    });
  }

  return covers
    .toSorted(
      (a, b) =>
        languageRank(a).localeCompare(languageRank(b)) ||
        b.year - a.year ||
        Number(b.matches) - Number(a.matches)
    )
    .map(({ url, label, language, details }) => ({ url, label, language, details }));
}
