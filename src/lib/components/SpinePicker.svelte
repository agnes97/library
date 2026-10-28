<script lang="ts">
  import { library } from '../library.svelte';
  import { cropPhoto, drawTurned, loadPhoto, WHOLE, type Crop } from '../photo';
  import type { Book } from '../types';

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
      if (saving) return;
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

  async function save(spine: 'crop' | 'cloth') {
    if (saving) return;
    saving = true;
    error = null;
    try {
      await library.setSpine(
        book.id,
        spine === 'crop' && photo ? await cropPhoto(photo, turns, crop) : null
      );
      onClose();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Saving failed, try again';
    } finally {
      saving = false;
    }
  }
</script>

<div class="spine-picker" role="group" aria-label="Photo of the spine">
  {#if stage}
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
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <span class="choices">
    {#if stage}
      <button type="button" disabled={saving} onclick={() => (photo = null)}>Back</button>
      <button type="button" disabled={saving} onclick={turn}>Turn</button>
      <button type="button" class="primary" disabled={saving} onclick={() => save('crop')}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    {:else}
      <button type="button" disabled={saving} onclick={onClose}>Cancel</button>
      {#if book.spineUrl}
        <button type="button" disabled={saving} onclick={() => save('cloth')}>
          {saving ? 'Saving…' : 'Use cloth'}
        </button>
      {/if}
      <button type="button" class="primary" disabled={saving} onclick={() => photoInput?.click()}>
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
