<script lang="ts">
  import { ai } from '../ai.svelte';
  import { library, type SpineProgress } from '../library.svelte';
  import { cropPhoto, drawTurned, loadPhoto, WHOLE, type Crop } from '../photo';
  import type { Book, SpineCandidate } from '../types';

  type Props = {
    book: Book;
    onClose: () => void;
  };

  let { book, onClose }: Props = $props();

  /** the photo shown for cropping is drawn no bigger than this */
  const STAGE_SIDE = 1000;
  /** a photo narrower than this is taken as the spine alone, a wider one as a shelf */
  const SPINE_SHAPE = 0.4;
  /** a drag shorter than this share of the photo is a click, not a crop */
  const MIN_DRAG = 0.02;
  /** how tall the spine shows beside the photo, at most, as on the shelf */
  const PREVIEW_HEIGHT = 200;
  /** between the photo and the spine beside it, as in the styles below */
  const GAP = 16;

  /** the photo being cropped; none while only the current spine shows */
  let photo = $state.raw<ImageBitmap | null>(null);
  /** quarter turns clockwise, for a photo of books lying down */
  let turns = $state(0);
  let crop = $state<Crop>(WHOLE);
  let saving = $state(false);
  let error = $state<string | null>(null);
  /** photos of the spine ChatGPT found on the web, which the reader goes through one by one */
  let found = $state.raw<SpineCandidate[] | null>(null);
  /** which of them is shown */
  let shown = $state(0);
  /** every photo shown and passed over, by its URL, for searching again to skip */
  let seen: string[] = [];
  const candidate = $derived(found?.[shown]);
  const more = $derived(found !== null && shown < found.length - 1);
  /** the spine ChatGPT drew, shown until it is saved or let go */
  let drawn = $state.raw<{ blob: Blob; url: string; from: string | Blob } | null>(null);
  /** what ChatGPT is busy with, which can take a minute */
  let working = $state<'finding' | 'drawing' | null>(null);
  /** the step it is on, as OpenAI last told */
  let progress = $state.raw<SpineProgress | null>(null);
  /** when it started, and the clock ticking along beside it */
  let startedAt = $state(0);
  let now = $state(0);
  const busy = $derived(saving || working !== null);
  /** stops looking in on ChatGPT once the picker closes */
  const closing = new AbortController();
  /** stops the search or drawing under way when the reader gives up on it */
  let stopping: AbortController | null = null;
  let photoInput = $state<HTMLInputElement>();
  /** the room for the photo and the spine beside it */
  let roomWidth = $state(0);
  let roomHeight = $state(0);

  /** the photo as it shows, turned and small enough to draw on every drag */
  const stage = $derived(photo && drawTurned(photo, turns, WHOLE, STAGE_SIDE));
  const previewHeight = $derived(Math.min(PREVIEW_HEIGHT, roomHeight));
  const previewWidth = $derived(
    stage
      ? Math.min(
          previewHeight,
          (previewHeight * crop.width * stage.width) / (crop.height * stage.height)
        )
      : 0
  );
  /** the photo shrunk to fit the room the spine leaves it */
  const stageScale = $derived(
    stage
      ? Math.min(
          1,
          (roomWidth - previewWidth - GAP) / stage.width,
          roomHeight / stage.height
        )
      : 0
  );

  // the photo goes when it is replaced or the picker closes
  $effect(() => {
    const current = photo;
    return () => current?.close();
  });

  $effect(() => () => closing.abort());

  // the elapsed time counts up while ChatGPT works
  $effect(() => {
    if (!working) return;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  // and so does the drawn spine
  $effect(() => {
    const current = drawn;
    return () => {
      if (current) URL.revokeObjectURL(current.url);
    };
  });

  const failed = (failure: unknown, fallback: string) =>
    failure instanceof Error ? failure.message : fallback;

  /** What ChatGPT is doing, in words. */
  const doing = $derived.by(() => {
    if (!progress || progress.queued) return 'Waiting for ChatGPT to start';
    switch (progress.step) {
      case 'search':
        return 'Searching the web for photos of its spine';
      case 'vetting':
        return progress.photos
          ? `Looking through ${progress.photos} photos found for its spine`
          : 'Looking through the photos found for its spine';
      case 'drawing':
        return 'Drawing the spine straight and sharp';
      default:
        return working === 'finding' ? 'Searching the web for its spine' : 'Drawing the spine';
    }
  });

  /** which step of how many it is on, as a search looks at what it found after */
  const stepOf = $derived(
    working === 'finding' ? `Step ${progress?.step === 'vetting' ? 2 : 1} of 2 · ` : ''
  );

  const elapsed = $derived.by(() => {
    const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  /** Starts ChatGPT working, returning the signal that stops it. */
  function begin(what: 'finding' | 'drawing'): AbortSignal {
    working = what;
    progress = null;
    error = null;
    startedAt = now = Date.now();
    stopping = new AbortController();
    return AbortSignal.any([closing.signal, stopping.signal]);
  }

  function end() {
    working = null;
    progress = null;
    stopping = null;
  }

  /** Lets go of the search or drawing; it may still finish at OpenAI, unseen. */
  function stop() {
    stopping?.abort();
  }

  async function find() {
    if (busy) return;
    seen = [...seen, ...(found ?? []).map(({ imageUrl }) => imageUrl)];
    const signal = begin('finding');
    try {
      found = await library.findSpines(book.id, seen, signal, (job) => (progress = job));
      shown = 0;
    } catch (failure) {
      if (signal.aborted) return;
      error = failed(failure, 'The search failed, try again');
      // the key may have been let go on the server, which the menu should show
      ai.load();
    } finally {
      end();
    }
  }

  /** Passes over the photo shown for the next one found, or searches again after the last. */
  function next() {
    if (more) shown++;
    else find();
  }

  /** Has ChatGPT draw the spine after a found photo, by its URL, or the reader's own. */
  async function draw(from: string | Blob) {
    if (busy) return;
    const signal = begin('drawing');
    try {
      const blob = await library.drawSpine(book.id, from, signal, (job) => (progress = job));
      drawn = { blob, url: URL.createObjectURL(blob), from };
    } catch (failure) {
      if (signal.aborted) return;
      error = failed(failure, 'Drawing failed, try again');
      ai.load();
    } finally {
      end();
    }
  }

  async function drawCrop() {
    if (!photo || busy) return;
    try {
      await draw(await cropPhoto(photo, turns, crop));
    } catch (failure) {
      error = failed(failure, 'That photo can’t be read');
    }
  }

  /** Draws the cropped part as the spine will stand, again on every drag. */
  function showPreview(canvas: HTMLCanvasElement) {
    if (!stage) return;
    const dpr = devicePixelRatio;
    canvas.width = Math.max(1, Math.round(previewWidth * dpr));
    canvas.height = Math.max(1, Math.round(previewHeight * dpr));
    canvas
      .getContext('2d')
      ?.drawImage(
        stage,
        crop.x * stage.width,
        crop.y * stage.height,
        crop.width * stage.width,
        crop.height * stage.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
  }

  /** A photo of the spine alone is taken whole; on one of a shelf it starts as a strip in the middle. */
  function startCrop() {
    if (!stage) return;
    crop =
      stage.width / stage.height < SPINE_SHAPE
        ? WHOLE
        : { x: 0.44, y: 0.05, width: 0.12, height: 0.9 };
  }

  async function open(file: File) {
    error = null;
    try {
      photo = await loadPhoto(file);
      turns = 0;
      startCrop();
    } catch {
      error = 'That photo can’t be read';
    }
  }

  function turn() {
    turns = (turns + 1) % 4;
    startCrop();
  }

  const share = (value: number) => Math.min(Math.max(value, 0), 1);

  /** Dragging across the photo draws the crop from corner to corner. */
  function cropping(canvas: HTMLCanvasElement) {
    let from: { x: number; y: number } | null = null;

    const at = (event: PointerEvent) => {
      const { left, top, width, height } = canvas.getBoundingClientRect();
      return { x: share((event.clientX - left) / width), y: share((event.clientY - top) / height) };
    };

    function onDown(event: PointerEvent) {
      if (busy) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      from = at(event);
    }

    function onMove(event: PointerEvent) {
      if (!from) return;
      const to = at(event);
      const width = Math.abs(to.x - from.x);
      const height = Math.abs(to.y - from.y);
      if (width < MIN_DRAG || height < MIN_DRAG) return;
      crop = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width, height };
    }

    function onUp() {
      from = null;
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }

  /** Draws the stage's photo into the canvas on the page. */
  function showStage(canvas: HTMLCanvasElement) {
    if (!stage) return;
    canvas.width = stage.width;
    canvas.height = stage.height;
    canvas.getContext('2d')?.drawImage(stage, 0, 0);
  }

  async function save(spine: 'crop' | 'cloth' | 'drawn') {
    if (busy) return;
    saving = true;
    error = null;
    try {
      let image: Blob | null = null;
      if (spine === 'drawn') image = drawn?.blob ?? null;
      else if (spine === 'crop' && photo) image = await cropPhoto(photo, turns, crop);
      await library.setSpine(book.id, image);
      onClose();
    } catch (failure) {
      error = failed(failure, 'Saving failed, try again');
    } finally {
      saving = false;
    }
  }
</script>

<div class="spine-picker" role="group" aria-label="Photo of the spine" aria-busy={working !== null}>
  {#if drawn}
    <p class="title">The spine ChatGPT drew</p>
    <img class="drawn" src={drawn.url} alt="The drawn spine of {book.title}" />
    <p class="hint">Save it if it looks right, or let ChatGPT try again.</p>
  {:else if found}
    {#if candidate}
      <p class="title">{candidate.showsSpine ? 'Is this its spine?' : 'Could this be its spine?'}</p>
      <figure class="found">
        <img src={candidate.preview} alt="A photo found on the web for {book.title}" />
        <figcaption>{candidate.note}</figcaption>
      </figure>
      <p class="hint">
        Photo {shown + 1} of {found.length}
        {#if !candidate.showsSpine}
          · ChatGPT doubts it shows the spine
        {/if}
        · <a href={candidate.pageUrl} target="_blank" rel="noopener noreferrer">where it was found</a>
      </p>
    {:else}
      <p class="title">No photo of its spine</p>
      <p class="hint">
        {found.length > 0 ? 'That was every photo it found.' : 'None turned up this time.'}
        Let ChatGPT search again, or photograph your own copy.
      </p>
    {/if}
  {:else if stage}
    <p class="title">Drag around the spine</p>
    <div class="cropper" bind:clientWidth={roomWidth} bind:clientHeight={roomHeight}>
      <div
        class="stage"
        style:width="{Math.max(0, stage.width * stageScale)}px"
        style:height="{Math.max(0, stage.height * stageScale)}px"
      >
        <canvas {@attach showStage} {@attach cropping} aria-label="The photo to crop"></canvas>
        <span
          class="crop"
          style:left="{crop.x * 100}%"
          style:top="{crop.y * 100}%"
          style:width="{crop.width * 100}%"
          style:height="{crop.height * 100}%"
        ></span>
      </div>
      <canvas
        {@attach showPreview}
        class="preview"
        style:width="{previewWidth}px"
        style:height="{previewHeight}px"
        aria-label="The spine as it will stand on the shelf"
      ></canvas>
    </div>
  {:else}
    <p class="title">Photo of the spine</p>
    {#if book.spineUrl}
      <img class="current" src={book.spineUrl} alt="The spine of {book.title}" />
    {:else}
      <p class="hint">Its spine is cloth, dyed after the cover.</p>
    {/if}
    <p class="hint">Photograph the real one, even on a full shelf, and crop it out.</p>
    {#if ai.connected('openai')}
      <p class="hint">
        {book.spineUrl
          ? 'Or let ChatGPT redraw this one sharp and straight, to sit seamlessly beside the cover, or find another on the web.'
          : 'Or let ChatGPT find a photo of it on the web and draw it sharp and straight.'}
      </p>
    {:else}
      <p class="hint">Connect ChatGPT under AI Keys in the menu to have it find and draw the spine.</p>
    {/if}
  {/if}

  {#if working}
    <div class="working">
      <span class="spinner" aria-hidden="true"></span>
      <p role="status">{stepOf}{doing}…</p>
      <span class="elapsed" aria-label="Time taken so far">{elapsed}</span>
      <button type="button" class="stop" onclick={stop}>Stop</button>
    </div>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <span class="choices">
    {#if drawn}
      <button type="button" disabled={busy} onclick={() => (drawn = null)}>Back</button>
      <button type="button" disabled={busy} onclick={() => drawn && draw(drawn.from)}>
        {working === 'drawing' ? 'Drawing…' : 'Try again'}
      </button>
      <button type="button" class="primary" disabled={busy} onclick={() => save('drawn')}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    {:else if found}
      <button type="button" disabled={busy} onclick={() => (found = null)}>Back</button>
      <button type="button" disabled={busy} onclick={next}>
        {#if working === 'finding'}
          Searching…
        {:else if more}
          Not it
        {:else}
          {candidate ? 'Not it, search again' : 'Search again'}
        {/if}
      </button>
      {#if candidate}
        <button
          type="button"
          class="primary"
          disabled={busy}
          onclick={() => candidate && draw(candidate.imageUrl)}
        >
          {working === 'drawing' ? 'Drawing…' : 'Use it'}
        </button>
      {/if}
    {:else if stage}
      <button type="button" disabled={busy} onclick={() => (photo = null)}>Back</button>
      <button type="button" disabled={busy} onclick={turn}>Turn</button>
      {#if ai.connected('openai')}
        <button type="button" disabled={busy} onclick={drawCrop}>
          {working === 'drawing' ? 'Drawing…' : 'Draw with AI'}
        </button>
      {/if}
      <button type="button" class="primary" disabled={busy} onclick={() => save('crop')}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    {:else}
      <button type="button" disabled={busy} onclick={onClose}>Cancel</button>
      {#if book.spineUrl}
        <button type="button" disabled={busy} onclick={() => save('cloth')}>
          {saving ? 'Saving…' : 'Use cloth'}
        </button>
      {/if}
      {#if ai.connected('openai')}
        <button type="button" disabled={busy} onclick={find}>
          {working === 'finding' ? 'Searching…' : 'Find with AI'}
        </button>
        {#if book.spineUrl}
          <button type="button" disabled={busy} onclick={() => book.spineUrl && draw(book.spineUrl)}>
            {working === 'drawing' ? 'Drawing…' : 'Improve with AI'}
          </button>
        {/if}
      {/if}
      <button type="button" class="primary" disabled={busy} onclick={() => photoInput?.click()}>
        {book.spineUrl ? 'Another photo' : 'Upload a photo'}
      </button>
    {/if}
  </span>
  <input
    bind:this={photoInput}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    hidden
    onchange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) open(file);
    }}
  />
</div>

<style>
  /* laid over the first page, like the cover picker */
  .spine-picker {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 36px 32px 18px;
    background-color: inherit;
    background-image: inherit;
    border-radius: inherit;
  }

  @media (width < 700px) {
    .spine-picker {
      gap: 10px;
      padding: 20px 20px 12px;
    }
  }

  .title {
    font-family: var(--serif);
    font-weight: 700;
    font-size: 24px;
    color: var(--paper-title);
  }

  .hint {
    margin: 0;
    font-style: italic;
    font-size: 15px;
    color: var(--paper-muted);
    text-align: center;
  }

  .current {
    max-height: 60%;
    min-height: 0;
    box-shadow: 0 4px 10px rgb(46 32 38 / 0.3);
  }

  .drawn {
    max-height: 60%;
    min-height: 0;
    border-radius: 2px 2px 1px 1px;
    box-shadow: 0 6px 14px rgb(46 32 38 / 0.35);
  }

  /* the found photo shown, as large as the page lets it */
  .found {
    flex: 1;
    min-height: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .found img {
    flex: 1;
    min-height: 0;
    max-width: 100%;
    object-fit: contain;
    box-shadow: 0 4px 10px rgb(46 32 38 / 0.3);
  }

  .found figcaption {
    font-size: 14px;
    color: var(--paper-title);
    text-align: center;
  }

  .hint a {
    color: inherit;
  }

  .working {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-style: italic;
    font-size: 15px;
    color: var(--paper-muted);
    text-align: center;
  }

  .working p {
    margin: 0;
  }

  /* the minutes and seconds keep their width as they count */
  .elapsed {
    font-style: normal;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }

  .stop {
    padding: 2px 8px;
  }

  .spinner {
    flex: none;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      rotate: 1turn;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }

  .cropper {
    flex: 1;
    min-height: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  /* the crop is laid over the photo in shares of its size */
  .stage {
    position: relative;
    flex: none;
    overflow: hidden;
  }

  .stage canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .crop {
    position: absolute;
    outline: 2px solid var(--paper-accent);
    box-shadow: 0 0 0 100vmax rgb(20 10 14 / 0.55);
    pointer-events: none;
  }

  .preview {
    flex: none;
    border-radius: 2px 2px 1px 1px;
    box-shadow: 0 6px 14px rgb(46 32 38 / 0.35);
  }

  .error {
    color: #a3243b;
    font-size: 14px;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--paper-muted);
    font-family: var(--caps);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  button:hover {
    background: rgb(107 74 88 / 0.1);
    color: var(--paper-title);
  }

  .primary {
    color: var(--paper-accent);
  }

  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  button:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }
</style>
