import type { ApiBook, ApiReading, Book, ShelfBook, ShelfOptions } from './types';

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

/**
 * Cloth dyed after a cover's dominant colour: its hue, kept as dark as the hand-picked palettes
 * so the gilt lettering stays readable on any cover, even a white one.
 */
function paletteFrom(color: string): Book['colors'] {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const chroma = max - min;
  const sat = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * light - 1));
  const hue =
    chroma === 0
      ? 0
      : max === r
        ? ((g - b) / chroma + 6) % 6
        : max === g
          ? (b - r) / chroma + 2
          : (r - g) / chroma + 4;

  const h = Math.round(hue * 60);
  const s = Math.round(Math.min(sat, 0.6) * 100);
  const l = Math.round(Math.min(Math.max(light, 0.12), 0.26) * 100);
  return {
    c1: `hsl(${h} ${s}% ${l}%)`,
    c2: `hsl(${h} ${s}% ${Math.round(l / 2)}%)`,
    // a grey cover keeps a grey accent rather than the red of hue 0
    accent: `hsl(${h} ${s < 8 ? s : Math.max(s, 30)}% 74%)`,
    ink: `hsl(${h} ${Math.round(s / 3)}% 91%)`,
  };
}

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
      coverColor: book.coverColor ?? undefined,
      description: book.description ?? undefined,
      series: book.series ?? undefined,
      colors: book.coverColor ? paletteFrom(book.coverColor) : PALETTES[seed % PALETTES.length],
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

const SAMPLE_READER = { id: 'sample', name: 'A reader', avatar: null };

function sample(
  id: string,
  read: string,
  book: Omit<ApiBook, 'id' | 'isbn' | 'series'> & { series?: string }
): ApiReading {
  return {
    id: `sample-${id}`,
    read,
    createdAt: read,
    book: { id, isbn: null, series: null, ...book },
    readBy: SAMPLE_READER,
    addedBy: SAMPLE_READER,
  };
}

/** What the shelves hold for visitors who are not logged in, newest read first. */
export const sampleReadings: ShelfBook[] = shelve([
  sample('OL24468510W', '2025-09-12', {
    title: 'Frieren: Beyond Journey’s End, Vol. 1',
    authors: ['Kanehito Yamada', 'Tsukasa Abe'],
    year: 2021,
    pages: 192,
    coverUrl: 'https://covers.openlibrary.org/b/id/11075074-L.jpg',
    coverColor: null,
    description:
      'The demon king is dead and the hero’s party goes home. For the elf mage Frieren, who will outlive them all by centuries, the journey that really matters is only beginning.',
  }),
  sample('OL482454W', '2024-11-03', {
    title: 'Cloud Atlas',
    authors: ['David Mitchell'],
    year: 2004,
    pages: 537,
    coverUrl: 'https://covers.openlibrary.org/b/id/6714077-L.jpg',
    coverColor: null,
    description:
      'Six lives nested inside one another like Russian dolls, from a notary crossing the Pacific in 1850 to a goatherd in a far, fallen future, each one reading the story before it.',
  }),
  sample('OL503424W', '2023', {
    title: 'Quo Vadis',
    authors: ['Henryk Sienkiewicz'],
    year: 1895,
    pages: 477,
    coverUrl: 'https://covers.openlibrary.org/b/id/833096-L.jpg',
    coverColor: null,
    description:
      'Rome under Nero: the patrician Marcus Vinicius falls for Lygia, a Christian hostage, as the city burns and the persecution of her faith begins.',
  }),
  sample('OL17837119W', '2022-04-18', {
    title: '12 Rules for Life',
    authors: ['Jordan B. Peterson'],
    year: 2018,
    pages: 480,
    coverUrl: 'https://covers.openlibrary.org/b/id/8131760-L.jpg',
    coverColor: null,
    description:
      'An antidote to chaos in twelve rules, from standing up straight with your shoulders back to petting a cat when you meet one on the street.',
  }),
  sample('OL82586W', '2021-12-24', {
    title: 'Harry Potter and the Deathly Hallows',
    authors: ['J. K. Rowling'],
    year: 2007,
    pages: 701,
    coverUrl: 'https://covers.openlibrary.org/b/id/15158660-L.jpg',
    coverColor: null,
    description:
      'Dumbledore is gone, and Harry, Ron and Hermione leave Hogwarts behind to hunt down the Horcruxes that keep Voldemort alive.',
    series: 'Harry Potter',
  }),
  sample('OL82565W', '2021-11-06', {
    title: 'Harry Potter and the Half-Blood Prince',
    authors: ['J. K. Rowling'],
    year: 2005,
    pages: 640,
    coverUrl: 'https://covers.openlibrary.org/b/id/10716273-L.jpg',
    coverColor: null,
    description:
      'Dumbledore shows Harry the memories of the boy Tom Riddle once was, while an old potions book signed by the Half-Blood Prince makes him the best in his class.',
    series: 'Harry Potter',
  }),
  sample('OL82548W', '2021-09-19', {
    title: 'Harry Potter and the Order of the Phoenix',
    authors: ['J. K. Rowling'],
    year: 2003,
    pages: 870,
    coverUrl: 'https://covers.openlibrary.org/b/id/15158666-L.jpg',
    coverColor: null,
    description:
      'No one believes Voldemort is back, the Ministry sends Dolores Umbridge to Hogwarts, and Harry starts teaching his friends to defend themselves in secret.',
    series: 'Harry Potter',
  }),
  sample('OL82560W', '2021-07-02', {
    title: 'Harry Potter and the Goblet of Fire',
    authors: ['J. K. Rowling'],
    year: 2000,
    pages: 672,
    coverUrl: 'https://covers.openlibrary.org/b/id/12059372-L.jpg',
    coverColor: null,
    description:
      'The Goblet of Fire names a fourth champion for the Triwizard Tournament, though Harry is too young to enter and never put his name in.',
    series: 'Harry Potter',
  }),
  sample('OL82536W', '2021-05-15', {
    title: 'Harry Potter and the Prisoner of Azkaban',
    authors: ['J. K. Rowling'],
    year: 1999,
    pages: 416,
    coverUrl: 'https://covers.openlibrary.org/b/id/10580435-L.jpg',
    coverColor: null,
    description: 'Sirius Black has escaped from Azkaban, and everyone says he is coming for Harry.',
    series: 'Harry Potter',
  }),
  sample('OL82537W', '2021-03-08', {
    title: 'Harry Potter and the Chamber of Secrets',
    authors: ['J. K. Rowling'],
    year: 1998,
    pages: 339,
    coverUrl: 'https://covers.openlibrary.org/b/id/15158664-L.jpg',
    coverColor: null,
    description:
      'Students are being found turned to stone, and a voice in the walls only Harry can hear speaks of the Chamber of Secrets, opened once again.',
    series: 'Harry Potter',
  }),
  sample('OL82563W', '2021-01-10', {
    title: 'Harry Potter and the Philosopher’s Stone',
    authors: ['J. K. Rowling'],
    year: 1997,
    pages: 302,
    coverUrl: 'https://covers.openlibrary.org/b/id/15155833-L.jpg',
    coverColor: null,
    description:
      'On his eleventh birthday, Harry Potter learns that he is a wizard, and leaves the cupboard under the stairs for Hogwarts School of Witchcraft and Wizardry.',
    series: 'Harry Potter',
  }),
]);
