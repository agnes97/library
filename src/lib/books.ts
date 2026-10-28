import type { ApiReading, Book, ShelfBook, ShelfOptions } from './types';

/** Cloth colours for the spines, one picked per book. */
const PALETTES: Book['colors'][] = [
  { c1: '#1a2a36', c2: '#0b141b', accent: '#c48bb8', ink: '#e6dbe6' },
  { c1: '#521a26', c2: '#2a0b12', accent: '#ec93bb', ink: '#f3e2e7' },
  { c1: '#2b2a1d', c2: '#15140c', accent: '#b9a3d6', ink: '#ebe4d8' },
  { c1: '#3e2246', c2: '#1f0f26', accent: '#e7a0d0', ink: '#f1e5f1' },
  { c1: '#14343a', c2: '#08191c', accent: '#8fd3c8', ink: '#e0efec' },
  { c1: '#3d2416', c2: '#1e110a', accent: '#e0a872', ink: '#f2e6da' },
  { c1: '#1b2448', c2: '#0c1124', accent: '#9fb4f0', ink: '#e3e7f5' },
  { c1: '#1f3324', c2: '#0e1a11', accent: '#b5d68c', ink: '#e6efdf' },
  { c1: '#3a3340', c2: '#1b171f', accent: '#d9b6e8', ink: '#eee6f2' },
  { c1: '#4a2a1c', c2: '#24130b', accent: '#f0b48a', ink: '#f5e7dc' },
];

/** Spine sizes, one picked per book whose page count is unknown. */
const WIDTHS = [52, 44, 60, 38, 66, 48, 56, 42, 62, 46];
const HEIGHTS = [286, 248, 270, 300, 262, 236, 292, 254, 278, 244];
/** Slimmer volumes for a series, so more of them fit in a pile. */
const SERIES_WIDTHS = [22, 24, 26, 28];
/** The page counts of the thinnest and thickest books; anything beyond gets their width. */
const MIN_PAGES = 100;
const MAX_PAGES = 1000;
/** How thick a spine grows across that range, standing and lying in a pile. */
const SPINE_RANGE: [number, number] = [34, 84];
const SERIES_RANGE: [number, number] = [22, 40];
/** A series longer than a trilogy lies flat only when every volume is slimmer than this. */
const SLIM_PAGES = 300;

/** FNV-1a, so a book gets the same colours and size on every visit. */
function hash(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A spine as thick as the book is long; picked from `fallback` when its pages are unknown. */
function thickness(pages: number | null, [thin, thick]: [number, number], fallback: number) {
  if (!pages) return fallback;
  const share =
    (Math.min(Math.max(pages, MIN_PAGES), MAX_PAGES) - MIN_PAGES) / (MAX_PAGES - MIN_PAGES);
  return Math.round(thin + share * (thick - thin));
}

/**
 * The series whose volumes lie flat in piles: any trilogy, and a longer one only when every volume
 * is short; one or two volumes stand. A volume with no page count is not known to be short.
 */
function flatSeries(readings: ApiReading[]) {
  const volumes = new Map<string, Map<string, number | null>>();
  for (const { book } of readings) {
    if (!book.series) continue;
    let series = volumes.get(book.series);
    if (!series) volumes.set(book.series, (series = new Map()));
    series.set(book.id, book.pages);
  }

  const flat = new Set<string>();
  for (const [name, series] of volumes) {
    const pages = [...series.values()];
    if (
      pages.length === 3 ||
      (pages.length > 3 && pages.every((count) => count !== null && count < SLIM_PAGES))
    ) {
      flat.add(name);
    }
  }
  return flat;
}

/**
 * Every reading as it sits on the shelves, in the same order, except that the volumes of a series
 * read in the same year sit together, where the newest of them would.
 */
export function shelve(readings: ApiReading[]): ShelfBook[] {
  const flat = flatSeries(readings);
  const runs: ShelfBook[][] = [];
  /** the run each series takes in each year, by year and series name */
  const bySeries = new Map<string, ShelfBook[]>();
  for (const reading of readings) {
    const { series } = reading.book;
    const item = toShelfBook(reading, !!series && flat.has(series));
    const key = series && `${reading.read.slice(0, 4)} ${series}`;
    let run = key ? bySeries.get(key) : undefined;
    if (!run) {
      run = [];
      runs.push(run);
      if (key) bySeries.set(key, run);
    }
    run.push(item);
  }
  return runs.flat();
}

function toShelfBook({ id, read, book, readBy, addedBy }: ApiReading, lying: boolean): ShelfBook {
  const seed = hash(book.id);
  return {
    key: id,
    book: {
      id: book.id,
      title: book.title,
      author: book.authors.join(', '),
      year: book.year ?? undefined,
      pages: book.pages ?? undefined,
      coverUrl: book.coverUrl ?? undefined,
      description: book.description ?? undefined,
      series: book.series ?? undefined,
      colors: PALETTES[seed % PALETTES.length],
    },
    // the volumes of a series share their size, give or take their thickness
    width: lying
      ? thickness(book.pages, SERIES_RANGE, SERIES_WIDTHS[(seed >>> 4) % SERIES_WIDTHS.length])
      : thickness(book.pages, SPINE_RANGE, WIDTHS[(seed >>> 4) % WIDTHS.length]),
    height: HEIGHTS[(hash(book.series ?? book.id) >>> 12) % HEIGHTS.length],
    lying,
    read,
    readBy,
    addedBy,
  };
}

/** What sits on each shelf besides the spines, top shelf first; the shelves below get nothing. */
export const shelfDecor: ShelfOptions[] = [
  {},
  {},
  { lean: true },
  { candle: true },
  { lean: true },
  {},
];
