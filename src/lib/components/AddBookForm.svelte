<script lang="ts">
  import { library } from '../library.svelte';
  import { searchBooks } from '../openLibrary';
  import type { BookResult } from '../types';

  type Props = {
    onDone: () => void;
  };

  let { onDone }: Props = $props();

  /** a local date as an ISO date, like the dates on the shelf */
  function isoDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const thisYear = now.getFullYear();

  let query = $state('');
  let picked = $state.raw<BookResult | null>(null);
  let results = $state.raw<BookResult[]>([]);
  let status = $state<'idle' | 'loading' | 'error'>('idle');

  /** when it was read: a day, or just the year when the day is forgotten */
  let when = $state<'day' | 'year'>('day');
  let day = $state(today);
  let year = $state(thisYear);

  /** the title and authors to shelve it under, for when Open Library has them wrong or missing */
  let title = $state('');
  let authors = $state('');

  /** Picks a result, prefilled as the book is already shelved when someone has read it before. */
  function pick(book: BookResult) {
    const stored = library.stored(book.key);
    title = stored?.title ?? book.title;
    authors = (stored?.authors ?? book.authors).join(', ');
    picked = book;
  }

  let saving = $state(false);
  let saveError = $state<string | null>(null);

  const read = $derived(when === 'day' ? day : String(year));
  const isValid = $derived(
    Boolean(title.trim()) &&
      (when === 'day'
        ? Boolean(day) && day <= today
        : Number.isInteger(year) && year >= 1900 && year <= thisYear)
  );

  /** every year it could have been read, newest first */
  const years = Array.from({ length: thisYear - 1900 + 1 }, (_, i) => thisYear - i);

  const shortcuts = [
    { label: 'Yesterday', when: 'day', value: yesterday },
    { label: 'Today', when: 'day', value: today },
    { label: 'This year', when: 'year', value: String(thisYear) },
  ] as const;

  function pickShortcut(shortcut: (typeof shortcuts)[number]) {
    when = shortcut.when;
    if (shortcut.when === 'day') day = shortcut.value;
    else year = thisYear;
  }

  /** Searches Open Library once typing pauses, dropping any search still in flight. */
  $effect(() => {
    const needle = query.trim();
    results = [];
    if (!needle) {
      status = 'idle';
      return;
    }

    status = 'loading';
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        results = await searchBooks(needle, controller.signal);
        status = 'idle';
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          status = 'error';
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  function details(book: BookResult, withAuthors = true) {
    return [withAuthors && book.authors.join(', '), book.year, book.pages && `${book.pages} pages`]
      .filter(Boolean)
      .join(' · ');
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!picked || !isValid || saving) return;

    saving = true;
    saveError = null;
    try {
      const book = {
        ...picked,
        title: title.trim(),
        authors: authors
          .split(',')
          .map((author) => author.trim())
          .filter(Boolean),
      };
      await library.add({ book, read });
      onDone();
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Saving failed, try again';
    } finally {
      saving = false;
    }
  }
</script>

{#snippet cover(book: BookResult, large = false)}
  {#if book.coverUrl}
    <img class="cover" class:large src={book.coverUrl} alt="" loading="lazy" />
  {:else}
    <span class="cover placeholder" class:large aria-hidden="true"></span>
  {/if}
{/snippet}

{#if picked}
  <form class="confirm" onsubmit={add}>
    <div class="picked">
      {@render cover(picked, true)}
      <div class="text fields">
        <label class="field title">
          <span>Title</span>
          <input type="text" required autocomplete="off" bind:value={title} />
        </label>
        <label class="field">
          <span>Author</span>
          <input
            type="text"
            autocomplete="off"
            placeholder="Separate several with commas"
            bind:value={authors}
          />
        </label>
        <small>{details(picked, false)}</small>
      </div>
    </div>

    <fieldset>
      <legend>When did you read it?</legend>

      <div class="shortcuts">
        {#each shortcuts as shortcut (shortcut.label)}
          <button
            type="button"
            class="shortcut"
            aria-pressed={read === shortcut.value}
            onclick={() => pickShortcut(shortcut)}
          >
            {shortcut.label}
          </button>
        {/each}
      </div>

      <!-- an exact day or only the year, side by side with a divider between -->
      <div class="split">
        <label class="half" class:active={when === 'day'}>
          <span>Day</span>
          <input
            type="date"
            max={today}
            required={when === 'day'}
            bind:value={day}
            onfocus={() => (when = 'day')}
            onclick={(event) => event.currentTarget.showPicker?.()}
          />
        </label>
        <span class="divider" aria-hidden="true">or</span>
        <label class="half" class:active={when === 'year'}>
          <span>Year</span>
          <select
            bind:value={year}
            onfocus={() => (when = 'year')}
            onchange={() => (when = 'year')}
          >
            {#each years as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>
      </div>
    </fieldset>

    {#if saveError}
      <p class="error" role="alert">{saveError}</p>
    {/if}

    <div class="actions">
      <button type="button" class="secondary" disabled={saving} onclick={() => (picked = null)}>
        Back
      </button>
      <button type="submit" class="primary" disabled={!isValid || saving}>
        {saving ? 'Putting it on the shelf…' : 'Put it on the shelf'}
      </button>
    </div>
  </form>
{:else}
  <form onsubmit={(event) => event.preventDefault()}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="search"
      aria-label="Search for a book"
      placeholder="Search by title, author or ISBN"
      autocomplete="off"
      autofocus
      bind:value={query}
    />

    <!-- a fixed height, so the dialog doesn't jump as results come and go -->
    <div class="results">
      {#if !query.trim()}
        <p class="empty">Find a book you've finished to add it to your shelves.</p>
      {:else if status === 'loading'}
        <p class="empty">Searching…</p>
      {:else if status === 'error'}
        <p class="empty">Search failed, try again</p>
      {:else if results.length}
        <ul>
          {#each results as book (book.key)}
            <li>
              <button type="button" class="result" onclick={() => pick(book)}>
                {@render cover(book)}
                <span class="text">
                  <strong>{book.title}</strong>
                  <small>{details(book)}</small>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No books found</p>
      {/if}
    </div>
  </form>
{/if}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .results {
    height: min(28rem, calc(100vh - 16rem));
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .result:hover {
    border-color: var(--border);
    background: var(--bg);
  }

  .result:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .cover {
    flex: none;
    width: 32px;
    height: 48px;
    border-radius: 2px;
    object-fit: cover;
    background: var(--border);
  }

  .cover.large {
    width: 72px;
    height: 108px;
  }

  /* no cover: a sliver of a plain spine */
  .placeholder {
    background: linear-gradient(
      180deg,
      var(--border) 0 70%,
      var(--accent) 70% 76%,
      var(--border) 76%
    );
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  small {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .empty {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
    font-style: italic;
    color: var(--text-muted);
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .picked {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .fields {
    flex: 1;
    gap: 0.75rem;
    min-width: 0;
  }

  /* underlined like the day and year below, as the details read on a card */
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .field > span {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .field input {
    padding: 0.125rem 0 0.375rem;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    background: none;
    transition: border-color 0.15s;
  }

  .field input:focus-visible {
    outline: none;
    border-bottom-color: var(--accent);
    box-shadow: 0 1px 0 var(--accent);
  }

  .field.title input {
    font-size: 1.125rem;
    font-weight: 600;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    /* margin, not padding: a fieldset's top padding sits under its legend */
    margin: 1rem 0 0;
    padding: 0 0 1.5rem;
    border: none;
  }

  legend {
    margin-bottom: 0.75rem;
    padding: 0;
    font-size: 1.125rem;
  }

  .shortcuts {
    display: flex;
    gap: 0.5rem;
  }

  .shortcut {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .shortcut:hover {
    background: var(--bg);
  }

  .shortcut[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .shortcut:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .split {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .half {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    cursor: pointer;
    opacity: 0.55;
    transition: opacity 0.15s;
  }

  .half.active,
  .half:focus-within {
    opacity: 1;
  }

  .half > span {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .half input,
  .half select {
    width: 100%;
    min-width: 0;
    padding: 0.125rem 0 0.375rem;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 1.25rem;
    cursor: pointer;
    appearance: none;
    transition: border-color 0.15s;
  }

  /* a shadow rather than a thicker border, so the two halves stay level */
  .half.active input,
  .half.active select {
    border-bottom-color: var(--accent);
    box-shadow: 0 1px 0 var(--accent);
  }

  .half input:focus-visible,
  .half select:focus-visible {
    outline: none;
    border-bottom-color: var(--accent);
  }

  /* the whole field opens the calendar, so the tiny icon isn't needed */
  .half input::-webkit-calendar-picker-indicator {
    display: none;
  }

  .divider {
    align-self: stretch;
    display: flex;
    align-items: center;
    padding-top: 1rem;
    font-style: italic;
    color: var(--text-muted);
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.8125rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .actions button {
    flex: 1;
    padding: 0.625rem;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    border: none;
    background: var(--accent);
    color: var(--on-accent);
  }

  .secondary {
    border: 1px solid var(--border);
    background: none;
    color: var(--text);
  }

  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .actions button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
