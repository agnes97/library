<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { ai } from '../ai.svelte';
  import { library } from '../library.svelte';
  import { editionCovers } from '../openLibrary';
  import { shrinkPhoto } from '../photo';
  import { spineJob } from '../spineJob';
  import type { Book, EditionCover } from '../types';
  import PageBar from './PageBar.svelte';
  import Pill from './Pill.svelte';
  import SpinePicker from './SpinePicker.svelte';

  type Props = {
    book: Book;
    onClose: () => void;
  };

  let { book, onClose }: Props = $props();

  /**
   * the cover and spine side by side, the editions' covers to choose from, the spine being
   * found, drawn or cropped from what the reader chose for it, as a drawing still under way before
   * the page reloaded is, or the cover being found on the web and cropped
   */
  let view = $state.raw<
    'look' | 'editions' | { spine: 'find' | 'improve' | File | 'resume' } | { cover: 'find' }
  >(spineJob.saved()?.book === untrack(() => book.id) ? { spine: 'resume' } : 'look');
  let spinePicker = $state<SpinePicker>();

  let savingCover = $state(false);
  let savingSpine = $state(false);
  const busy = $derived(savingCover || savingSpine);
  let error = $state<string | null>(null);
  let coverInput = $state<HTMLInputElement>();
  let spineInput = $state<HTMLInputElement>();

  /** pictures that failed to load, so the cloth shows instead */
  let brokenCover = $state<string>();
  let brokenSpine = $state<string>();
  const cover = $derived(book.coverUrl !== brokenCover ? book.coverUrl : undefined);
  const spinePhoto = $derived(book.spineUrl !== brokenSpine ? book.spineUrl : undefined);
  const chatGpt = $derived(ai.connected('openai'));

  /** Goes up a level, as the button in the top corner does, and out of here from the top. */
  export function back() {
    if (typeof view === 'object') spinePicker?.back();
    else if (view === 'editions') closeEditions();
    else if (!busy) onClose();
  }

  const failed = (failure: unknown, fallback: string) =>
    failure instanceof Error ? failure.message : fallback;

  /** the editions' covers to choose from, once Open Library sends them */
  let editions = $state.raw<EditionCover[] | null>(null);
  let editionsRequest: AbortController | undefined;

  /** how many covers download at once, ahead of the ones already shown */
  const EDITIONS_AHEAD = 6;
  /** how long the covers after a slow one wait for it before showing without it */
  const EDITION_PATIENCE = 1500;
  /** covers that loaded, failed or were given up on, by their place in `editions` */
  const settledEditions = new Set<number>();
  const loadedEditions = new SvelteSet<number>();
  /** covers that failed to load, which drop out of the grid */
  const brokenEditions = new SvelteSet<number>();
  /** the covers before this one have all settled, so they show in reading order */
  let editionsShown = $state(0);

  function settleEdition(index: number, outcome: 'loaded' | 'broken' | 'late') {
    settledEditions.add(index);
    if (outcome === 'loaded') loadedEditions.add(index);
    if (outcome === 'broken') brokenEditions.add(index);
    let shown = editionsShown;
    while (settledEditions.has(shown)) shown++;
    editionsShown = shown;
  }

  // a cover that hangs is skipped, and shows on its own whenever it does arrive
  $effect(() => {
    if (!editions || editionsShown >= editions.length) return;
    const waitingOn = editionsShown;
    const timer = setTimeout(() => settleEdition(waitingOn, 'late'), EDITION_PATIENCE);
    return () => clearTimeout(timer);
  });

  $effect(() => () => editionsRequest?.abort());

  async function openEditions() {
    if (busy) return;
    view = 'editions';
    error = null;
    editions = null;
    settledEditions.clear();
    loadedEditions.clear();
    brokenEditions.clear();
    editionsShown = 0;
    editionsRequest = new AbortController();
    try {
      editions = await editionCovers(book.id, book.title, editionsRequest.signal);
    } catch (failure) {
      if (editionsRequest.signal.aborted) return;
      console.error(failure);
      editions = [];
      error = 'Open Library can’t be reached, but you can still upload a photo';
    }
  }

  function closeEditions() {
    if (savingCover) return;
    editionsRequest?.abort();
    error = null;
    view = 'look';
  }

  /**
   * Saves an edition's cover, by its URL, the reader's own photo, or plain cloth, and shows it
   * beside the spine.
   */
  async function saveCover(source: string | File | null) {
    if (busy) return;
    savingCover = true;
    error = null;
    try {
      await library.setCover(book.id, source instanceof File ? await shrinkPhoto(source) : source);
      editionsRequest?.abort();
      view = 'look';
    } catch (failure) {
      error = failed(failure, 'Saving failed, try again');
    } finally {
      savingCover = false;
    }
  }

  /** Takes the spine photo off for cloth dyed after the cover. */
  async function useCloth() {
    if (busy) return;
    savingSpine = true;
    error = null;
    try {
      await library.setSpine(book.id, null);
    } catch (failure) {
      error = failed(failure, 'Saving failed, try again');
    } finally {
      savingSpine = false;
    }
  }

  function pickSpine(start: 'find' | 'improve' | File) {
    if (busy) return;
    error = null;
    view = { spine: start };
  }

  function findCover() {
    if (busy) return;
    error = null;
    view = { cover: 'find' };
  }

  /** Runs `then` with the photo the reader picks in `input`, if they pick one. */
  function onPhoto(then: (file: File) => void) {
    return (event: Event & { currentTarget: HTMLInputElement }) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) then(file);
    };
  }
</script>

{#snippet editionButton(edition: EditionCover, index: number, showLanguage: boolean)}
  <button
    type="button"
    class={['edition', { current: edition.url === book.coverUrl }]}
    title={edition.label}
    disabled={savingCover}
    hidden={brokenEditions.has(index)}
    onclick={() => saveCover(edition.url)}
  >
    <span class="edition-frame">
      <img
        class={{ shown: index < editionsShown && loadedEditions.has(index) }}
        src={index < editionsShown + EDITIONS_AHEAD ? edition.url : undefined}
        alt={edition.label}
        onload={() => settleEdition(index, 'loaded')}
        onerror={() => settleEdition(index, 'broken')}
      />
    </span>
    {#if showLanguage}
      <span class="edition-language">{edition.language ?? 'Unknown language'}</span>
    {/if}
    {#if edition.details}
      <span class="edition-details">{edition.details}</span>
    {/if}
  </button>
{/snippet}

{#if typeof view === 'object'}
  <SpinePicker
    bind:this={spinePicker}
    {book}
    part={'cover' in view ? 'cover' : 'spine'}
    start={'cover' in view ? view.cover : view.spine}
    onClose={() => (view = 'look')}
  />
{:else if view === 'editions'}
  <div class="look-editor" role="group" aria-label="Choose a cover">
    <PageBar title="Choose a cover" disabled={savingCover} onBack={closeEditions} />
    {#if editions === null}
      <p class="hint">Looking through the editions…</p>
    {:else if editions.length}
      {@const english = editions.filter((edition) => edition.language === 'English')}
      {@const others = editions.filter((edition) => edition.language !== 'English')}
      <div class="editions">
        {#if english.length}
          {#if others.length}<p class="editions-heading">English</p>{/if}
          <div class="edition-grid">
            {#each english as edition, i (edition.url)}
              {@render editionButton(edition, i, false)}
            {/each}
          </div>
        {/if}
        {#if others.length}
          {#if english.length}<p class="editions-heading">Other languages</p>{/if}
          <div class="edition-grid">
            {#each others as edition, i (edition.url)}
              <!-- editions come sorted English first, so the others follow on -->
              {@render editionButton(edition, english.length + i, true)}
            {/each}
          </div>
        {/if}
      </div>
    {:else if !error}
      <p class="hint">Open Library has no other covers for it</p>
    {/if}
    <div class="foot">
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <Pill icon="upload" disabled={savingCover} onclick={() => coverInput?.click()}>
        {savingCover ? 'Saving…' : 'Upload your own'}
      </Pill>
    </div>
  </div>
{:else}
  <div class="look-editor" role="group" aria-label="Cover and spine">
    <PageBar title="Cover & spine" disabled={busy} onBack={back} />

    <div class="books" role="img" aria-label="The spine and cover of {book.title}">
      {#if spinePhoto}
        <img
          class="spine-photo"
          src={spinePhoto}
          alt=""
          onerror={() => (brokenSpine = spinePhoto)}
        />
      {:else}
        <span class="spine-cloth">
          <span class="band"></span>
          <span class="spine-title">{book.title}</span>
          <span class="band"></span>
        </span>
      {/if}
      {#if cover}
        <img class="cover-photo" src={cover} alt="" onerror={() => (brokenCover = cover)} />
      {:else}
        <span class="cover-cloth">
          <span class="ornament" aria-hidden="true">❦</span>
          <span class="cover-title">{book.title}</span>
          <span class="cover-author">{book.author}</span>
        </span>
      {/if}
    </div>

    <div class="columns">
      <div class="column">
        <span class="label">Spine</span>
        <Pill
          wide
          icon="cloth"
          title="Plain cloth dyed after the cover"
          aria-pressed={!book.spineUrl}
          disabled={busy || !book.spineUrl}
          onclick={useCloth}
        >
          {savingSpine ? 'Saving…' : 'Cloth'}
        </Pill>
        <Pill wide icon="upload" disabled={busy} onclick={() => spineInput?.click()}>
          Upload your own
        </Pill>
        <Pill
          wide
          icon="search"
          title="Search the web for photos of its spine"
          disabled={busy}
          onclick={() => pickSpine('find')}
        >
          Search the web
        </Pill>
        {#if chatGpt}
          {#if book.spineUrl}
            <Pill
              wide
              icon="sparkle"
              title="Have ChatGPT redraw this spine sharp and straight"
              disabled={busy}
              onclick={() => pickSpine('improve')}
            >
              Improve with AI
            </Pill>
          {/if}
        {:else}
          <p class="aside">Connect ChatGPT under AI Keys in the menu to draw it sharp.</p>
        {/if}
      </div>
      <div class="column">
        <span class="label">Cover</span>
        <Pill
          wide
          icon="cloth"
          title="Plain cloth with the title printed on, no picture"
          aria-pressed={!book.coverUrl}
          disabled={busy || !book.coverUrl}
          onclick={() => saveCover(null)}
        >
          Cloth
        </Pill>
        <Pill wide icon="upload" disabled={busy} onclick={() => coverInput?.click()}>
          {savingCover ? 'Saving…' : 'Upload your own'}
        </Pill>
        <Pill
          wide
          icon="search"
          title="Search the web for photos of its cover"
          disabled={busy}
          onclick={findCover}
        >
          Search the web
        </Pill>
        <Pill wide icon="editions" disabled={busy} onclick={openEditions}>
          Pick from editions
        </Pill>
      </div>
    </div>

    <div class="foot">
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <p class="hint">Each pick is saved as soon as you make it</p>
    </div>
  </div>
{/if}

<input
  bind:this={coverInput}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  hidden
  onchange={onPhoto(saveCover)}
/>
<input
  bind:this={spineInput}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  hidden
  onchange={onPhoto(pickSpine)}
/>

<style>
  /* laid over the first page, the 3D cover and its buttons */
  .look-editor {
    --preview: 200px;

    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px 28px 18px 24px;
    overflow-y: auto;
    scrollbar-width: thin;
    background-color: inherit;
    background-image: inherit;
    border-radius: inherit;
  }

  @media (width < 700px) {
    .look-editor {
      --preview: 120px;

      gap: 10px;
      padding: 14px 16px 12px;
    }
  }

  p {
    margin: 0;
  }

  .hint {
    font-style: italic;
    font-size: 14px;
    color: var(--paper-muted);
    text-align: center;
  }

  .error {
    color: #a3243b;
    font-size: 14px;
    text-align: center;
  }

  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: auto;
  }

  /* the spine against the cover's left edge, as the book stands closed */
  .books {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 2px;
  }

  .spine-photo,
  .cover-photo {
    display: block;
    height: var(--preview);
    width: auto;
    max-width: 100%;
    box-shadow: 0 10px 24px rgb(46 32 38 / 0.4);
  }

  .spine-photo {
    border-radius: 3px 0 0 3px;
  }

  .cover-photo {
    border-radius: 0 6px 6px 0;
  }

  .spine-cloth {
    width: calc(var(--preview) * 0.18);
    height: var(--preview);
    box-sizing: border-box;
    padding: calc(var(--preview) * 0.07) 0;
    border-radius: 3px 0 0 3px;
    background: linear-gradient(90deg, var(--c2), var(--c1) 50%, var(--c2));
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 10px 24px rgb(46 32 38 / 0.4);
  }

  .band {
    width: 100%;
    height: 3px;
    border-block: 1px solid var(--book-accent);
  }

  .spine-title {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 6px 0;
    writing-mode: vertical-rl;
    font-family: var(--serif);
    font-weight: 700;
    font-size: calc(var(--preview) * 0.085);
    line-height: 1;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .cover-cloth {
    position: relative;
    width: calc(var(--preview) * 0.69);
    height: var(--preview);
    box-sizing: border-box;
    padding: calc(var(--preview) * 0.12) calc(var(--preview) * 0.07);
    border-radius: 0 6px 6px 0;
    background: linear-gradient(135deg, var(--c1), var(--c2));
    color: var(--ink);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    box-shadow:
      0 10px 24px rgb(46 32 38 / 0.4),
      inset 6px 0 6px -4px rgb(0 0 0 / 0.45);
  }

  .cover-cloth::before {
    content: '';
    position: absolute;
    inset: 9px;
    border: 1px solid var(--book-accent);
    border-radius: 3px;
    opacity: 0.7;
  }

  .cover-cloth > span {
    position: relative;
  }

  .ornament {
    color: var(--book-accent);
    font-size: calc(var(--preview) * 0.1);
    line-height: 1;
  }

  .cover-title {
    font-family: var(--serif);
    font-weight: 700;
    font-size: calc(var(--preview) * 0.1);
    line-height: 1.1;
  }

  .cover-author {
    font-size: calc(var(--preview) * 0.055);
    opacity: 0.9;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-self: stretch;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .label {
    padding: 0 0 2px 4px;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--paper-accent);
  }

  .aside {
    padding: 0 4px;
    font-style: italic;
    font-size: 13px;
    line-height: 1.3;
    color: var(--paper-muted);
  }

  /* a plain block, so the grids inside get a definite width to fill columns into */
  .editions {
    flex: 1;
    align-self: stretch;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: thin;
  }

  .editions-heading {
    margin: 0 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgb(107 74 88 / 0.25);
    font-family: var(--caps);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--paper-muted);
  }

  .edition-grid + .editions-heading {
    margin-top: 20px;
  }

  .edition-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    align-items: start;
    gap: 12px;
  }

  .edition {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }

  .edition[hidden] {
    display: none;
  }

  /* the cover's place, tinted until its picture fades in */
  .edition-frame {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 3;
    margin-bottom: 4px;
    overflow: hidden;
    border-radius: 2px 4px 4px 2px;
    background: rgb(107 74 88 / 0.15);
    box-shadow: 0 4px 10px rgb(46 32 38 / 0.3);
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .edition img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .edition img.shown {
    opacity: 1;
  }

  .edition:hover:not(:disabled) .edition-frame {
    transform: translateY(-3px);
    box-shadow: 0 8px 16px rgb(46 32 38 / 0.35);
  }

  .edition.current .edition-frame,
  .edition:focus-visible .edition-frame {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }

  .edition:focus-visible {
    outline: none;
  }

  .edition:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .edition-language {
    font-weight: 700;
    font-size: 12px;
    line-height: 1.2;
    color: var(--paper-title);
  }

  .edition-details {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    font-size: 11px;
    line-height: 1.25;
    color: var(--paper-muted);
  }
</style>
