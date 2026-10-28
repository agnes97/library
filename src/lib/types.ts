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
  /** spine width in px */
  width: number;
  /** spine height in px */
  height: number;
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
};
