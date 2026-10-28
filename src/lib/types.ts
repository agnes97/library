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

/** an edition's cover the reader can pick instead of the one the book came with */
export type EditionCover = {
  /** the thumbnail; prismify fetches the large one */
  url: string;
  /** its title, language and year, e.g. "Malý princ · cze · 1998" */
  label: string;
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
  isbn: string | null;
  description: string | null;
  series: string | null;
};

/** a correction to a book that came wrong from Open Library; an empty description clears it */
export type BookEdit = Partial<Pick<ApiBook, 'title' | 'authors'>> & { description?: string };

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
