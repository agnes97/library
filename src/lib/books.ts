import type { Book, ShelfBook } from './types';

export const books: Book[] = [
  {
    id: 'cartographers-silence',
    title: "The Cartographer's Silence",
    author: 'Ilse Marrow',
    year: 1987,
    description:
      'A mapmaker charting a coast that keeps redrawing itself stops speaking the day her maps start to agree with the sea. Her apprentice reads the margins of her charts for the words she no longer says.',
    width: 52,
    height: 286,
    colors: { c1: '#1f3a4d', c2: '#13263a', accent: '#d9b46a', ink: '#efe3c8' },
  },
  {
    id: 'salt-and-lanterns',
    title: 'Salt & Lanterns',
    author: 'Tomas Erlend',
    year: 2004,
    description:
      'In a fishing town where every window keeps a lantern lit for those still at sea, a lighthouse keeper counts the lights going out one winter at a time.',
    width: 44,
    height: 248,
    colors: { c1: '#8a2f24', c2: '#5e1d17', accent: '#f0c98a', ink: '#fbeee0' },
  },
  {
    id: 'grammar-of-moths',
    title: 'A Grammar of Moths',
    author: 'Petra Vosk',
    year: 1962,
    description:
      'A retired linguist catalogues the moths that gather at her porch light, and slowly becomes convinced that their flight paths spell out sentences.',
    width: 60,
    height: 270,
    colors: { c1: '#4e5a2c', c2: '#333c1c', accent: '#e6d59a', ink: '#f4eedb' },
  },
  {
    id: 'nine-winters-in-vellmar',
    title: 'Nine Winters in Vellmar',
    author: 'Aurel Daske',
    year: 1949,
    description:
      'A chronicle of a mountain city told through nine winters, nine sieges of snow, and the one family that refused to leave when the passes closed for good.',
    width: 66,
    height: 300,
    colors: { c1: '#5b3b63', c2: '#3b2442', accent: '#e9c27a', ink: '#f6ecdf' },
  },
];

/** Usable width of one shelf in px (the shelf scene is 960px wide with 26px padding each side). */
const SHELF_WIDTH = 900;
const GAP = 6;

function fillShelf(shelf: number, offset: number): ShelfBook[] {
  const result: ShelfBook[] = [];
  let used = 0;

  for (let i = 0; ; i++) {
    const book = books[(offset + i) % books.length];
    const next = used + (result.length > 0 ? GAP : 0) + book.width;
    if (next > SHELF_WIDTH) break;
    used = next;
    result.push({ key: `${book.id}-${shelf}-${i}`, book });
  }

  return result;
}

export const shelves: ShelfBook[][] = [fillShelf(0, 0), fillShelf(1, 2)];
