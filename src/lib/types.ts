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
  description?: string;
  series?: string;
  colors: {
    c1: string;
    c2: string;
    accent: string;
    ink: string;
  };
};

export type ShelfBook = {
  key: string;
  book: Book;
  /** spine width in px */
  width: number;
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
  /** the year on the tag hanging over it, when it is the first book read that year */
  tag?: number;
  /** hang the tag from the book's right edge, as there is no room for it on the right */
  tagFlip?: boolean;
};

/** volumes of one series read one after another, lying flat on each other */
export type ShelfPile = {
  key: string;
  /** bottom one first */
  pile: ShelfBook[];
  /** the year on the tag hanging over it, when it holds the first book read that year */
  tag?: number;
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
  /** a lit candle after the spines */
  candle: boolean;
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

/** a reading as prismify's /library/readings returns it */
export type ApiReading = {
  id: string;
  /** an ISO date, or only the year when the day is forgotten */
  read: string;
  createdAt: string;
  book: {
    /** Open Library work id, e.g. OL45804W */
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    pages: number | null;
    coverUrl: string | null;
    isbn: string | null;
    description: string | null;
    series: string | null;
  };
  readBy: Reader;
  addedBy: Reader;
};

export type NewReading = {
  book: BookResult;
  read: string;
};
