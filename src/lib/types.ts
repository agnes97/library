export type User = {
  id: string;
  email: string;
  lastLoggedIn: string;
  createdAt: string;
  name: string;
  avatar?: string;
};

export type AuthStatus = 'initializing' | 'loading' | 'authenticated' | 'unauthenticated';

export type ThemeId =
  | 'pink-purple'
  | 'blue'
  | 'green'
  | 'cyan-orange'
  | 'red-orange'
  | 'white'
  | 'custom';

export type LoginBody = {
  email: string;
  password: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  year?: number;
  pages?: number;
  coverUrl?: string;
  /** the cover's dominant colour, e.g. #4a2a1c, which the cloth is dyed after */
  coverColor?: string;
  /** a photo of the real spine, standing upright, drawn instead of the cloth */
  spineUrl?: string;
  /** that photo's width over its height */
  spineRatio?: number;
  description?: string;
  series?: string;
  /** its place in the series, as stored or else as its title gives it, e.g. "Vol. 3" */
  seriesNumber?: number;
  colors: {
    c1: string;
    c2: string;
    accent: string;
    ink: string;
    /** the lettering's shadow, when it is not the dark one gilt needs */
    shadow?: string;
  };
};

export type ShelfBook = {
  key: string;
  book: Book;
  /** spine width in px */
  width: number;
  /** how much room it takes in a pile, as thick as its pages make it whatever its photo shows */
  bulk: number;
  /** a volume of a series that lies flat in piles instead of standing */
  lying: boolean;
  /** spine height in px */
  height: number;
  /** tipped back onto its neighbour, standing this many px off it */
  lean?: number;
  /** the day it was read, as an ISO date, or only its year */
  read: string;
  readBy: Reader;
  addedBy: Reader;
  /** the year on the tag hanging over it, when it is the first book read that year, or the label */
  tag?: number | string;
  /** hang the tag from the book's right edge, as there is no room for it on the right */
  tagFlip?: boolean;
};

/** volumes of one series read one after another, lying flat on each other */
export type ShelfPile = {
  key: string;
  /** bottom one first */
  pile: ShelfBook[];
  /** the year on the tag hanging over it, when it holds the first book read that year, or the label */
  tag?: number | string;
  /** hang the tag from the pile's right edge, as there is no room for it on the right */
  tagFlip?: boolean;
};

export type ShelfOptions = {
  candle?: boolean;
  /** tip the last book over */
  lean?: boolean;
};

export type Shelf = {
  key: string;
  /** standing spines and piles of series volumes, in reading order */
  items: (ShelfBook | ShelfPile)[];
  /** the item a lit candle stands before, or as many as there are when it stands after them all */
  candleAt: number | null;
  /** how far in from the row's padding its contents begin, centred as they are */
  start: number;
};

export type BookResult = {
  /** Open Library work key, e.g. /works/OL45804W */
  key: string;
  title: string;
  authors: string[];
  year?: number;
  pages?: number;
  coverUrl?: string;
  isbn?: string;
};

export type Reader = {
  id: string;
  name: string;
  avatar: string | null;
};

/** an edition's cover the reader can pick instead of the one the book came with */
export type EditionCover = {
  /** the thumbnail; prismify fetches the large one */
  url: string;
  /** its title, language and year, e.g. "Malý princ · Czech · 1998" */
  label: string;
  /** the language's name in English, e.g. "Czech", when Open Library knows it */
  language?: string;
  /** what else tells the editions apart, e.g. "1998 · Albatros · Hardcover" */
  details: string;
};

/** a book as prismify stores it, shared by everyone who read it */
export type ApiBook = {
  /** Open Library work id, e.g. OL45804W */
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  pages: number | null;
  coverUrl: string | null;
  coverColor: string | null;
  spineUrl: string | null;
  /** the spine photo's dominant colour, which dyes the cloth over the cover's */
  spineColor: string | null;
  spineRatio: number | null;
  isbn: string | null;
  description: string | null;
  series: string | null;
  /** its place in the series, e.g. 3, or 1.5 for a novella between */
  seriesNumber: number | null;
};

/**
 * a correction to a book that came wrong from Open Library; an empty description clears it, and an
 * empty series takes the book out of it along with its number
 */
export type BookEdit = Partial<Pick<ApiBook, 'title' | 'authors' | 'seriesNumber'>> & {
  description?: string;
  series?: string;
};

/** a reading as prismify's /library/readings returns it */
export type ApiReading = {
  id: string;
  /** an ISO date, or only the year when the day is forgotten */
  read: string;
  createdAt: string;
  book: ApiBook;
  readBy: Reader;
  addedBy: Reader;
};

export type NewReading = {
  book: BookResult;
  read: string;
};

/** an AI service the reader can connect with their own API key */
export type AiProvider = 'openai';

/** a reader's API key as prismify tells of it: only its last four characters */
export type AiKey = { hint: string };

/** the reader's API keys by provider, null where none is connected */
export type AiKeys = Record<AiProvider, AiKey | null>;

/**
 * a search for or drawing of a spine as it runs at OpenAI, in the background as it takes longer
 * than a request may: still working, by its job id, or what it came to
 */
export type SpineJob =
  | { status: 'working'; job: string }
  | { status: 'done'; candidates: SpineCandidate[] }
  | { status: 'done'; image: string };

/** a photo of a book's spine ChatGPT found on the web */
export type SpineCandidate = {
  /** the photo on the web, sent back to draw the spine after */
  imageUrl: string;
  /** the page it was found on */
  pageUrl: string;
  /** a small copy of it as a data URL, as many sites won't show their photos elsewhere */
  preview: string;
  /** what the photo shows, in a few words */
  note: string;
};
