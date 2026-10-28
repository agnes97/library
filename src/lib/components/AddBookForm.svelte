<script lang="ts">
  import { searchBooks } from '../openLibrary';
  import type { BookResult } from '../types';

  type Props = {
    onDone: () => void;
  };

  let { onDone }: Props = $props();

  /** today in local time, as an ISO date like the dates on the shelf */
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const thisYear = now.getFullYear();
  const todayLabel = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  let query = $state('');
  let picked = $state.raw<BookResult | null>(null);
  let results = $state.raw<BookResult[]>([]);
  let status = $state<'idle' | 'loading' | 'error'>('idle');

  /** when it was read: today, a day picked by hand, or just the year when the day is forgotten */
  let when = $state<'today' | 'day' | 'year'>('today');
  let day = $state(today);
  let year = $state(thisYear);

  const read = $derived(when === 'today' ? today : when === 'day' ? day : String(year));
  const isValid = $derived(
    when === 'day'
      ? Boolean(day) && day <= today
      : when === 'year'
        ? Number.isInteger(year) && year >= 1900 && year <= thisYear
        : true
  );

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

  function details(book: BookResult) {
    return [book.authors.join(', '), book.year, book.pages && `${book.pages} pages`]
      .filter(Boolean)
      .join(' · ');
  }

  function pick(book: BookResult) {
    console.log('Picked', book);
    picked = book;
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    if (!isValid) return;
    console.log('Add to library', { book: picked, read });
    onDone();
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
      <div class="text">
        <strong>{picked.title}</strong>
        <small>{details(picked)}</small>
      </div>
    </div>

    <fieldset>
      <legend>When did you read it?</legend>

      <label class="choice">
        <input type="radio" name="when" value="today" bind:group={when} />
        <span>Today, {todayLabel}</span>
      </label>

      <label class="choice">
        <input type="radio" name="when" value="day" bind:group={when} />
        <span>On another day</span>
      </label>
      {#if when === 'day'}
        <input
          class="when"
          type="date"
          aria-label="Day you read it"
          max={today}
          required
          bind:value={day}
        />
      {/if}

      <label class="choice">
        <input type="radio" name="when" value="year" bind:group={when} />
        <span>I only remember the year</span>
      </label>
      {#if when === 'year'}
        <input
          class="when"
          type="number"
          aria-label="Year you read it"
          min="1900"
          max={thisYear}
          step="1"
          required
          bind:value={year}
        />
      {/if}
    </fieldset>

    <div class="actions">
      <button type="button" class="secondary" onclick={() => (picked = null)}>Back</button>
      <button type="submit" class="primary" disabled={!isValid}>Put it on the shelf</button>
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

  .picked strong {
    font-size: 1.125rem;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.5rem;
    padding: 0;
    font-size: 1.125rem;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
  }

  .choice span {
    font-size: 1rem;
    color: var(--text);
  }

  .choice input {
    margin: 0;
    padding: 0;
    accent-color: var(--accent);
  }

  /* the date or year field sits under its choice */
  .when {
    align-self: flex-start;
    margin: 0 0 0.25rem 1.6rem;
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

  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .actions button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
