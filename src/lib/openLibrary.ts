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
};

/**
 * One cover per edition of the work that has one, those titled like `title` first, so a book
 * renamed to its translation finds that edition's cover at the front.
 */
export async function editionCovers(
  workId: string,
  title: string,
  signal?: AbortSignal
): Promise<EditionCover[]> {
  const params = new URLSearchParams({
    limit: '100',
    fields: 'title,publish_date,languages,covers',
  });
  const response = await fetch(`${WORKS_URL}/${workId}/editions.json?${params}`, { signal });
  if (!response.ok) throw new Error(`Open Library editions failed (${response.status})`);

  const { entries }: { entries: Edition[] } = await response.json();
  const seen = new Set<number>();
  const covers: (EditionCover & { matches: boolean })[] = [];
  for (const edition of entries) {
    // -1 marks a cover that was taken down
    const id = edition.covers?.find((cover) => cover > 0);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const language = edition.languages?.[0]?.key.replace('/languages/', '');
    covers.push({
      url: `https://covers.openlibrary.org/b/id/${id}-M.jpg`,
      label: [edition.title, language, edition.publish_date].filter(Boolean).join(' · '),
      matches: edition.title?.trim().toLowerCase() === title.trim().toLowerCase(),
    });
  }

  return covers
    .toSorted((a, b) => Number(b.matches) - Number(a.matches))
    .map(({ url, label }) => ({ url, label }));
}
