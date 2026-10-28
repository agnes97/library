import type { BookResult } from './types';

const SEARCH_URL = 'https://openlibrary.org/search.json';
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
