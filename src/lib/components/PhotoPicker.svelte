<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { ai } from '../ai.svelte';
  import { library, type SpineProgress } from '../library.svelte';
  import { cropPhoto, drawTurned, loadPhoto, WHOLE, type Crop } from '../photo';
  import { spineJob } from '../spineJob';
  import type { Book, PhotoCandidate } from '../types';
  import Icon from './Icon.svelte';
  import PageBar from './PageBar.svelte';
  import Pill from './Pill.svelte';

  type Props = {
    book: Book;
    /** what is cropped out of the photo: the spine, or the cover, which ChatGPT doesn't draw */
    part?: 'spine' | 'cover';
    /**
     * what the reader chose: finding photos of it on the web, ChatGPT redrawing the current one,
     * or their own photo; or picking up the drawing under way before the page reloaded
     */
    start: 'find' | 'improve' | File | 'resume';
    onClose: () => void;
  };

  let { book, part = 'spine', start, onClose }: Props = $props();

  /** the photo shown for cropping is drawn no bigger than this */
  const STAGE_SIDE = 1000;
  /** a photo narrower than this is taken as the spine alone, a wider one as a shelf */
  const SPINE_SHAPE = 0.4;
  /** a drag shorter than this share of the photo is a click, not a crop */
  const MIN_DRAG = 0.02;
  /** how tall the spine shows beside the photo, at most, as on the shelf, and a cover, smaller */
  const PREVIEW_HEIGHT = { spine: 200, cover: 150 };
  /** between the photo and the spine beside it, as in the styles below */
  const GAP = 16;
  /** between the turn button and the photo below it, and the label and the result, as in the styles below */
  const BAR_GAP = 6;
  /** what a spine ChatGPT invented is drawn from, in place of a photo's URL or crop */
  const INVENTED = 'invent';

  /** the photo being cropped */
  let photo = $state.raw<ImageBitmap | null>(null);
  /** quarter turns clockwise, for a photo of books lying down */
  let turns = $state(0);
  let crop = $state<Crop>(WHOLE);
  let saving = $state(false);
  let error = $state<string | null>(null);
  /** photos of the book found on the web, all shown at once for the reader to pick from */
  let found = $state.raw<PhotoCandidate[] | null>(null);
  /** the round of searching done last, each looking the book up in other ways */
  let round = -1;
  /** whether searching again would look in another way */
  let more = $state(false);
  /** the first photo the last search again added, scrolled to */
  let added = $state.raw<PhotoCandidate | null>(null);
  /** a search again that turned up nothing new */
  let nothingNew = $state(false);
  /** the found photo last opened to crop, marked among the others on going back to them */
  let picked = $state.raw<PhotoCandidate | null>(null);
  /** found photos whose small copy won't show, which drop out of the grid */
  const broken = new SvelteSet<string>();
  /** the spine ChatGPT drew, shown until it is saved or let go; `from` is INVENTED for one it made up */
  let drawn = $state.raw<{ blob: Blob; url: string; from?: string | Blob } | null>(null);
  /** what is under way: searching, fetching a found photo, or ChatGPT drawing, which can take a minute */
  let working = $state<'finding' | 'opening' | 'drawing' | null>(null);
  /** the drawing under way makes the spine up rather than drawing it after a photo */
  let inventing = $state(false);
  /** the step it is on, as OpenAI last told */
  let progress = $state.raw<SpineProgress | null>(null);
  /** when it started, and the clock ticking along beside it */
  let startedAt = $state(0);
  let now = $state(0);
  const busy = $derived(saving || working !== null);
  /** where no photo found shows it well, ChatGPT can make the spine up instead */
  const canInvent = $derived(part === 'spine' && ai.connected('openai'));
  /** stops whatever is under way once the picker closes */
  const closing = new AbortController();
  /** stops the search or drawing under way when the reader gives up on it */
  let stopping: AbortController | null = null;
  let photoInput = $state<HTMLInputElement>();
  /** the room for the photo and the spine beside it */
  let roomWidth = $state(0);
  let roomHeight = $state(0);
  /** the turn button's height above the photo, and the label's above the result */
  let barHeight = $state(0);

  /** the photo as it shows, turned and small enough to draw on every drag */
  const stage = $derived(photo ? drawTurned(photo, turns, WHOLE, STAGE_SIDE) : null);
  const previewHeight = $derived(
    Math.max(0, Math.min(PREVIEW_HEIGHT[part], roomHeight - barHeight - BAR_GAP))
  );
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
          (roomHeight - barHeight - BAR_GAP) / stage.height
        )
      : 0
  );

  const heading = $derived.by(() => {
    if (drawn) return 'The spine ChatGPT drew';
    if (stage) return `Drag around the ${part}`;
    if (found) return found.length > 0 ? `Pick a photo of its ${part}` : `No photo of its ${part}`;
    if (start === 'find') return `Finding its ${part}`;
    if (start === 'improve' || start === 'resume') return 'Improving its spine';
    return `Photo of the ${part}`;
  });

  // the photo goes when it is replaced or the picker closes
  $effect(() => {
    const current = photo;
    return () => current?.close();
  });

  // the drawing is kept for a reload only while this is open
  $effect(() => () => {
    closing.abort();
    if (part === 'spine') spineJob.forget();
  });

  // the elapsed time counts up while it works
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

  /** What is under way, in words. */
  const doing = $derived.by(() => {
    if (working === 'finding') return 'Searching the web for photos of it';
    if (working === 'opening') return 'Fetching the photo';
    if (!progress || progress.queued) return 'Waiting for ChatGPT to start';
    return inventing ? 'Inventing the spine after its cover' : 'Drawing the spine straight and sharp';
  });

  const elapsed = $derived.by(() => {
    const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  /** Starts working, returning the signal that stops it. */
  function begin(what: 'finding' | 'opening' | 'drawing'): AbortSignal {
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
    // stopped before anything turned up, so there is nothing left here to show
    if (!drawn && !found && !stage && !error && !closing.signal.aborted) onClose();
  }

  /** Lets go of what is under way; a drawing may still finish at OpenAI, unseen. */
  function stop() {
    stopping?.abort();
  }

  /**
   * Goes up a level: from the drawn spine to what it was drawn after, from a photo being cropped
   * to the others found, otherwise out.
   */
  export function back() {
    if (saving) return;
    if (drawn && (found || stage)) {
      drawn = null;
      spineJob.forget();
    } else if (stage && found) {
      photo = null;
      error = null;
    } else onClose();
  }

  /**
   * Searches the web for photos of the book, or again in other ways, adding the photos not shown
   * yet below the others; a round that adds none goes straight on to the next.
   */
  async function find() {
    if (busy) return;
    const signal = begin('finding');
    nothingNew = false;
    try {
      const shown = new Set(found?.map(({ imageUrl }) => imageUrl));
      let fresh: PhotoCandidate[] = [];
      do {
        const result =
          part === 'cover'
            ? await library.findCovers(book.id, round + 1, signal)
            : await library.findSpines(book.id, round + 1, signal);
        round++;
        more = result.more;
        fresh = result.candidates.filter(({ imageUrl }) => !shown.has(imageUrl));
      } while (fresh.length === 0 && more && !signal.aborted);
      if (signal.aborted) return;
      added = found && fresh.length > 0 ? fresh[0] : null;
      nothingNew = !!found && fresh.length === 0;
      found = [...(found ?? []), ...fresh];
    } catch (failure) {
      if (signal.aborted) return;
      error = failed(failure, 'The search failed, try again');
    } finally {
      end();
    }
  }

  /** Opens a found photo to crop its spine or cover out of. */
  async function pick(candidate: PhotoCandidate) {
    if (busy) return;
    const signal = begin('opening');
    try {
      const blob = await library.foundPhoto(candidate, signal);
      if (signal.aborted) return;
      await open(blob);
      picked = candidate;
    } catch (failure) {
      if (signal.aborted) return;
      error = failed(failure, 'That photo can’t be fetched, pick another');
    } finally {
      end();
    }
  }

  /**
   * Shows ChatGPT drawing through `run`, after `from` (left out for a crop picked up after a
   * reload), from `since` it began, and the spine it drew.
   */
  async function drawing(
    from: string | Blob | undefined,
    run: (signal: AbortSignal, onProgress: (job: SpineProgress) => void) => Promise<Blob>,
    since = Date.now()
  ) {
    if (busy) return;
    const signal = begin('drawing');
    startedAt = now = since;
    inventing = from === INVENTED;
    try {
      const blob = await run(signal, (job) => {
        progress = job;
        // kept for the tab, so a reload picks the drawing up again
        spineJob.save({
          book: book.id,
          job: job.job,
          startedAt,
          from: typeof from === 'string' ? from : undefined,
        });
      });
      // still kept, so a reload before it is saved shows it again, fetched once more from OpenAI
      drawn = { blob, url: URL.createObjectURL(blob), from };
    } catch (failure) {
      spineJob.forget();
      if (signal.aborted) return;
      error = failed(failure, 'Drawing failed, try again');
      // the key may have been let go on the server, which the menu should show
      ai.load();
    } finally {
      end();
    }
  }

  /**
   * Has ChatGPT draw the spine after one on the shelf, by its URL, or a crop of a photo, or invent
   * it after the cover and the series when `from` is INVENTED.
   */
  function draw(from: string | Blob) {
    return drawing(from, (signal, onProgress) =>
      from === INVENTED
        ? library.inventSpine(book.id, signal, onProgress)
        : library.drawSpine(book.id, from, signal, onProgress)
    );
  }

  /** the drawing under way before the page reloaded, when that is what this picks up */
  const resumed = untrack(() => (start === 'resume' ? spineJob.saved() : null));

  /** Follows the drawing under way before the page reloaded on to the spine it draws. */
  function resume() {
    if (resumed?.book !== book.id) return onClose();
    const { job, startedAt: since, from } = resumed;
    drawing(
      from,
      (signal, onProgress) =>
        library.followDrawing(book.id, { status: 'working', job }, since, signal, onProgress),
      since
    );
  }

  async function drawCrop() {
    if (!photo || busy) return;
    try {
      await draw(await cropPhoto(photo, turns, crop));
    } catch (failure) {
      error = failed(failure, 'That photo can’t be read');
    }
  }

  /** Does again what the reader chose, after it failed. */
  function retry() {
    if (start === 'find') find();
    else if (start === 'improve' && book.spineUrl) draw(book.spineUrl);
    else if (resumed?.from) draw(resumed.from);
    else photoInput?.click();
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

  /**
   * A photo of the spine alone is taken whole; on one of a shelf it starts as a strip in the
   * middle. A cover is taken whole, as photos of one mostly show it alone.
   */
  function startCrop() {
    if (!stage) return;
    crop =
      part === 'cover' || stage.width / stage.height < SPINE_SHAPE
        ? WHOLE
        : { x: 0.44, y: 0.05, width: 0.12, height: 0.9 };
  }

  async function open(file: Blob) {
    error = null;
    try {
      photo = await loadPhoto(file);
      picked = null;
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

  /** Scrolls the grid down to the first photo a search again added. */
  function showAdded(item: HTMLElement) {
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Draws the stage's photo into the canvas on the page. */
  function showStage(canvas: HTMLCanvasElement) {
    if (!stage) return;
    canvas.width = stage.width;
    canvas.height = stage.height;
    canvas.getContext('2d')?.drawImage(stage, 0, 0);
  }

  async function save(spine: 'crop' | 'drawn') {
    if (busy) return;
    saving = true;
    error = null;
    try {
      const image = spine === 'drawn' ? drawn?.blob : photo && (await cropPhoto(photo, turns, crop));
      if (image && part === 'cover') await library.setCover(book.id, image);
      else if (image) await library.setSpine(book.id, image);
      onClose();
    } catch (failure) {
      error = failed(failure, 'Saving failed, try again');
    } finally {
      saving = false;
    }
  }

  untrack(() => {
    if (start === 'find') find();
    else if (start === 'improve') retry();
    else if (start === 'resume') resume();
    else open(start);
  });
</script>

<div class="photo-picker" role="group" aria-label="Photo of the {part}" aria-busy={working !== null}>
  <PageBar
    title={heading}
    cancel={!!drawn || (!!stage && !found)}
    disabled={saving}
    onBack={back}
  />

  <!-- kept while a photo is cropped, so going back finds the grid scrolled where it was -->
  {#if found}
    <div class="found" style:display={drawn || stage ? 'none' : null}>
      {#if found.length > 0}
        <ul aria-label="Photos found on the web">
          {#each found as candidate (candidate.imageUrl)}
            {#if !broken.has(candidate.imageUrl)}
              <li {@attach candidate === added && showAdded}>
                <button
                  type="button"
                  class:picked={candidate === picked}
                  title={candidate.title}
                  disabled={busy}
                  onclick={() => pick(candidate)}
                >
                  <img
                    src={candidate.preview}
                    alt={candidate.title || `A photo found for ${book.title}`}
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onerror={() => broken.add(candidate.imageUrl)}
                  />
                </button>
              </li>
            {/if}
          {/each}
        </ul>
        <p class="hint">
          {nothingNew
            ? `No other photos turned up. Pick one of these, ${canInvent ? 'have ChatGPT invent it, ' : ''}or photograph your own copy.`
            : more && canInvent
              ? `Pick the one that shows its ${part} best, to crop it out, search for others, or have ChatGPT invent it.`
              : more
                ? `Pick the one that shows its ${part} best, to crop it out, or search for others.`
                : canInvent
                  ? `Pick the one that shows its ${part} best, to crop it out, or have ChatGPT invent it.`
                  : `Pick the one that shows its ${part} best, to crop it out.`}
        </p>
      {:else}
        <p class="hint">
          {canInvent
            ? 'None turned up. Have ChatGPT invent it, or photograph your own copy.'
            : 'None turned up. Photograph your own copy instead.'}
        </p>
      {/if}
    </div>
  {/if}

  {#if drawn}
    <img class="drawn" src={drawn.url} alt="The drawn spine of {book.title}" />
    <p class="hint">Save it if it looks right, or let ChatGPT try again.</p>
  {:else if stage}
    <div class="cropper" bind:clientWidth={roomWidth} bind:clientHeight={roomHeight}>
      <!-- the turn button sits over the photo's top left corner -->
      <div class="photo">
        <div class="bar" bind:clientHeight={barHeight}>
          <button
            type="button"
            class="turn"
            title="Turn the photo"
            disabled={busy}
            onclick={turn}
          >
            <Icon name="turn" size={16} />
            Turn
          </button>
          <span class="label divided">Suggestion</span>
        </div>
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
      </div>
      <!-- as tall as the photo beside it, so the labels line up along the top -->
      <div
        class="result"
        style:height="{barHeight + BAR_GAP + Math.max(0, stage.height * stageScale)}px"
      >
        <span class="label" style:height="{barHeight}px">Final</span>
        <canvas
          {@attach showPreview}
          class="preview"
          style:width="{previewWidth}px"
          style:height="{previewHeight}px"
          aria-label={part === 'cover'
            ? 'The cover as it will show'
            : 'The spine as it will stand on the shelf'}
        ></canvas>
      </div>
    </div>
    <p class="hint">
      {part === 'spine' && ai.connected('openai')
        ? 'Hit Improve with AI or Save when you’re done cropping.'
        : 'Hit Save when you’re done cropping.'}
    </p>
  {:else if start === 'improve' && book.spineUrl && !found}
    <img class="current" src={book.spineUrl} alt="The spine of {book.title}" />
  {/if}

  <div class="foot">
    {#if working}
      <div class="working">
        <span class="spinner" aria-hidden="true"></span>
        <p role="status">{doing}…</p>
        <span class="elapsed" aria-label="Time taken so far">{elapsed}</span>
        <button type="button" class="stop" onclick={stop}>Stop</button>
      </div>
    {/if}

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <span class="choices">
      {#if drawn}
        <!-- a crop drawn before a reload is gone with the page, so it can't be drawn again -->
        {#if drawn.from}
          <Pill disabled={busy} onclick={() => drawn?.from && draw(drawn.from)}>
            {working === 'drawing' ? 'Drawing…' : 'Try again'}
          </Pill>
        {/if}
        <Pill kind="primary" disabled={busy} onclick={() => save('drawn')}>
          {saving ? 'Saving…' : 'Save'}
        </Pill>
      {:else if stage}
        {#if part === 'spine' && ai.connected('openai')}
          <Pill
            icon="sparkle"
            title="Have ChatGPT draw this crop sharp and straight"
            disabled={busy}
            onclick={drawCrop}
          >
            {working === 'drawing' ? 'Drawing…' : 'Improve with AI'}
          </Pill>
        {/if}
        <Pill kind="primary" disabled={busy} onclick={() => save('crop')}>
          {saving ? 'Saving…' : 'Save'}
        </Pill>
      {:else if found}
        {#if more}
          <Pill title="Search the web for other photos of it" disabled={busy} onclick={find}>
            {working === 'finding' ? 'Searching…' : 'More photos'}
          </Pill>
        {/if}
        {#if canInvent}
          <Pill
            icon="sparkle"
            title="Have ChatGPT invent the spine after its cover and the rest of its series"
            disabled={busy}
            onclick={() => draw(INVENTED)}
          >
            {working === 'drawing' ? 'Inventing…' : 'Invent'}
          </Pill>
        {/if}
        <Pill
          icon="upload"
          title="Upload your own photo"
          disabled={busy}
          onclick={() => photoInput?.click()}
        >
          Upload
        </Pill>
      {:else if error && !working}
        <Pill disabled={busy} onclick={retry}>
          {start instanceof File || (start === 'resume' && !resumed?.from)
            ? 'Choose another photo'
            : 'Try again'}
        </Pill>
      {/if}
    </span>
  </div>
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
  /* laid over the first page, like the cover and spine page */
  .photo-picker {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px 28px 18px 24px;
    background-color: inherit;
    background-image: inherit;
    border-radius: inherit;
  }

  @media (width < 700px) {
    .photo-picker {
      gap: 10px;
      padding: 14px 16px 12px;
    }
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

  /* every found photo, scrolling within the page */
  .found {
    flex: 1;
    min-height: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .found ul {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    align-content: start;
    gap: 10px;
    margin: 0;
    padding: 4px;
    list-style: none;
  }

  .found button {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: rgb(107 74 88 / 0.08);
    cursor: pointer;
    overflow: hidden;
  }

  .found button:disabled {
    cursor: default;
  }

  .found button:hover:not(:disabled),
  .found button.picked {
    outline: 2px solid var(--paper-muted);
    outline-offset: 2px;
  }

  .found button:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }

  .found img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
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
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--paper-muted);
    font-family: var(--caps);
    font-style: normal;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .stop:hover {
    background: rgb(107 74 88 / 0.1);
    color: var(--paper-title);
  }

  .stop:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
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

  .photo,
  .result {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .result {
    align-items: center;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* bare words before the label, set off from it by a line */
  .turn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 0;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--paper-muted);
    cursor: pointer;
  }

  .turn:hover:not(:disabled) {
    color: var(--paper-title);
  }

  .turn:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .turn:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }

  .divided {
    padding-left: 8px;
    border-left: 1px solid rgb(107 74 88 / 0.35);
  }

  /* which is the photo to crop and which is what gets saved */
  .label {
    display: flex;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
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
    outline: 2px dashed var(--paper);
    /* inside the crop, so a whole cover shows selected too */
    outline-offset: -2px;
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

  /* along the foot of the page, whatever shows above */
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: auto;
  }

  /* always on one line, however many there are */
  .choices {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  @media (width < 700px) {
    .choices {
      gap: 6px;
    }

    .choices :global(.pill) {
      padding-inline: 12px;
    }
  }
</style>
