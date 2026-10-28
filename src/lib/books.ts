import type { Book, ShelfBook, ShelfOptions } from './types';

export const books: Book[] = [
  {
    id: 'cartographers-silence',
    title: "The Cartographer's Silence",
    author: 'Ilse Marrow',
    year: 1987,
    description:
      'A mapmaker charting a coast that keeps redrawing itself stops speaking the day her maps start to agree with the sea. Her apprentice reads the margins of her charts for the words she no longer says.',
    colors: { c1: '#1a2a36', c2: '#0b141b', accent: '#c48bb8', ink: '#e6dbe6' },
  },
  {
    id: 'salt-and-lanterns',
    title: 'Salt & Lanterns',
    author: 'Tomas Erlend',
    year: 2004,
    description:
      'In a fishing town where every window keeps a lantern lit for those still at sea, a lighthouse keeper counts the lights going out one winter at a time.',
    colors: { c1: '#521a26', c2: '#2a0b12', accent: '#ec93bb', ink: '#f3e2e7' },
  },
  {
    id: 'grammar-of-moths',
    title: 'A Grammar of Moths',
    author: 'Petra Vosk',
    year: 1962,
    description:
      'A retired linguist catalogues the moths that gather at her porch light, and slowly becomes convinced that their flight paths spell out sentences.',
    colors: { c1: '#2b2a1d', c2: '#15140c', accent: '#b9a3d6', ink: '#ebe4d8' },
  },
  {
    id: 'nine-winters-in-vellmar',
    title: 'Nine Winters in Vellmar',
    author: 'Aurel Daske',
    year: 1949,
    description:
      'A chronicle of a mountain city told through nine winters, nine sieges of snow, and the one family that refused to leave when the passes closed for good.',
    colors: { c1: '#3e2246', c2: '#1f0f26', accent: '#e7a0d0', ink: '#f1e5f1' },
  },
];

/** Spine sizes, cycled so neighbouring books never match. */
const WIDTHS = [52, 44, 60, 38, 66, 48, 56, 42, 62, 46];
const HEIGHTS = [286, 248, 270, 300, 262, 236, 292, 254, 278, 244];

const LAST_READ = Date.UTC(2026, 9, 24);
const DAY = 24 * 60 * 60 * 1000;

/** Every book read, newest first; the bookcase fills its shelves in this order. */
export const readings: ShelfBook[] = Array.from({ length: 83 }, (_, i): ShelfBook => {
  const book = books[i % books.length];
  return {
    key: `${book.id}-${i}`,
    book,
    width: WIDTHS[(i * 3) % WIDTHS.length],
    height: HEIGHTS[(i * 7) % HEIGHTS.length],
    read: new Date(LAST_READ - i * 7 * DAY).toISOString().slice(0, 10),
  };
}).toSorted((a, b) => b.read.localeCompare(a.read));

/** What sits on each shelf besides the spines, top shelf first; the shelves below get nothing. */
export const shelfDecor: ShelfOptions[] = [
  {},
  { pile: 3 },
  { lean: true },
  { candle: true },
  { lean: true },
  {},
];
