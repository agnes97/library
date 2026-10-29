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

/** Cloth lighter than this gets dark lettering instead of gilt. */
const LIGHT_CLOTH = 0.55;

/**
 * Cloth dyed after the spine photo's or the cover's dominant colour, as light or dark as it is, lettered in
 * gilt when it is dark and in ink when it is light, so a white cover gets a white spine.
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
  const s = Math.round(Math.min(sat, 0.8) * 100);
  const l = Math.round(Math.min(Math.max(light, 0.1), 0.9) * 100);
  const pale = light > LIGHT_CLOTH;
  // a grey cover keeps a grey accent rather than the red of hue 0
  const accentSat = s < 8 ? s : Math.max(s, 30);
  return {
    c1: `hsl(${h} ${s}% ${l}%)`,
    // the shade at the foot of the spine, gentler on pale cloth
    c2: `hsl(${h} ${s}% ${Math.max(l - 14, Math.round(l / 2))}%)`,
    accent: `hsl(${h} ${accentSat}% ${pale ? 32 : 74}%)`,
    ink: `hsl(${h} ${Math.round(s / 3)}% ${pale ? 14 : 91}%)`,
    ...(pale && { shadow: `hsl(${h} ${s}% 97% / 0.5)` }),
  };
}

/** FNV-1a, so a book gets the same colours and size on every visit. */
function hash(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A photographed spine keeps its shape, within what the shelves can hold. */
const PHOTO_WIDTHS: [number, number] = [16, 110];

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
 * A volume's number as its title gives it, e.g. "Vol. 3", "Book 2", "#5", "3. díl", or a number
 * ending it, as in "Frieren 4"; only asked of books in a series.
 */
const VOLUME =
  /\b(?:vol(?:ume)?|book|part|tome|band|no|díl|svazek|kniha)\.?\s*(\d+(?:\.\d+)?)|#\s*(\d+(?:\.\d+)?)|\b(\d+)\.\s*(?:díl|svazek|kniha)|\s(\d{1,2})$/i;

function volumeFromTitle(title: string): number | undefined {
  const match = VOLUME.exec(title.trim());
  const number = match?.slice(1).find(Boolean);
  return number ? Number(number) : undefined;
}

/**
 * The volumes of a series read in the same year, lowest number first, so the first volume stands
 * leftmost or lies at the bottom of the pile; one with no number keeps its place among them.
 */
function inSeriesOrder(run: ShelfBook[]): ShelfBook[] {
  const numbered = run
    .filter(({ book }) => book.seriesNumber !== undefined)
    .toSorted((a, b) => (a.book.seriesNumber ?? 0) - (b.book.seriesNumber ?? 0));
  return run.map((item) => (item.book.seriesNumber === undefined ? item : numbered.shift()!));
}

/**
 * Every reading as it sits on the shelves, in the same order, except that the volumes of a series
 * read in the same year sit together, where the newest of them would, in the order of the series.
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
  return runs.flatMap(inSeriesOrder);
}

function toShelfBook({ id, read, book, readBy, addedBy }: ApiReading, lying: boolean): ShelfBook {
  const seed = hash(book.id);
  const height = HEIGHTS[(hash(book.series ?? book.id) >>> 12) % HEIGHTS.length];
  const dye = book.spineColor ?? book.coverColor;
  const bulk = lying
    ? thickness(book.pages, SERIES_RANGE, SERIES_WIDTHS[(seed >>> 4) % SERIES_WIDTHS.length])
    : thickness(book.pages, SPINE_RANGE, WIDTHS[(seed >>> 4) % WIDTHS.length]);
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
      spineUrl: book.spineUrl ?? undefined,
      spineRatio: book.spineRatio ?? undefined,
      description: book.description ?? undefined,
      series: book.series ?? undefined,
      seriesNumber: book.series ? (book.seriesNumber ?? volumeFromTitle(book.title)) : undefined,
      colors: dye ? paletteFrom(dye) : PALETTES[seed % PALETTES.length],
    },
    // the volumes of a series share their size, give or take their thickness
    width: book.spineRatio
      ? Math.round(Math.min(Math.max(height * book.spineRatio, PHOTO_WIDTHS[0]), PHOTO_WIDTHS[1]))
      : bulk,
    bulk,
    height,
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
  book: Omit<
    ApiBook,
    'id' | 'isbn' | 'series' | 'seriesNumber' | 'spineUrl' | 'spineColor' | 'spineRatio'
  > &
    Partial<Pick<ApiBook, 'series' | 'seriesNumber' | 'spineUrl' | 'spineColor' | 'spineRatio'>>
): ApiReading {
  return {
    id: `sample-${id}`,
    read,
    createdAt: read,
    book: {
      id,
      isbn: null,
      series: null,
      seriesNumber: null,
      spineUrl: null,
      spineColor: null,
      spineRatio: null,
      ...book,
    },
    readBy: SAMPLE_READER,
    addedBy: SAMPLE_READER,
  };
}

/** What the shelves hold for visitors who are not logged in, newest read first. */
export const sampleReadings: ApiReading[] = [
  sample('OL45870364W', '2026-10-09', {
    title: 'Threshing Day',
    authors: ['Rebecca Yarros'],
    year: 2026,
    pages: 254,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL45870364W-a38d008a9330.webp',
    coverColor: '#cecfd1',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL45870364W-8a9315647194.webp',
    spineColor: '#928d8f',
    spineRatio: 0.09,
    description:
      'The next book in the blockbuster Empyrean series, *Threshing Day* contains thirteen stories starring your favorite characters and their dragons. The deluxe first edition includes sixteen beautiful original full-color illustrations by artist Joe Requeza. This breathtaking collectible is available only in the US and Canada while supplies last.',
    series: 'The Empyrean',
  }),
  sample('OL482454W', '2024-11-03', {
    title: 'Cloud Atlas',
    authors: ['David Mitchell'],
    year: 2004,
    pages: 537,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL482454W-93359023af46.webp',
    coverColor: '#8c0251',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL482454W-1f63bfd793e3.webp',
    spineColor: '#844e59',
    spineRatio: 0.145,
    description:
      'Six lives nested inside one another like Russian dolls, from a notary crossing the Pacific in 1850 to a goatherd in a far, fallen future, each one reading the story before it.',
  }),
  sample('OL503424W', '2023', {
    title: 'Quo Vadis',
    authors: ['Henryk Sienkiewicz'],
    year: 1895,
    pages: 477,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL30514149W-3f1d98777bfa.webp',
    coverColor: '#6c6a2b',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL30514149W-707d2da7b3f2.webp',
    spineColor: '#524c1a',
    spineRatio: 0.184,
    description:
      'Rome under Nero: the patrician Marcus Vinicius falls for Lygia, a Christian hostage, as the city burns and the persecution of her faith begins.',
  }),
  sample('OL24468510W', '2025-09-12', {
    title: 'Frieren: Beyond Journey’s End, Vol. 1',
    authors: ['Kanehito Yamada', 'Tsukasa Abe'],
    year: 2021,
    pages: 192,
    coverUrl: 'https://covers.openlibrary.org/b/id/11075074-L.jpg',
    coverColor: null,
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL24468510W-07a2793d0eb3.webp',
    spineColor: '#d1d0cd',
    spineRatio: 0.08,
    description:
      'The demon king is dead and the hero’s party goes home. For the elf mage Frieren, who will outlive them all by centuries, the journey that really matters is only beginning.',
  }),
  sample('OL17352669W', '2025', {
    title: 'A Court of Thorns and Roses',
    authors: ['Sarah J. Maas'],
    year: 2013,
    pages: 454,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL17352669W-fd86ed1158e6.webp',
    coverColor: '#ed394d',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL17352669W-3b1745090a81.webp',
    spineColor: '#cb323c',
    spineRatio: 0.136,
    description:
      "When nineteen-year-old huntress Feyre kills a wolf in the woods, a terrifying creature arrives to demand retribution. Dragged to a treacherous magical land she knows about only from legends, Feyre discovers that her captor is not truly a beast, but one of the lethal, immortal faeries who once ruled her world.\r\n\r\nAt least, he's not a beast all the time.\r\n\r\nAs she adapts to her new home, her feelings for the faerie, Tamlin, transform from icy hostility into a fiery passion that burns through every lie she's been told about the beautiful, dangerous world of the Fae. But something is not right in the faerie lands. An ancient, wicked shadow is growing, and Feyre must find a way to stop it, or doom Tamlin-and his world-forever.",
    series: 'ACOTAR',
  }),
  sample('OL17837119W', '2022-04-18', {
    title: '12 Rules for Life',
    authors: ['Jordan B. Peterson'],
    year: 2018,
    pages: 480,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL17837119W-289a255723ea.webp',
    coverColor: '#fafafa',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL17837119W-7eacbfbe7946.webp',
    spineColor: '#e9e7e3',
    spineRatio: 0.089,
    description:
      'An antidote to chaos in twelve rules, from standing up straight with your shoulders back to petting a cat when you meet one on the street.',
  }),
  sample('OL82560W', '2021-07-02', {
    title: 'Harry Potter and the Goblet of Fire',
    authors: ['J. K. Rowling'],
    year: 2000,
    pages: 672,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL82560W-c0f27a5f3c35.webp',
    coverColor: '#6d2f54',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL82560W-3bba23cf7d7e.webp',
    spineColor: '#6f5492',
    spineRatio: 0.223,
    description:
      'The Goblet of Fire names a fourth champion for the Triwizard Tournament, though Harry is too young to enter and never put his name in.',
    series: 'Harry Potter',
    seriesNumber: 4,
  }),
  sample('OL82536W', '2021-05-15', {
    title: 'Harry Potter and the Prisoner of Azkaban',
    authors: ['J. K. Rowling'],
    year: 1999,
    pages: 416,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL82536W-6c135ed1ad39.webp',
    coverColor: '#31566e',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL82536W-eee425705d39.webp',
    spineColor: '#4b6a90',
    spineRatio: 0.197,
    description: 'Sirius Black has escaped from Azkaban, and everyone says he is coming for Harry.',
    series: 'Harry Potter',
    seriesNumber: 3,
  }),
  sample('OL82537W', '2021-03-08', {
    title: 'Harry Potter and the Chamber of Secrets',
    authors: ['J. K. Rowling'],
    year: 1998,
    pages: 339,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL82537W-3f5ab9b196ac.webp',
    coverColor: '#2b4b76',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL82537W-d007758efbf8.webp',
    spineColor: '#6f996b',
    spineRatio: 0.18,
    description:
      'Students are being found turned to stone, and a voice in the walls only Harry can hear speaks of the Chamber of Secrets, opened once again.',
    series: 'Harry Potter',
    seriesNumber: 2,
  }),
  sample('OL82563W', '2021-01-10', {
    title: 'Harry Potter and the Philosopher’s Stone',
    authors: ['J. K. Rowling'],
    year: 1997,
    pages: 302,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL82563W-6d1c322e9265.webp',
    coverColor: '#c6161d',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL82563W-95a7e70d8348.webp',
    spineColor: '#e75157',
    spineRatio: 0.156,
    description:
      'On his eleventh birthday, Harry Potter learns that he is a wizard, and leaves the cupboard under the stairs for Hogwarts School of Witchcraft and Wizardry.',
    series: 'Harry Potter',
    seriesNumber: 1,
  }),
  // the reader photographed every spine of this one
  sample('OL7924103W', '2024', {
    title: 'The Eye of the World',
    authors: ['Robert Jordan'],
    year: 1990,
    pages: 782,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924103W-89c3cc1fa9d9.webp',
    coverColor: '#111518',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924103W-4e83d09147f4.webp',
    spineColor: '#8c4945',
    spineRatio: 0.229,
    description:
      'The Wheel of Time turns and Ages come and go, leaving memories that become legend. Legend fades to myth, and even myth is long forgotten when the Age that gave it birth returns again. In the Third Age, an Age of Prophecy, the World and Time themselves hang in the balance. What was, what will be, and what is, may yet fall under the Shadow.',
    series: 'Wheel of Time',
    seriesNumber: 1,
  }),
  sample('OL7924135W', '2024', {
    title: 'The Great Hunt (The Wheel of Time Book 2)',
    authors: ['Robert Jordan'],
    year: 1990,
    pages: 656,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924135W-96e7b184e875.webp',
    coverColor: '#e9e9e9',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924135W-473f13b64f32.webp',
    spineColor: '#773435',
    spineRatio: 0.197,
    description:
      'Now in development for TV!\r\n\r\nSince its debut in 1990, The Wheel of Time® by Robert Jordan has captivated millions of readers around the globe with its scope, originality, and compelling characters.\r\n\r\nThe Wheel of Time turns and Ages come and go, leaving memories that become legend. Legend fades to myth, and even myth is long forgotten when the Age that gave it birth returns again. In the Third Age, an Age of Prophecy, the World and Time themselves hang in the balance. What was, what will be, and what is, may yet fall under the Shadow.\r\n\r\nFor centuries, gleemen have told the tales of The Great Hunt of the Horn. So many tales about each of th Hunters, and so many Hunters to tell of...Now the Horn itself is found: the Horn of Valere long thought only legend, the Horn which will raise the dead heroes of the ages. And it is stolen.\r\n\r\nTV series update: "Sony will produce along with Red Eagle Entertainment and Radar Pictures. Rafe Judkins is attached to write and executive produce. Judkins previously worked on shows such as ABC’s “Agents of SHIELD,” the Netflix series “Hemlock Grove,” and the NBC series “Chuck.” Red Eagle partners Rick Selvage and Larry Mondragon will executive produce along with Radar’s Ted Field and Mike Weber. Darren Lemke will also executive produce, with Jordan’s widow Harriet McDougal serving as consulting producer." —*Variety*\r\n\r\nThe Wheel of Time**®**\r\nNew Spring: The Novel\r\n#1 The Eye of the World\r\n#2 The Great Hunt\r\n#3 The Dragon Reborn\r\n#4 The Shadow Rising\r\n#5 The Fires of Heaven\r\n#6 Lord of Chaos\r\n#7 A Crown of Swords\r\n#8 The Path of Daggers\r\n#9 Winter\'s Heart\r\n#10 Crossroads of Twilight\r\n#11 Knife of Dreams\r\n\r\nBy Robert Jordan and Brandon Sanderson\r\n#12 The Gathering Storm\r\n#13 Towers of Midnight\r\n#14 A Memory of Light',
    series: 'Wheel of Time',
    seriesNumber: 2,
  }),
  sample('OL7924143W', '2024', {
    title: 'The Dragon Reborn',
    authors: ['Robert Jordan'],
    year: 1991,
    pages: 670,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924143W-b14a87f8cbac.webp',
    coverColor: '#883038',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924143W-0b3516fb8f10.webp',
    spineColor: '#793435',
    spineRatio: 0.198,
    description:
      "The Dragon Reborn—the leader long prophesied who will save the world, but in the saving destroy it; the savior who will run mad and kill all those dearest to him—is on the run from his destiny.\r\n\r\nAble to touch the One Power, but unable to control it, and with no one to teach him how—for no man has done it in three thousand years—Rand al'Thor knows only that he must face the Dark One. But how?\r\n\r\nWinter has stopped the war—almost—yet men are dying, calling out for the Dragon. But where is he?\r\n\r\nPerrin Aybara is in pursuit with Moiraine Sedai, her Warder Lan, and Loial the Ogier. Bedeviled by dreams, Perrin is grappling with another deadly problem—how is he to escape the loss of his own humanity?\r\n\r\nEgwene, Elayne and Nynaeve are approaching Tar Valon, where Mat will be healed—if he lives until they arrive. But who will tell the Amyrlin their news—that the Black Ajah, long thought only a hideous rumor, is all too real? They cannot know that in Tar Valon far worse awaits...\r\n\r\nAhead, for all of them, in the Heart of the Stone, lies the next great test of the Dragon reborn....",
    series: 'Wheel of Time',
    seriesNumber: 3,
  }),
  sample('OL7924199W', '2024', {
    title: 'The Shadow Rising',
    authors: ['Robert Jordan'],
    year: 1992,
    pages: 984,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924199W-27061a6a855e.webp',
    coverColor: '#2a2b30',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924199W-17cb956481eb.webp',
    spineColor: '#b36c4c',
    spineRatio: 0.213,
    description:
      'The Wheel of Time turns and Ages come and go, leaving memories that become legend. Legend fades to myth, and even myth is long forgotten when the Age that gave it birth returns again. In the Third Age, an Age of Prophecy, the World and Time themselves hang in the balance. What was, what will be, and what is, may yet fall under the Shadow.\r\nThe seals of Shayol Ghul are weak now, and the Dark One reaches out. The Shadow is rising to cover humankind.\r\nIn Tar Valon, Min sees portents of hideous doom. Will the White Tower itself be broken?\r\nIn the Two Rivers, the Whitecloaks ride in pursuit of a man with golden eyes, and in pursuit of the Dragon Reborn.\r\nIn Cantorin, among the Sea Folk, High Lady Suroth plans the return of the Seanchan armies to the mainland.\r\nIn the Stone of Tear, the Lord Dragon considers his next move. It will be something no one expects, not the Black Ajah, not Tairen nobles, not Aes Sedai, not Egwene or Elayne or Nynaeve.\r\nAgainst the Shadow rising stands the Dragon Reborn...',
    series: 'Wheel of Time',
    seriesNumber: 4,
  }),
  sample('OL7924172W', '2024', {
    title: 'The Fires of Heaven',
    authors: ['Robert Jordan'],
    year: 1993,
    pages: 894,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924172W-d9c0b543e119.webp',
    coverColor: '#c76827',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924172W-8a34337e2768.webp',
    spineColor: '#b35247',
    spineRatio: 0.23,
    description:
      "The bonds and wards that hold the Great Lord of the Dark are slowly failing, but still his fragile prison holds. The Forsaken, immortal servants of the shadow, weave their snares and tighten their grip upon the realms of men, sure in the knowledge that their master will soon break free...\r\nRand al' Thor, the Dragon Reborn, knows that he must strike at the Enemy, but his forces are divided by treachery and by ambition. Even the Aes Sedai, ancient guardians of the Light, are riven by civil war. Betrayed by his allies, pursued by his enemies and beset by the madness that comes to the male wielders of the One Power, Rand rides out to meet the foe.",
    series: 'Wheel of Time',
    seriesNumber: 5,
  }),
  sample('OL7924208W', '2024', {
    title: 'Lord of Chaos',
    authors: ['Robert Jordan'],
    year: 1994,
    pages: 921,
    coverUrl: 'https://covers.openlibrary.org/b/id/182398-M.jpg',
    coverColor: null,
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924208W-7b8b1003d1fe.webp',
    spineColor: '#b56b4f',
    spineRatio: 0.223,
    description:
      "The Wheel of Time turns and Ages come and go, leaving memories that become legend. Legend fades to myth, and even myth is long forgotten when the Age that gave it birth returns again. In the Third Age, an Age of Prophecy, the World and Time themselves hang in the balance. What was, what will be, and what is, may yet fall under the Shadow.\r\n\r\nOn the slopes of Shayol Ghul, the Myrddraal swords are forged, and the sky is not the sky of this world;\r\n\r\nIn Salidar the White Tower in exile prepares an embassy to Caemlyn, where Rand Al'Thor, the Dragon Reborn, holds the throne--and where an unexpected visitor may change the world....\r\n\r\nIn Emond's Field, Perrin Goldeneyes, Lord of the Two Rivers, feels the pull of ta'veren to ta'veren and prepares to march...\r\n\r\nMorgase of Caemlyn finds a most unexpected, and quite unwelcome, ally....And south lies Illian, where Sammael holds sway...\r\n\r\nTV series update: \"Sony will produce along with Red Eagle Entertainment and Radar Pictures. Rafe Judkins is attached to write and executive produce. Judkins previously worked on shows such as ABC’s “Agents of SHIELD,” the Netflix series “Hemlock Grove,” and the NBC series “Chuck.” Red Eagle partners Rick Selvage and Larry Mondragon will executive produce along with Radar’s Ted Field and Mike Weber. Darren Lemke will also executive produce, with Jordan’s widow Harriet McDougal serving as consulting producer.\" —*Variety*\r\n\r\nThe Wheel of Time**®**\r\nNew Spring: The Novel\r\n#1 The Eye of the World\r\n#2 The Great Hunt\r\n#3 The Dragon Reborn\r\n#4 The Shadow Rising\r\n#5 The Fires of Heaven\r\n#6 Lord of Chaos\r\n#7 A Crown of Swords\r\n#8 The Path of Daggers\r\n#9 Winter's Heart\r\n#10 Crossroads of Twilight\r\n#11 Knife of Dreams\r\n\r\nBy Robert Jordan and Brandon Sanderson\r\n#12 The Gathering Storm\r\n#13 Towers of Midnight\r\n#14 A Memory of Light",
    series: 'Wheel of Time',
    seriesNumber: 6,
  }),
  sample('OL7924161W', '2024', {
    title: 'A Crown of Swords (The Wheel of Time, Book 7)',
    authors: ['Robert Jordan'],
    year: 1996,
    pages: 771,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924161W-dc4335b7d0a0.webp',
    coverColor: '#67635b',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924161W-aaa9a2a62e56.webp',
    spineColor: '#b35049',
    spineRatio: 0.224,
    description:
      'Terwijl de eindstrijd tussen de Draak en het Kwade steeds dichterbij komt, wordt het klimaat langzaam aan slechter.',
    series: 'Wheel of Time',
    seriesNumber: 7,
  }),
  sample('OL1946687W', '2024', {
    title: 'The Path of Daggers',
    authors: ['Robert Jordan'],
    year: 1998,
    pages: 608,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL1946687W-5189e620ed0b.webp',
    coverColor: '#2a5755',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL1946687W-9b6e2cc990da.webp',
    spineColor: '#8e4e4b',
    spineRatio: 0.205,
    description:
      "From Publishers Weekly\r\nThe eighth book of Jordan's bestselling The Wheel of Time saga (A Crown of Swords, etc.) opens with a renewed invasion by the Seanchans, a conquering race whose arsenal includes man-carrying flying reptiles and enslaved female magic-workers as well as powerful soldiers, many of whom have joined the Seanchans out of fear of the Dragon Reborn. The Dragon himself, Rand al'Thor, appears in only a small part of the narrative, but during that time he endures the ugly experience of seeing his magic kill his friends, heightening his fear that his destiny is to slay everyone he cares about. The first third of the book is a little slower paced than is usual for Jordan, emphasizing the growth of relationships, but the action picks up soon enough. More compact than some previous volumes in the saga, this one has the virtues readers have come to expect from the author: meticulous world-building; deft use of multiple viewpoints; highly original and intelligent systems of magic; an admirable wit; and a continuous awareness of the fate of the turnip farmer or peddler caught in the path of the heroes' armies. Unlike some authors of megasagas, Jordan chooses his words with care, creating people and events that have earned him an enormous readership. For sheer imagination and storytelling skill, if not quite for mythic resonance, The Wheel of Time now rivals Tolkien's The Lord of the Rings.",
    series: 'Wheel of Time',
    seriesNumber: 8,
  }),
  sample('OL7924207W', '2024', {
    title: "Winter's Heart",
    authors: ['Robert Jordan'],
    year: 2000,
    pages: 668,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924207W-767e7ec0a941.webp',
    coverColor: '#5198ad',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924207W-7620ba5c5450.webp',
    spineColor: '#b55049',
    spineRatio: 0.184,
    description:
      'All I can say is this is yet another great chapter in the wheel of time.  A must for the fans. A  new people called The Kin are introduced.  Mat might meet his other wife in this story!',
    series: 'Wheel of Time',
    seriesNumber: 9,
  }),
  sample('OL7924099W', '2024', {
    title: 'Crossroads of Twilight',
    authors: ['Robert Jordan'],
    year: 1995,
    pages: 704,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924099W-a759888999f8.webp',
    coverColor: '#04516b',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924099W-879bff8d6590.webp',
    spineColor: '#c87050',
    spineRatio: 0.198,
    description:
      "Mat Cauthon flees the Shadow and the Seanchan Empire with the kidnapped Daughter of the Nine Moons, while Perrin Aybara seeks to free his captive wife, and Egwere al'Vere seeks to reunite the Aes Sedai.",
    series: 'Wheel of Time',
    seriesNumber: 10,
  }),
  sample('OL7924194W', '2024', {
    title: 'Knife of Dreams',
    authors: ['Robert Jordan'],
    year: 2005,
    pages: 832,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL7924194W-9e6317d92531.webp',
    coverColor: '#cbc7ae',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL7924194W-b6057542f98c.webp',
    spineColor: '#783436',
    spineRatio: 0.216,
    description:
      'In een gefantaseerde wereld maakt een ieder zich op voor de laatste strijd tussen Goed en Kwaad.',
    series: 'Wheel of Time',
    seriesNumber: 11,
  }),
  sample('OL1946681W', '2024', {
    title: 'The Gathering Storm',
    authors: ['Robert Jordan', 'Brandon Sanderson'],
    year: 2009,
    pages: 824,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL1946681W-d564993205f8.webp',
    coverColor: '#12060f',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL1946681W-164d450b5556.webp',
    spineColor: '#b54f47',
    spineRatio: 0.246,
    description:
      'Rand al\'Thor, the Dragon Reborn, struggles to unite a fractured network of kingdoms and alliances in preparation for the Last Battle. Meanwhile, Egwene al\'Vere, the Amyrlin Seat of the rebel Aes Sedai, is being held captive by the White Tower. Knowing the Seanchan attack is imminent, she fights to hold the Aes Sedai together in an epic contest that will prove the mettle of her followers and will decide the future of the White Tower---and possibly the world itself. The first of three novels that will make up "A Memory of Light" and mark the conclusion of the Wheel of Time.',
    series: 'Wheel of Time',
    seriesNumber: 12,
  }),
  sample('OL15414340W', '2024', {
    title: 'Towers of Midnight',
    authors: ['Robert Jordan', 'Brandon Sanderson'],
    year: 2010,
    pages: 944,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL15414340W-cd5528470aae.webp',
    coverColor: '#050505',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL15414340W-2e1b64fd09a8.webp',
    spineColor: '#773335',
    spineRatio: 0.282,
    description:
      "As the seals on the Dark One's prison crumble and the armies of the Shadow boil out of the Blight, Perrin Aybara, hunted by specters from his past, must seek answers in \"Tel'aran'rhiod\" and find a way to master the wolf within him--or lose himself to it forever. Meanwhile, Matrim Cauthon prepares for the most difficult challenge of his life ... as The Tower of Ghenjei awaits.",
    series: 'Wheel of Time',
    seriesNumber: 13,
  }),
  sample('OL16799133W', '2024', {
    title: 'A Memory of Light',
    authors: ['Robert Jordan', 'Brandon Sanderson'],
    year: 2013,
    pages: 920,
    coverUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/covers/OL16799133W-059c7899b40b.webp',
    coverColor: '#f7f6f7',
    spineUrl:
      'https://3cfeg5qp8r4g3blg.public.blob.vercel-storage.com/library/spines/OL16799133W-57468f6b24c9.webp',
    spineColor: '#723635',
    spineRatio: 0.246,
    description:
      'Since 1990, when Robert Jordan’s The Wheel of Time® burst on the world with its first book, The Eye of the World, readers have been anticipating the final scenes of this extraordinary saga, which has sold over forty million copies in over thirty languages.\r\n\r\nWhen Robert Jordan died in 2007, all feared that these concluding scenes would never be written. But working from notes and partials left by Jordan, established fantasy writer Brandon Sanderson stepped in to complete the masterwork. With The Gathering Storm (Book 12) and Towers of Midnight (Book 13) behind him, both of which were # 1 New York Times hardcover bestsellers, Sanderson now re-creates the vision that Robert Jordan left behind.\r\n\r\nEdited by Jordan’s widow, who edited all of Jordan’s books, A Memory of Light will delight, enthrall, and deeply satisfy all of Jordan’s legions of readers.\r\n\r\nThe Wheel of Time turns, and Ages come and pass.\r\nWhat was, what will be, and what is,\r\nmay yet fall under the Shadow.\r\nLet the Dragon ride again on the winds of time.',
    series: 'Wheel of Time',
    seriesNumber: 14,
  }),
];
