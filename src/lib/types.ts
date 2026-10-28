export type User = {
  id: string;
  email: string;
  lastLoggedIn: string;
  createdAt: string;
  name: string;
  avatar?: string;
};

export type AuthStatus = 'initializing' | 'loading' | 'authenticated' | 'unauthenticated';

export type LoginBody = {
  email: string;
  password: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  year: number;
  description: string;
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
  /** spine height in px */
  height: number;
  /** tipped against its neighbour */
  lean: boolean;
};

export type Shelf = {
  key: string;
  books: ShelfBook[];
  /** books lying flat in a pile after the spines, bottom one first */
  pile: ShelfBook[];
  /** a lit candle after the spines */
  candle: boolean;
};
