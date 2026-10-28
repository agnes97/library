import { request } from './api';
import { shelve } from './books';
import type { ApiReading, NewReading, ShelfBook } from './types';

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

  clear() {
    this.#generation++;
    this.#readings = [];
    this.status = 'idle';
  }
}

export const library = new Library();
