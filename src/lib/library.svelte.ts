import { request, requestBlob } from './api';
import { sampleReadings, shelve } from './books';
import type {
  ApiBook,
  ApiReading,
  BookEdit,
  NewReading,
  ShelfBook,
  SpineCandidate,
  SpineJob,
} from './types';

/** a spine drawing as it last stood at OpenAI */
export type SpineProgress = Extract<SpineJob, { status: 'working' }>;

/**
 * Where a reading sorts on the shelves, newest read first; one with only a year follows the dated
 * ones of its year, among the others like it by when it was added.
 */
const rank = (read: string) => (read.length === 4 ? `${read}-00-00` : read);

/** A title as it compares, whichever apostrophes and case it is written in. */
const plain = (title: string) => title.replace(/[’‘`]/g, "'").toLowerCase().trim();

/** What an upload to a sample takes from the book it went to. */
const photos = ({ coverUrl, coverColor, spineUrl, spineColor, spineRatio }: ApiBook) => ({
  coverUrl,
  coverColor,
  spineUrl,
  spineColor,
  spineRatio,
});

/** the query param that keeps a reader on the sample shelves through a reload: `?shelves=samples` */
export const SAMPLES_QUERY = ['shelves', 'samples'] as const;

/** how often a spine drawing running at OpenAI is looked in on, and for how long at most */
const FOLLOW_EVERY = 3000;
const FOLLOW_FOR = 6 * 60 * 1000;

/** Waits `ms`, or rejects as soon as `signal` aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

/** how many more times a load tries when the connection drops, waiting 1, 2, 4… s between */
const RETRIES = 4;

class Library {
  /** every book read, newest first, as the API returns it */
  #readings = $state.raw<ApiReading[]>([]);
  /** every book read, newest first, as it sits on the shelves */
  readings: ShelfBook[] = $derived(shelve(this.#readings));
  status = $state<'idle' | 'loading' | 'error'>('idle');
  /** the samples visitors see, kept here so a cover or spine uploaded to one shows at once */
  #samples = $state.raw<ApiReading[]>(sampleReadings);
  samples: ShelfBook[] = $derived(shelve(this.#samples));
  /** a reader looking at the samples instead of their own shelves, to photograph them */
  showingSamples = $state(
    new URLSearchParams(location.search).get(SAMPLES_QUERY[0]) === SAMPLES_QUERY[1]
  );

  /** bumped on every load and clear, so a load that finishes late is dropped */
  #generation = 0;

  async load() {
    const generation = ++this.#generation;
    this.status = 'loading';

    for (let attempt = 0; ; attempt++) {
      try {
        const readings = await request<ApiReading[]>('/library/readings');
        if (generation !== this.#generation) return;

        this.#readings = readings;
        this.status = 'idle';
        return;
      } catch (error) {
        if (generation !== this.#generation) return;
        // a dropped connection (fetch throws a TypeError) is tried again, a little later each time
        if (error instanceof TypeError && attempt < RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
          if (generation !== this.#generation) return;
          continue;
        }
        console.error(error);
        this.status = 'error';
        return;
      }
    }
  }

  /** Tries the shelves again after a load that failed, as when the connection comes back. */
  retry() {
    if (this.status === 'error') this.load();
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

  /**
   * The id prismify stores a book under: a sample's is the reader's own copy of it, which may be
   * another Open Library work, found by its title or its place in the series; prismify only knows
   * books someone has on a shelf.
   */
  #stored(id: string): string {
    const sample = this.#samples.find((reading) => reading.book.id === id)?.book;
    if (!sample || this.#readings.some((reading) => reading.book.id === id)) return id;

    const own = this.#readings.find(
      ({ book }) =>
        plain(book.title) === plain(sample.title) ||
        (sample.series !== null &&
          book.series === sample.series &&
          book.seriesNumber === sample.seriesNumber)
    );
    return own?.book.id ?? id;
  }

  /** Corrects a book on every shelf it sits on. */
  async edit(id: string, edit: BookEdit) {
    const book = await request<ApiBook>(`/library/books/${this.#stored(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(edit),
    });

    this.#replace(book, id);
  }

  /**
   * Gives a book another cover on every shelf it sits on: an Open Library edition's, by its URL,
   * or a photo of the reader's own copy; or takes it off for plain cloth with the title on.
   */
  async setCover(id: string, cover: string | Blob | null) {
    let init: RequestInit = { method: 'DELETE' };
    if (typeof cover === 'string') {
      init = { method: 'PUT', body: JSON.stringify({ coverUrl: cover }) };
    } else if (cover) {
      const body = new FormData();
      body.append('image', cover, 'cover.jpg');
      init = { method: 'PUT', body };
    }

    const book = await request<ApiBook>(`/library/books/${this.#stored(id)}/cover`, init);
    this.#replace(book, id);
  }

  /**
   * Puts a photo of the book's real spine, cropped and standing upright, on every shelf it sits
   * on, or takes it off for the cloth one when there is none.
   */
  async setSpine(id: string, spine: Blob | null) {
    let init: RequestInit = { method: 'DELETE' };
    if (spine) {
      const body = new FormData();
      body.append('image', spine, 'spine.jpg');
      init = { method: 'PUT', body };
    }

    const book = await request<ApiBook>(`/library/books/${this.#stored(id)}/spine`, init);
    this.#replace(book, id);
  }

  /** Looks for photos of the book on the web, to crop its spine out of; nothing is saved. */
  async findSpines(id: string, signal?: AbortSignal): Promise<SpineCandidate[]> {
    const { candidates } = await request<{ candidates: SpineCandidate[] }>(
      `/library/books/${this.#stored(id)}/spine/candidates`,
      { signal }
    );
    return candidates;
  }

  /**
   * A photo found on the web, fetched through prismify as most sites won't let the library read
   * theirs, or the image search's own small copy when the site turns prismify away too.
   */
  async spinePhoto({ imageUrl, preview }: SpineCandidate, signal?: AbortSignal): Promise<Blob> {
    const fetchPhoto = (url: string) =>
      requestBlob(`/library/spine-photo?${new URLSearchParams({ url })}`, { signal });
    try {
      return await fetchPhoto(imageUrl);
    } catch (failure) {
      if (signal?.aborted || preview === imageUrl) throw failure;
      return fetchPhoto(preview);
    }
  }

  /**
   * Has ChatGPT draw the spine straight and sharp after a photo of it, the one on the shelf by its
   * URL or one the reader cropped; it is only shown until the reader saves it with `setSpine`.
   */
  async drawSpine(
    id: string,
    photo: string | Blob,
    signal?: AbortSignal,
    onProgress?: (progress: SpineProgress) => void
  ): Promise<Blob> {
    let body: BodyInit;
    if (typeof photo === 'string') {
      body = JSON.stringify({ imageUrl: photo });
    } else {
      body = new FormData();
      body.append('image', photo, 'spine.jpg');
    }

    const stored = this.#stored(id);
    const started = await request<SpineJob>(`/library/books/${stored}/spine/draw`, {
      method: 'POST',
      body,
      signal,
    });
    const { image } = await this.#follow(stored, started, signal, onProgress);
    const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  }

  /**
   * Looks in on a drawing for the stored book until it is done, or `signal` aborts,
   * telling `onProgress` how it stands each time.
   */
  async #follow(
    stored: string,
    job: SpineJob,
    signal?: AbortSignal,
    onProgress?: (progress: SpineProgress) => void
  ): Promise<Exclude<SpineJob, { status: 'working' }>> {
    const until = Date.now() + FOLLOW_FOR;
    while (job.status === 'working') {
      onProgress?.(job);
      if (Date.now() > until) throw new Error('ChatGPT is taking too long, try again');
      await wait(FOLLOW_EVERY, signal);
      job = await request<SpineJob>(`/library/books/${stored}/spine/jobs/${job.job}`, { signal });
    }
    return job;
  }

  /**
   * Puts a book as prismify returned it on every shelf it sits on, and its photos on the sample it
   * was changed through, by that sample's `id`.
   */
  #replace(book: ApiBook, id: string) {
    this.#readings = this.#readings.map((reading) =>
      reading.book.id === book.id ? { ...reading, book } : reading
    );
    if (this.#samples.some((reading) => reading.book.id === id)) {
      this.#samples = this.#samples.map((reading) =>
        reading.book.id === id
          ? { ...reading, book: { ...reading.book, ...photos(book) } }
          : reading
      );
      // to be copied into the samples in books.ts
      console.info('sample', id, photos(book));
    }
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
