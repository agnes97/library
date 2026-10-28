import { request } from './api';
import { shelve } from './books';
import type { ApiBook, ApiReading, BookEdit, NewReading, ShelfBook } from './types';

/**
 * Where a reading sorts on the shelves, newest read first; one with only a year follows the dated
 * ones of its year, among the others like it by when it was added.
 */
const rank = (read: string) => (read.length === 4 ? `${read}-00-00` : read);

class Library {
  /** every book read, newest first, as the API returns it */
  #readings = $state.raw<ApiReading[]>([]);
  /** every book read, newest first, as it sits on the shelves */
  readings: ShelfBook[] = $derived(shelve(this.#readings));
  status = $state<'idle' | 'loading' | 'error'>('idle');

  /** bumped on every load and clear, so a load that finishes late is dropped */
  #generation = 0;

  async load() {
    const generation = ++this.#generation;
    this.status = 'loading';

    try {
      const readings = await request<ApiReading[]>('/library/readings');
      if (generation !== this.#generation) return;

      this.#readings = readings;
      this.status = 'idle';
    } catch (error) {
      if (generation !== this.#generation) return;
      console.error(error);
      this.status = 'error';
    }
  }

  /** Saves a reading and shelves it in place, ahead of any that sort the same (it is the newest added). */
  async add(body: NewReading) {
    const reading = await request<ApiReading>('/library/readings', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const at = this.#readings.findIndex((item) => rank(item.read) <= rank(reading.read));
    this.#readings =
      at === -1 ? [...this.#readings, reading] : this.#readings.toSpliced(at, 0, reading);
  }

  /** The book as already shelved, by its Open Library work key, e.g. /works/OL45804W. */
  stored(key: string): ApiBook | undefined {
    const id = key.replace('/works/', '');
    return this.#readings.find((reading) => reading.book.id === id)?.book;
  }

  /** Corrects a book on every shelf it sits on. */
  async edit(id: string, edit: BookEdit) {
    const book = await request<ApiBook>(`/library/books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(edit),
    });

    this.#readings = this.#readings.map((reading) =>
      reading.book.id === id ? { ...reading, book } : reading
    );
  }

  /**
   * Gives a book another cover on every shelf it sits on: an Open Library edition's, by its URL,
   * or a photo of the reader's own copy.
   */
  async setCover(id: string, cover: string | Blob) {
    let body: BodyInit;
    if (typeof cover === 'string') {
      body = JSON.stringify({ coverUrl: cover });
    } else {
      body = new FormData();
      body.append('image', cover, 'cover.jpg');
    }

    const book = await request<ApiBook>(`/library/books/${id}/cover`, { method: 'PUT', body });
    this.#readings = this.#readings.map((reading) =>
      reading.book.id === id ? { ...reading, book } : reading
    );
  }

  /** Takes a reading off the shelves for good. */
  async remove(id: string) {
    await request(`/library/readings/${id}`, { method: 'DELETE' });
    this.#readings = this.#readings.filter((reading) => reading.id !== id);
  }

  clear() {
    this.#generation++;
    this.#readings = [];
    this.status = 'idle';
  }
}

export const library = new Library();
