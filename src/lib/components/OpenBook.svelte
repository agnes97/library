<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { auth } from '../auth.svelte';
  import { coverShape, preloadCover } from '../covers';
  import { library } from '../library.svelte';
  import { spineJob } from '../spineJob';
  import type { BookEdit, ShelfBook } from '../types';
  import BookCover3D from './BookCover3D.svelte';
  import LookEditor from './LookEditor.svelte';
  import Pill from './Pill.svelte';

  type Props = {
    reading: ShelfBook;
    /** the shelf spine the book flies out of and back into */
    spine: HTMLElement;
    onClose: () => void;
  };

  let { reading, spine, onClose }: Props = $props();

  const book = $derived(reading.book);
  /** only its reader can take a reading off the shelf */
  const canRemove = $derived(reading.readBy.id === auth.user?.id);
  /** only those logged in can correct a book; the samples shown to visitors are read-only */
  const canEdit = $derived(auth.isAuthenticated);

  const titleId = $props.id();

  /** wide screens open the book on a spread of two pages, narrow ones show one page at a time */
  const LANDSCAPE = { pageWidth: 440, pageHeight: 580, coverHeight: 300 };
  const PORTRAIT = { pageWidth: 340, pageHeight: 480, coverHeight: 260 };
  /** leather and page edges sticking out past the pages */
  const OVERHANG = 20;
  const GUTTER = 32;
  /** closing replays the opening backwards, this much faster */
  const CLOSE_RATE = 1.6;
  /** the cover's spine strip on closing, rolling up over a longer stretch than it unrolled */
  const STRIP_CLOSING: Keyframe[] = [
    { offset: 0, clipPath: 'inset(0)' },
    { offset: 0.45, clipPath: 'inset(0)', easing: 'ease-in-out' },
    { offset: 0.7, clipPath: 'inset(0 0 0 100%)' },
    { offset: 1, clipPath: 'inset(0 0 0 100%)' },
  ];
  /** the named easings as curves, so they can be run backwards */
  const EASINGS: Record<string, number[]> = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
  };
  /** how long the book waits for a cover still loading before it flies without its shape */
  const COVER_WAIT = 400;

  /** the tallest a portrait page grows on a tall phone, and how much of that the cover takes */
  const PORTRAIT_MAX_HEIGHT = 600;
  const PORTRAIT_COVER_SHARE = 0.6;

  /** a page turn from one side to the other; dragging part of the way takes part of the time */
  const LEAF_TURN = 560;
  const LEAF_EASING = 'cubic-bezier(0.3, 0.7, 0.2, 1)';
  /** how far a drag has to go to turn the page all the way, as a share of the page's width */
  const LEAF_DRAG = 1.2;
  /** remembered once the first page has lifted its corner to show it turns */
  const TURN_HINTED = 'pageTurnHinted';

  const portrait = $derived((innerWidth.current ?? 1024) < 700);
  /** a phone taller than the book is wide fills its height with a taller page, not empty backdrop */
  const portraitLayout = $derived.by(() => {
    const { pageWidth, pageHeight, coverHeight } = PORTRAIT;
    const fit = ((innerWidth.current ?? pageWidth) - GUTTER) / (pageWidth + OVERHANG * 2);
    const room = ((innerHeight.current ?? 0) - GUTTER) / Math.min(1, fit) - OVERHANG * 2;
    const height = Math.min(PORTRAIT_MAX_HEIGHT, Math.max(pageHeight, Math.floor(room)));
    return {
      pageWidth,
      pageHeight: height,
      coverHeight: Math.round(coverHeight + (height - pageHeight) * PORTRAIT_COVER_SHARE),
    };
  });
  const layout = $derived(portrait ? portraitLayout : LANDSCAPE);

  // shrink the whole book until it fits the window
  const scale = $derived.by(() => {
    const { pageWidth, pageHeight } = layout;
    const width = (portrait ? pageWidth : pageWidth * 2) + OVERHANG * 2;
    const height = pageHeight + OVERHANG * 2;
    return Math.min(
      1,
      ((innerWidth.current ?? width) - GUTTER) / width,
      ((innerHeight.current ?? height) - GUTTER) / height
    );
  });

  type Origin = {
    /** the spine's centre on screen */
    x: number;
    y: number;
    /** its size before it is tipped over */
    width: number;
    height: number;
    /** how far it is tipped over, in degrees */
    tilt: number;
  };
  let origin = $state.raw<Origin>();

  function measure(): Origin {
    const { left, top, width, height } = spine.getBoundingClientRect();
    const { rotate } = getComputedStyle(spine);
    return {
      x: left + width / 2,
      y: top + height / 2,
      width: spine.offsetWidth,
      height: spine.offsetHeight,
      tilt: rotate === 'none' ? 0 : parseFloat(rotate),
    };
  }

  // the transform that lays the closed cover exactly over the spine on the shelf
  const from = $derived.by(() => {
    const { pageWidth: pw, pageHeight: ph } = layout;
    if (!origin) {
      return portrait
        ? { x: -5.4, y: 0, r: 0, sx: 0.9, sy: 0.9 }
        : { x: pw * -0.39 - 4.68, y: 0, r: 0, sx: 0.78, sy: 0.78 };
    }

    // the closed cover's size and how far its centre sits from the book's centre
    const coverWidth = pw + 12;
    const coverHeight = ph + 24;
    const offsetX = portrait ? 6 : pw / 2 + 6;

    // a book lying flat in a pile starts turned a quarter anticlockwise, top to the left,
    // and a tipped one starts tipped, so each rotates upright as it flies instead of being
    // squashed into shape
    const flat = origin.width > origin.height;
    const r = origin.tilt + (flat ? -90 : 0);
    const sx = (flat ? origin.height : origin.width) / (scale * coverWidth);
    const sy = (flat ? origin.width : origin.height) / (scale * coverHeight);

    // the cover's centre, scaled and turned, has to land on the spine's centre
    const dx = (origin.x - (innerWidth.current ?? 0) / 2) / scale;
    const dy = (origin.y - (innerHeight.current ?? 0) / 2) / scale;
    const cos = Math.cos((r * Math.PI) / 180);
    const sin = Math.sin((r * Math.PI) / 180);
    const cx = sx * offsetX;
    return { x: dx - cx * cos, y: dy - cx * sin, r, sx, sy };
  });

  let closing = $state(false);
  /** taken off the shelf, so it fades away instead of flying back to a spine that is gone */
  let removed = $state(false);
  let dialog: HTMLDialogElement;

  /** The same curve run backwards, e.g. ease-in for ease-out. */
  function mirrorEasing(easing: string) {
    const curve =
      EASINGS[easing] ?? easing.match(/^cubic-bezier\((.*)\)$/)?.[1].split(',').map(Number);
    if (!curve) return 'linear';
    const [x1, y1, x2, y2] = curve;
    return `cubic-bezier(${1 - x2}, ${1 - y2}, ${1 - x1}, ${1 - y1})`;
  }

  /** The keyframes back to front, so playing them forwards plays the originals backwards. */
  function mirror(keyframes: ComputedKeyframe[]): Keyframe[] {
    const last = keyframes.length - 1;
    return keyframes.map((_, i) => {
      const { computedOffset, easing, offset, composite, ...frame } = keyframes[last - i];
      // the stretch to the next frame eases like the one that led here, run backwards
      const next = keyframes[last - i - 1];
      return {
        ...frame,
        offset: 1 - computedOffset,
        easing: next ? mirrorEasing(next.easing) : 'linear',
      };
    });
  }

  /**
   * Plays every opening animation backwards from wherever it is, then closes. Each runs
   * forwards on mirrored keyframes rather than at a negative rate, which made browsers re-render
   * the shrinking book on every frame.
   */
  async function requestClose() {
    if (closing) return;
    closing = true;
    // the book shuts in the order it opened, so a turned page comes back over the details first
    drag = null;
    if (leafRun || leafAt > 0) {
      page = 1;
      await turnLeaf(0, CLOSE_RATE);
    }
    // the spine has slid back into the shelf since it was clicked
    origin = measure();
    const onShelf = `translate(${from.x}px, ${from.y}px) rotate(${from.r}deg) scale(${from.sx}, ${from.sy})`;

    const closings = dialog
      .getAnimations({ subtree: true })
      // the backdrop keeps its own timing
      .filter(
        (animation) =>
          animation instanceof CSSAnimation &&
          !(animation.effect as KeyframeEffect | null)?.pseudoElement
      )
      .map((opening) => {
        const effect = opening.effect as KeyframeEffect;
        const target = effect.target as Element;
        // the spine on the cover rolls up through the beat the shut book rests, not as it lands
        const keyframes = target.classList.contains('strip')
          ? STRIP_CLOSING
          : mirror(effect.getKeyframes());
        if (target.classList.contains('book')) keyframes[keyframes.length - 1].transform = onShelf;

        const { duration, progress } = effect.getComputedTiming();
        const length = Number(duration) / CLOSE_RATE;
        const backwards = target.animate(keyframes, { duration: length, fill: 'both' });
        // shut partway through opening, it heads back from where it got to
        backwards.currentTime = (1 - (progress ?? 1)) * length;
        opening.cancel();
        return backwards;
      });
    await Promise.allSettled(closings.map((animation) => animation.finished));
    onClose();
  }

  /** done opening, so a new cover shape no longer moves anything in flight */
  let landed = false;
  /** a cover shape that arrived while the book was still flying */
  let lateRatio: number | undefined;

  /** Gives the open book a cover's shape, skipping the sweeps that only play while it opens. */
  async function reshape(ratio: number) {
    coverRatio = ratio;
    await tick();
    for (const animation of dialog.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation) animation.finish();
    }
  }

  function onCoverLoad(event: Event) {
    const { naturalWidth, naturalHeight } = event.currentTarget as HTMLImageElement;
    const ratio = naturalWidth / naturalHeight;
    if (ratio === coverRatio || closing) return;
    if (landed) reshape(ratio);
    else lateRatio = ratio;
  }

  function show(node: HTMLDialogElement) {
    dialog = node;
    let gone = false;
    // a cover arriving mid-flight would reshape the board under the moving book, so it gets a
    // moment to load first; one later than that takes its shape once the book has landed
    const shown = untrack(() => cover);
    const ready = shown
      ? Promise.race([preloadCover(shown), new Promise((done) => setTimeout(done, COVER_WAIT))])
      : Promise.resolve();
    ready.then(async () => {
      if (gone) return;
      coverRatio = coverShape(shown) ?? undefined;
      origin = measure();
      node.showModal();

      await Promise.allSettled(node.getAnimations({ subtree: true }).map((a) => a.finished));
      landed = true;
      if (lateRatio && !closing && !gone) reshape(lateRatio);
      if (portrait && !closing && !gone) hintTurn();
    });

    // the page stays put behind the open book; the gutter keeps the shelves from shifting
    const root = document.documentElement;
    const { overflow, scrollbarGutter } = root.style;
    root.style.overflow = 'hidden';
    root.style.scrollbarGutter = 'stable';
    return () => {
      gone = true;
      root.style.overflow = overflow;
      root.style.scrollbarGutter = scrollbarGutter;
    };
  }

  /** e.g. "Harry Potter · Book 3" */
  const seriesLabel = $derived(
    book.seriesNumber === undefined ? book.series : `${book.series} · Book ${book.seriesNumber}`
  );

  type Field = 'title' | 'author' | 'description' | 'series';
  /** the detail being corrected in place, and what it reads while being typed */
  let editing = $state<Field | null>(null);
  let draft = $state('');
  /** the volume's number in the series, typed beside its name */
  let draftNumber = $state('');
  let saving = $state(false);
  let editError = $state<string | null>(null);

  function startEditing(field: Field) {
    if (closing || saving) return;
    editError = null;
    draft = (field === 'description' ? book.description : book[field]) ?? '';
    draftNumber = book.seriesNumber?.toString() ?? '';
    editing = field;
  }

  function stopEditing() {
    if (!saving) editing = null;
  }

  /** a cover that failed to load, so the cloth one shows instead */
  let brokenCover = $state<string>();
  const cover = $derived(
    book.coverUrl !== brokenCover && coverShape(book.coverUrl) !== null ? book.coverUrl : undefined
  );
  /** the cover picture's width over its height, which the front board takes once it loads */
  let coverRatio = $state<number>();
  let brokenSpine = $state<string>();
  const spinePhoto = $derived(book.spineUrl !== brokenSpine ? book.spineUrl : undefined);

  /**
   * changing the cover and the spine on the first page, in place of the 3D cover; open from the
   * start when ChatGPT was still drawing its spine as the page reloaded
   */
  let editingLook = $state(untrack(() => canEdit && spineJob.saved()?.book === book.id));
  let lookEditor = $state<LookEditor>();

  /** asking whether to really take it off the shelf */
  let confirmingRemove = $state(false);
  let removing = $state(false);
  let removeError = $state<string | null>(null);

  async function remove() {
    if (removing) return;
    removing = true;
    removeError = null;
    try {
      await library.remove(reading.key);
      closing = removed = true;
      await tick();
      const fades = dialog
        .getAnimations({ subtree: true })
        .filter(
          (animation) => animation instanceof CSSAnimation && animation.animationName === 'removed'
        );
      await Promise.allSettled(fades.map((animation) => animation.finished));
      onClose();
    } catch (error) {
      removeError = error instanceof Error ? error.message : 'Removing failed, try again';
      removing = false;
    }
  }

  /** Saves the correction for every shelf the book sits on; an empty title is dropped. */
  async function save() {
    if (!editing || saving) return;
    if (editing === 'series') return saveSeries();
    const value = draft.trim();
    const current = (editing === 'description' ? book.description : book[editing]) ?? '';
    if (value === current || (editing === 'title' && !value)) {
      editing = null;
      return;
    }

    const edit: BookEdit =
      editing === 'author'
        ? {
            authors: value
              .split(',')
              .map((author) => author.trim())
              .filter(Boolean),
          }
        : { [editing]: value };
    await commit(edit);
  }

  /** Saves the series and the volume's number in it; an empty name takes the book out of it. */
  async function saveSeries() {
    const series = draft.trim();
    const number = draftNumber.trim().replace(',', '.');
    const seriesNumber = series && number ? Number(number) : null;
    if (seriesNumber !== null && !(seriesNumber > 0)) {
      editError = 'The number in the series must be above zero';
      return;
    }
    if (series === (book.series ?? '') && seriesNumber === (book.seriesNumber ?? null)) {
      editing = null;
      return;
    }
    await commit({ series, seriesNumber });
  }

  async function commit(edit: BookEdit) {
    saving = true;
    try {
      await library.edit(book.id, edit);
      editing = null;
    } catch (error) {
      editError = error instanceof Error ? error.message : 'Saving failed, try again';
    } finally {
      saving = false;
    }
  }

  function onEditKeydown(event: KeyboardEvent) {
    // a description takes several lines, so it is saved with ⌘/Ctrl+Enter
    const multiline = editing === 'description';
    if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  }

  /** Focuses the field and puts the caret after what is already written. */
  function focusEnd(node: HTMLInputElement | HTMLTextAreaElement) {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }

  /**
   * A phone shows one page at a time: page 1 holds the 3D cover on a loose leaf, page 2 the details
   * under it. Turned, the leaf lies to the left by the cover, and its edge there turns it back.
   */
  let page = $state<1 | 2>(1);
  /** said aloud when the page changes */
  let pageAnnounced = $state('');
  /** correcting something, so the page stays where it is */
  const busy = $derived(editingLook || editing !== null || confirmingRemove);
  let flyleaf: HTMLElement | undefined;
  let firstPage = $state<HTMLElement>();
  let title = $state<HTMLElement>();
  /** how far the leaf has turned, 0 lying on the details to 1 lying by the cover */
  let leafAt = 0;
  let leafRun: { start: number; to: number; animations: Animation[] } | null = null;
  let leafPeek: Animation[] = [];

  /** a turned leaf lies over the cover's inside, which lies over the details, so it rises above it */
  const leafTransform = (at: number) => `translateZ(${at > 0 ? 2 : 0.5}px) rotateY(${-180 * at}deg)`;
  /** darkest edge-on */
  const leafShade = (at: number) => Math.sin(Math.PI * at) * 0.45;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function leafShades() {
    return [...(flyleaf?.querySelectorAll<HTMLElement>('.leaf-shade') ?? [])];
  }

  function paintLeaf() {
    if (!flyleaf) return;
    flyleaf.style.transform = leafTransform(leafAt);
    for (const shade of leafShades()) shade.style.opacity = String(leafShade(leafAt));
  }

  /** Stops a turn where it has got to, so a finger can take the leaf from there. */
  function haltLeaf() {
    leafPeek.forEach((animation) => animation.cancel());
    leafPeek = [];
    if (!leafRun) return;
    const { start, to, animations } = leafRun;
    const progress = animations[0].effect?.getComputedTiming().progress ?? 1;
    leafAt = start + (to - start) * progress;
    animations.forEach((animation) => animation.cancel());
    leafRun = null;
    paintLeaf();
  }

  async function turnLeaf(to: number, rate = 1) {
    haltLeaf();
    const start = leafAt;
    if (!flyleaf || reducedMotion()) {
      leafAt = to;
      paintLeaf();
      return;
    }
    // stepped, so the leaf swings round its hinge instead of sliding through it
    const steps = 8;
    const at = Array.from({ length: steps + 1 }, (_, i) => start + ((to - start) * i) / steps);
    const timing: KeyframeAnimationOptions = {
      duration: (LEAF_TURN * Math.max(0.35, Math.abs(to - start))) / rate,
      easing: LEAF_EASING,
      fill: 'forwards',
    };
    const animations = [
      flyleaf.animate(
        at.map((a) => ({ transform: leafTransform(a) })),
        timing
      ),
      ...leafShades().map((shade) =>
        shade.animate(
          at.map((a) => ({ opacity: leafShade(a) })),
          timing
        )
      ),
    ];
    leafRun = { start, to, animations };
    try {
      await animations[0].finished;
    } catch {
      return;
    }
    if (leafRun?.animations !== animations) return;
    leafAt = to;
    paintLeaf();
    animations.forEach((animation) => animation.cancel());
    leafRun = null;
  }

  async function turnTo(target: 1 | 2) {
    if (closing) return;
    page = target;
    pageAnnounced = `Page ${target} of 2`;
    const turned = turnLeaf(target === 2 ? 1 : 0);
    // the page out of view is inert until the change lands
    await tick();
    (target === 2 ? title : firstPage)?.focus({ preventScroll: true });
    await turned;
  }

  /** Lifts the leaf's corner and lets it fall, the first time a book is opened on a phone. */
  function hintTurn() {
    try {
      if (localStorage.getItem(TURN_HINTED)) return;
      localStorage.setItem(TURN_HINTED, '1');
    } catch {
      return;
    }
    if (!flyleaf || busy || page !== 1 || reducedMotion()) return;
    const lift = [0, 0.1, 0];
    const timing = { duration: 950, easing: 'ease-in-out' };
    leafPeek = [
      flyleaf.animate(
        lift.map((a) => ({ transform: leafTransform(a) })),
        timing
      ),
      ...leafShades().map((shade) =>
        shade.animate(
          lift.map((a) => ({ opacity: leafShade(a) })),
          timing
        )
      ),
    ];
  }

  /** a finger turning the leaf from its corner, its outer edge or the edge of the turned leaf */
  let drag: {
    x: number;
    from: number;
    /** the screen pixels that turn it all the way */
    width: number;
    moved: boolean;
    last: { at: number; time: number };
    /** turn per millisecond, so a flick finishes the turn */
    speed: number;
    frame: number;
  } | null = null;

  function startDrag(event: PointerEvent) {
    if (busy || closing || reducedMotion() || event.button !== 0) return;
    haltLeaf();
    drag = {
      x: event.clientX,
      from: leafAt,
      width: layout.pageWidth * scale * LEAF_DRAG,
      moved: false,
      last: { at: leafAt, time: event.timeStamp },
      speed: 0,
      frame: 0,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    const delta = drag.x - event.clientX;
    if (!drag.moved && Math.abs(delta) < 6) return;
    drag.moved = true;
    const at = Math.min(1, Math.max(0, drag.from + delta / drag.width));
    const elapsed = event.timeStamp - drag.last.time;
    if (elapsed > 0) drag.speed = (at - drag.last.at) / elapsed;
    drag.last = { at, time: event.timeStamp };
    leafAt = at;
    cancelAnimationFrame(drag.frame);
    drag.frame = requestAnimationFrame(paintLeaf);
  }

  function endDrag(event: PointerEvent) {
    if (!drag) return;
    const { moved, speed, frame } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    if (!moved) return;
    // the click that follows a drag must not turn the page a second time
    event.currentTarget?.addEventListener('click', (click) => click.stopImmediatePropagation(), {
      capture: true,
      once: true,
    });
    const forward = speed > 0.0015 || (speed >= -0.0015 && leafAt > 0.5);
    turnTo(forward ? 2 : 1);
  }

  /** the turning handlers, shared by every place a page can be turned from */
  const turnable = {
    onpointerdown: startDrag,
    onpointermove: moveDrag,
    onpointerup: endDrag,
    onpointercancel: endDrag,
  };

  /** The leaf starts on the details whenever it appears, as the book always opens on page 1. */
  function leaf(node: HTMLElement) {
    flyleaf = node;
    leafAt = 0;
    leafRun = null;
    page = 1;
    paintLeaf();
    return () => {
      if (flyleaf === node) flyleaf = undefined;
    };
  }

  function onKeydown(event: KeyboardEvent) {
    if (!portrait || busy || closing || !landed) return;
    if (event.key === 'ArrowRight' && page === 1) turnTo(2);
    else if (event.key === 'ArrowLeft' && page === 2) turnTo(1);
    else return;
    event.preventDefault();
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) requestClose();
  }
</script>

{#snippet closeButton()}
  <button type="button" class="close" aria-label="Close book" onclick={requestClose}>
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  </button>
{/snippet}

{#snippet firstPageContent()}
  <div class="page page-1" tabindex="-1" bind:this={firstPage}>
    <div class={['leaf', { asking: confirmingRemove }]}>
      <BookCover3D {book} height={layout.coverHeight} />
      <p class="hint">Drag the cover to turn it</p>
    </div>
    {#if editingLook}
      <LookEditor bind:this={lookEditor} {book} onClose={() => (editingLook = false)} />
    {/if}
    <div class="actions">
      {#if removeError}
        <p class="edit-error" role="alert">{removeError}</p>
      {/if}
      {#if confirmingRemove}
        <span class="remove-ask">Take {book.title} off your shelf?</span>
        <span class="choices">
          <Pill disabled={removing} onclick={() => (confirmingRemove = false)}>Keep it</Pill>
          <Pill kind="danger" icon="bin" disabled={removing} onclick={remove}>
            {removing ? 'Removing…' : 'Remove'}
          </Pill>
        </span>
      {:else}
        <span class="choices">
          {#if canEdit}
            <Pill
              icon="pencil"
              onclick={() => {
                if (!closing) editingLook = true;
              }}
            >
              Edit look
            </Pill>
          {/if}
          {#if canRemove}
            <Pill
              icon="bin"
              aria-label="Remove from shelf"
              title="Remove from shelf"
              onclick={() => (confirmingRemove = true)}
            />
          {/if}
        </span>
      {/if}
    </div>
    {#if portrait}
      <p class="folio" aria-hidden="true">i</p>
    {/if}
  </div>
{/snippet}

<dialog
  {@attach show}
  class={[portrait ? 'portrait' : 'landscape', { closing, removed, narrowed: cover && coverRatio }]}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    // Escape while correcting a detail or asking to remove it only drops that, and while
    // changing the cover or spine it goes up a level
    if (editing) stopEditing();
    else if (lookEditor) lookEditor.back();
    else if (confirmingRemove) confirmingRemove = false;
    else requestClose();
  }}
  onclick={onBackdropClick}
  onkeydown={onKeydown}
  style:--pw="{layout.pageWidth}px"
  style:--ph="{layout.pageHeight}px"
  style:--s={scale}
  style:--from-x="{from.x}px"
  style:--from-y="{from.y}px"
  style:--from-r="{from.r}deg"
  style:--from-sx={from.sx}
  style:--from-sy={from.sy}
  style:--cover-ratio={cover ? coverRatio : undefined}
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
>
  {#if portrait}
    <p class="announce" aria-live="polite">{pageAnnounced}</p>
  {/if}
  <div class="scene">
    <div class="book">
      <div class="board">
        <!-- a phone shows the spine strip on the cover from the start, so needs none under it -->
        {#if cover && coverRatio && !portrait}
          <div class="board-spine" aria-hidden="true">
            {#if spinePhoto}
              <img src={spinePhoto} alt="" />
            {/if}
          </div>
        {/if}
      </div>

      <div class="page page-2" inert={portrait && page === 1}>
        <div class="details">
          {#if !portrait}
            {@render closeButton()}
          {/if}
          <span class="ornament" aria-hidden="true">❦</span>
          {#if editing === 'series'}
            <!-- saved once the focus leaves both fields, not when it moves between them -->
            <p
              class="series series-edit"
              onfocusout={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) save();
              }}
            >
              <input
                {@attach focusEnd}
                class="edit"
                aria-label="Series"
                placeholder="Series, empty to leave it"
                autocomplete="off"
                disabled={saving}
                bind:value={draft}
                onkeydown={onEditKeydown}
              />
              <span aria-hidden="true">Book</span>
              <input
                class="edit number"
                aria-label="Number in the series"
                placeholder="№"
                inputmode="decimal"
                autocomplete="off"
                disabled={saving}
                bind:value={draftNumber}
                onkeydown={onEditKeydown}
              />
            </p>
          {:else if book.series}
            <p class="series">
              {#if canEdit}
                <button
                  type="button"
                  class="editable"
                  title="Click to correct the series"
                  onclick={() => startEditing('series')}
                >
                  {seriesLabel}
                </button>
              {:else}
                {seriesLabel}
              {/if}
            </p>
          {:else if canEdit}
            <p class="series">
              <button
                type="button"
                class="editable missing"
                onclick={() => startEditing('series')}
              >
                Add to a series
              </button>
            </p>
          {/if}
          <h2 id={titleId} tabindex="-1" bind:this={title}>
            {#if editing === 'title'}
              <input
                {@attach focusEnd}
                class="edit"
                aria-label="Title"
                autocomplete="off"
                disabled={saving}
                bind:value={draft}
                onkeydown={onEditKeydown}
                onblur={save}
              />
            {:else if !canEdit}
              {book.title}
            {:else}
              <button
                type="button"
                class="editable"
                title="Click to correct the title"
                onclick={() => startEditing('title')}
              >
                {book.title}
              </button>
            {/if}
          </h2>
          <p class="byline">
            {#if editing === 'author'}
              <input
                {@attach focusEnd}
                class="edit"
                aria-label="Author"
                placeholder="Separate several with commas"
                autocomplete="off"
                disabled={saving}
                bind:value={draft}
                onkeydown={onEditKeydown}
                onblur={save}
              />
            {:else if !canEdit}
              {book.author}
            {:else}
              <button
                type="button"
                class={['editable', { missing: !book.author }]}
                title="Click to correct the author"
                onclick={() => startEditing('author')}
              >
                {book.author || 'Add the author'}
              </button>
            {/if}
            {#if book.year}<span> · {book.year}</span>{/if}
          </p>
          <div class="rule" aria-hidden="true">
            <span></span>
            <span class="diamond">◆</span>
            <span></span>
          </div>
          {#if editError}
            <p class="edit-error" role="alert">{editError}</p>
          {/if}
          {#if editing === 'description'}
            <textarea
              {@attach focusEnd}
              class="edit description"
              aria-label="Description"
              placeholder="What is it about?"
              disabled={saving}
              bind:value={draft}
              onkeydown={onEditKeydown}
              onblur={save}
            ></textarea>
          {:else if !canEdit}
            {#if book.description}
              <div class="description">{book.description}</div>
            {/if}
          {:else if book.description}
            <!-- not a button, so the drop cap still takes the first letter -->
            <div
              class="description editable"
              role="button"
              tabindex="0"
              title="Click to correct the description"
              onclick={() => startEditing('description')}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  startEditing('description');
                }
              }}
            >
              {book.description}
            </div>
          {:else}
            <button
              type="button"
              class="editable missing add-description"
              onclick={() => startEditing('description')}
            >
              Add a description
            </button>
          {/if}
        </div>
        <p class="read-in">Last read in {reading.read.slice(0, 4)}</p>
        {#if portrait}
          <p class="folio" aria-hidden="true">ii</p>
        {/if}
      </div>

      {#if portrait}
        <!-- the first page on a loose leaf over the details, hinged at the spine like the cover -->
        <div class="flyleaf" inert={page === 2} {@attach leaf}>
          <div class="face recto">
            {@render firstPageContent()}
            {#if !busy}
              <button
                type="button"
                class="turn ear"
                aria-label="Turn to page ii"
                onclick={() => turnTo(2)}
                {...turnable}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 2.5 7.5 7 3 11.5" />
                </svg>
              </button>
              <button
                type="button"
                class="turn edge"
                aria-hidden="true"
                tabindex="-1"
                onclick={() => turnTo(2)}
                {...turnable}
              ></button>
            {/if}
            <span class="leaf-shade"></span>
          </div>
          <div class="face verso">
            <span class="leaf-shade"></span>
          </div>
        </div>

        {#if page === 2 && !busy}
          <!-- the turned leaf's edge, still showing at the side of the screen -->
          <button
            type="button"
            class="turn spine"
            aria-label="Back to page i"
            onclick={() => turnTo(1)}
            {...turnable}
          >
            <svg
              width="10"
              height="14"
              viewBox="0 0 10 14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M7 2.5 2.5 7 7 11.5" />
            </svg>
          </button>
        {/if}

        <!-- over the page's corner, above the leaf, so it stays put whichever page shows -->
        <div class="corner">{@render closeButton()}</div>
      {/if}

      <!-- the first page is on the inside of the cover, so it turns with it -->
      <div class="cover">
        <div class={['face front', { pictured: cover }]}>
          {#if cover}
            <img
              src={cover}
              alt=""
              onload={onCoverLoad}
              onerror={() => (brokenCover = cover)}
            />
          {:else}
            <span class="ornament" aria-hidden="true">❦</span>
            <span class="cover-title">{book.title}</span>
            <span class="cover-author">{book.author}</span>
          {/if}
          <span class="shade"></span>
        </div>
        {#if cover && coverRatio}
          <!-- the spine fills the bare board beside the picture once the cover lifts -->
          <div class="face strip" aria-hidden="true">
            {#if spinePhoto}
              <img src={spinePhoto} alt="" onerror={() => (brokenSpine = spinePhoto)} />
            {/if}
          </div>
        {/if}
        <div class="face back">
          {#if !portrait}
            {@render firstPageContent()}
          {/if}
        </div>
      </div>
    </div>
  </div>
</dialog>

<style>
  dialog {
    --paper: #f3ead6;
    --paper-ink: #2e2026;
    --paper-title: #2a1219;
    --paper-muted: #6b4a58;
    --paper-accent: #7a2f5f;
    --gutter-shade: rgb(70 38 24 / 0.32), rgb(70 38 24 / 0.1) 5%, rgb(70 38 24 / 0) 13%;
    --t: 2.4s;

    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    overflow: hidden;
    color: var(--paper-ink);
  }

  /* unsafe: a book taller than a short screen is shrunk around its middle, so its box centres too */
  dialog[open] {
    display: grid;
    place-content: unsafe center;
    place-items: center;
  }

  /* darkens while the book flies off the shelf, and lifts as it flies back */
  dialog::backdrop {
    background: rgb(7 4 5 / 0.8);
    animation: backdrop-in 0.7s ease-out;
  }

  dialog.closing::backdrop {
    opacity: 0;
    transition: opacity 0.45s ease-in-out 1.05s;
  }

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
  }

  /* the layout box keeps its full size; clicks around the book fall through to the backdrop */
  .scene {
    position: relative;
    flex: none;
    transform: scale(var(--s));
    perspective: 2200px;
    pointer-events: none;
  }

  .landscape .scene {
    width: calc(var(--pw) * 2);
    height: var(--ph);
  }

  .portrait .scene {
    width: var(--pw);
    height: var(--ph);
  }

  /* comes in once the cover has opened off it */
  .corner {
    position: absolute;
    top: 14px;
    right: 14px;
    transform: translateZ(3px);
    pointer-events: auto;
    animation: corner-in var(--t) both;
  }

  .corner .close {
    position: static;
  }

  @keyframes corner-in {
    0%,
    70% {
      opacity: 0;
    }
  }

  .announce {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .book {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    animation: var(--t) both;
  }

  .landscape .book {
    animation-name: book-landscape;
  }

  .portrait .book {
    animation-name: book-portrait;
  }

  .board,
  .cover,
  .page {
    position: absolute;
    pointer-events: auto;
  }

  /* back board under the second page; the front cover is the same size on its hinge */
  .board,
  .cover {
    width: calc(var(--pw) + 12px);
    height: calc(var(--ph) + 24px);
  }

  .board,
  .back {
    background:
      linear-gradient(135deg, rgb(255 255 255 / 0.06), rgb(0 0 0 / 0.3)),
      var(--c2);
    box-shadow:
      0 34px 70px rgb(0 0 0 / 0.75),
      0 0 60px -18px color-mix(in srgb, var(--light-a-2) 35%, transparent);
  }

  /* the spine: down the middle of a spread, down the left of a single page */
  .landscape {
    --spine: var(--pw);
  }

  .portrait {
    --spine: 0px;
  }

  .board,
  .cover {
    left: var(--spine);
    top: -12px;
  }

  .board {
    border-radius: 2px 8px 8px 2px;
  }

  .page {
    width: var(--pw);
    height: var(--ph);
  }

  .page {
    background-color: var(--paper);
  }

  .page-2 {
    left: var(--spine);
    top: 0;
    border-radius: 0 3px 3px 0;
    background-image: linear-gradient(90deg, var(--gutter-shade));
    box-shadow:
      1px 1px 0 #d6c9ab,
      2px 1px 0 #efe5cf,
      3px 2px 0 #d3c5a5,
      4px 2px 0 #ebdfc6,
      5px 3px 0 #cfc09e,
      6px 3px 0 #e6d9bc,
      7px 4px 0 #cabb97,
      8px 4px 0 #ddd0b0;
  }

  .landscape .page-1 {
    left: 12px;
    top: 12px;
    border-radius: 3px 0 0 3px;
    background-image: linear-gradient(270deg, var(--gutter-shade));
    box-shadow:
      -1px 1px 0 #d6c9ab,
      -2px 1px 0 #efe5cf,
      -3px 2px 0 #d3c5a5,
      -4px 2px 0 #ebdfc6,
      -5px 3px 0 #cfc09e,
      -6px 3px 0 #e6d9bc,
      -7px 4px 0 #cabb97,
      -8px 4px 0 #ddd0b0;
  }

  /* on a phone the first page is a leaf of its own over the details, turning on the same hinge */
  .flyleaf {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--pw);
    height: var(--ph);
    transform-origin: 0 50%;
    transform-style: preserve-3d;
    transform: translateZ(0.5px);
    pointer-events: auto;
  }

  .portrait .page-1 {
    left: 0;
    top: 0;
    border-radius: 0 3px 3px 0;
    background-image: linear-gradient(90deg, var(--gutter-shade));
  }

  .page-1:focus,
  h2:focus {
    outline: none;
  }

  .verso {
    transform: rotateY(180deg);
    border-radius: 3px 0 0 3px;
    background-color: #ebe0c8;
    background-image: linear-gradient(270deg, var(--gutter-shade));
  }

  .leaf-shade {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: #000;
    opacity: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  /* where a finger can turn the page; the 3D cover keeps its own drag and the text scrolls */
  .turn {
    position: absolute;
    z-index: 2;
    padding: 0;
    border: none;
    background: none;
    color: var(--paper-accent);
    cursor: pointer;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }

  .turn:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: -4px;
  }

  /* the folded corner, showing the back of the page and the page under it */
  .ear {
    right: 0;
    bottom: 0;
    width: 52px;
    height: 52px;
  }

  .ear::before,
  .ear::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 38px;
    height: 38px;
  }

  .ear::before {
    background: linear-gradient(to top left, #e6dbc2 0 50%, transparent 50%);
  }

  .ear::after {
    background: linear-gradient(
      to bottom right,
      #d9cba9 0%,
      #efe5d0 46%,
      #e2d5b8 50%,
      transparent 50%
    );
    filter: drop-shadow(1px 1px 1.5px rgb(60 30 20 / 0.35));
  }

  .ear svg {
    position: absolute;
    right: 24px;
    bottom: 24px;
    z-index: 1;
  }

  .edge {
    right: 0;
    top: 0;
    bottom: 52px;
    width: 26px;
  }

  /* over the turned leaf's edge, which lies just left of the details */
  .turn.spine {
    left: -22px;
    top: 0;
    width: 36px;
    height: var(--ph);
    display: grid;
    place-items: center;
    color: var(--paper-muted);
    transform: translateZ(3px);
    pointer-events: auto;
  }

  .turn.spine svg {
    margin-left: -14px;
  }

  /* page numbers, printed at the foot like a real book */
  .folio {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 16px;
    text-align: center;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.1em;
    color: var(--paper-muted);
  }

  /* the front cover swings open on its hinge and ends up holding the first page */
  .cover {
    transform-style: preserve-3d;
    animation: var(--t) both;
  }

  .cover {
    transform-origin: 0 50%;
    transform: translateZ(1px) rotateY(-180deg);
    animation-name: flip-y;
  }

  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* hidden backfaces still catch the pointer, so once turned it would sit over the 3D cover */
  .front {
    pointer-events: none;
    overflow: hidden;
    background: linear-gradient(135deg, var(--c1), var(--c2));
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--ph) * 0.11) calc(var(--pw) * 0.11);
    text-align: center;
  }

  .front::before {
    content: '';
    position: absolute;
    inset: 14px;
    border: 1px solid var(--book-accent);
    border-radius: 3px;
    opacity: 0.7;
  }

  /* hinge groove and a soft gloss, as on the 3D cover */
  .front::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        var(--hinge),
        rgb(0 0 0 / 0.35) 0,
        rgb(255 255 255 / 0.12) 3%,
        rgb(0 0 0 / 0) 7%
      ),
      linear-gradient(135deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 45%);
  }

  .front {
    --hinge: 90deg;
    border-radius: 2px 8px 8px 2px;
  }

  .front > span {
    position: relative;
  }

  .front .ornament {
    color: var(--book-accent);
    font-size: calc(var(--pw) * 0.077);
    line-height: 1;
  }

  .cover-title {
    font-family: var(--serif);
    font-weight: 700;
    font-size: calc(var(--pw) * 0.1);
    line-height: 1.12;
  }

  .cover-author {
    font-size: calc(var(--pw) * 0.045);
    opacity: 0.9;
  }

  /*
   * the board is shaped like a page, not a cover, so a picture narrows the front to its own shape
   * against the board's right edge, leaving this much of the board bare to its left; the back
   * keeps the page's shape for the first page
   */
  dialog {
    --cover-gap: calc(
      var(--pw) + 12px - min(var(--pw) + 12px, (var(--ph) + 24px) * var(--cover-ratio, 9))
    );
  }

  .front.pictured {
    width: calc(100% - var(--cover-gap));
    margin-left: auto;
    padding: 0;
  }

  /*
   * while the cover is shut, nothing shows beside the picture; the page and board under it sweep
   * in from its edge to the spine as it opens. A phone skips the sweeps and shows the spine strip
   * beside the picture from the start.
   */
  .narrowed.landscape .board,
  .narrowed.landscape .page-2 {
    /* where the picture starts, from the element's left edge (the portrait page is inset 12px) */
    --uncover-from: var(--cover-gap);
    animation: uncover var(--t) both;
  }

  .narrowed.landscape .page-2 {
    animation-name: uncover-page;
  }

  /* the spine again on the board, so lifting the cover shows the spine behind it, not a gap */
  .board-spine {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--cover-gap);
    overflow: hidden;
    background: linear-gradient(135deg, var(--c1), var(--c2));
    animation: board-spine var(--t) both;
  }

  .strip {
    width: var(--cover-gap);
    overflow: hidden;
    pointer-events: none;
    background: linear-gradient(135deg, var(--c1), var(--c2));
    animation: strip var(--t) both;
  }

  .strip,
  .board-spine {
    border-radius: 2px 0 0 2px;
  }

  .portrait .strip {
    animation: none;
  }

  .strip img,
  .board-spine img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* unrolls from the picture's edge to the spine, and rolls back up the same way on closing */
  @keyframes strip {
    0%,
    42% {
      clip-path: inset(0 0 0 100%);
      animation-timing-function: ease-in-out;
    }
    55%,
    100% {
      clip-path: inset(0);
    }
  }

  @keyframes uncover {
    0%,
    42% {
      clip-path: inset(-200px -200px -200px var(--uncover-from));
      animation-timing-function: ease-in-out;
    }
    58%,
    100% {
      clip-path: inset(-200px);
    }
  }

  /* the page waits until the cover has nearly stood up, while it still hides the band by the spine */
  @keyframes uncover-page {
    0%,
    57.5% {
      clip-path: inset(-200px -200px -200px var(--uncover-from));
      animation-timing-function: ease-in-out;
    }
    60%,
    100% {
      clip-path: inset(-200px);
    }
  }

  /* rolls up toward the spine just ahead of the page, so whatever paints on top, none is left */
  @keyframes board-spine {
    0%,
    57.5% {
      clip-path: inset(0);
      animation-timing-function: ease-in-out;
    }
    60%,
    100% {
      clip-path: inset(0 100% 0 0);
    }
  }

  .front.pictured::before {
    content: none;
  }

  .front img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* darkens the cover as it turns edge-on */
  .front > .shade {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: #000;
    opacity: 0;
    animation: shade var(--t) both;
  }

  .back {
    transform: rotateY(180deg);
    border-radius: 8px 2px 2px 8px;
  }

  /* nothing on the inside of a phone's cover to reach */
  .portrait .back {
    pointer-events: none;
  }

  .leaf {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    transition: opacity 0.2s;
  }

  /* the book steps back while it is asked whether to take it off the shelf */
  .leaf.asking {
    opacity: 0.55;
  }

  .hint {
    margin: 0;
    font-style: italic;
    font-size: 15px;
    color: var(--paper-muted);
  }

  /* ends above the read-in line; only the description scrolls */
  .details {
    position: absolute;
    inset: 0 0 76px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .landscape .details {
    padding: 64px 56px 0 64px;
  }

  .portrait .details {
    bottom: 68px;
    gap: 12px;
    padding: 36px 28px 0;
  }

  /* pinned to the page's corner, below the scrolling text */
  .read-in {
    position: absolute;
    right: 32px;
    bottom: 24px;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 12px;
    font-variant-numeric: lining-nums;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--paper-muted);
  }

  /* centred over the folio, like a colophon */
  .portrait .read-in {
    left: 0;
    right: 0;
    bottom: 40px;
    font-size: 11px;
    text-align: center;
  }

  .details .ornament {
    color: var(--paper-accent);
    font-size: 26px;
    line-height: 1;
  }

  h2 {
    margin: 0;
    padding-right: 32px;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 38px;
    line-height: 1.08;
    color: var(--paper-title);
  }

  .portrait h2 {
    font-size: 30px;
  }

  /* the series reads over the title, closer to it than the ornament */
  .series {
    margin-bottom: -10px;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 12px;
    font-variant-numeric: lining-nums;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--paper-accent);
  }

  .series-edit {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .series-edit .number {
    flex: none;
    width: 4em;
  }

  p {
    margin: 0;
  }

  .byline {
    font-family: var(--caps);
    font-weight: 600;
    font-size: 13px;
    font-variant-numeric: lining-nums;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--paper-muted);
  }

  .rule {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #a07a8c;
  }

  .rule span:not(.diamond) {
    flex: 1;
    height: 1px;
    background: currentColor;
  }

  .diamond {
    font-size: 12px;
  }

  .description {
    flex: 1;
    min-height: 4.8em;
    overflow-y: auto;
    margin-top: 10px;
    scrollbar-width: thin;
    font-size: 17px;
    line-height: 1.6;
  }

  .portrait .description {
    margin-top: 6px;
    font-size: 15px;
  }

  .description::first-letter {
    float: left;
    margin: 4px 8px 0 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 52px;
    line-height: 0.86;
    color: var(--paper-accent);
  }

  /* pinned to the bottom of the left page, level with the read-in line */
  .actions {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    text-align: center;
  }

  /* above the folio, clear of the folded corner */
  .portrait .actions {
    bottom: 42px;
    padding: 0 52px;
  }

  .remove-ask {
    font-style: italic;
    font-size: 15px;
    color: var(--paper-ink);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  /* gone from the shelf: the open book fades where it lies, and the room lights up again */
  dialog.removed .scene {
    animation: removed 0.5s ease-in both;
  }

  dialog.removed::backdrop {
    transition-delay: 0s;
  }

  @keyframes removed {
    to {
      opacity: 0;
      scale: 0.94;
    }
  }

  /* every detail reads as printed, and turns into a field with a single click */
  .editable {
    margin: 0 -6px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: none;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-align: left;
    text-transform: inherit;
    cursor: text;
    transition: background-color 0.15s;
  }

  .editable:hover {
    background: rgb(107 74 88 / 0.08);
  }

  .editable:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }

  .missing {
    font-style: italic;
    opacity: 0.7;
  }

  .add-description {
    align-self: flex-start;
    margin-top: 10px;
    font-size: 17px;
    font-variant: normal;
  }

  .edit {
    width: 100%;
    padding: 0 0 4px;
    border: none;
    border-bottom: 1px dashed var(--paper-accent);
    border-radius: 0;
    background: none;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  .edit:focus-visible {
    outline: none;
    border-bottom-style: solid;
  }

  .edit:disabled {
    opacity: 0.6;
  }

  .edit::placeholder {
    color: var(--paper-muted);
    font-style: italic;
    text-transform: none;
    letter-spacing: normal;
    opacity: 0.7;
  }

  textarea.edit {
    resize: none;
  }

  .edit-error {
    color: #a3243b;
    font-size: 14px;
  }

  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--paper-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close:hover {
    color: var(--paper-title);
    background: rgb(107 74 88 / 0.1);
  }

  .close:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }

  /* rise in, rest on the cover for a beat, then slide to centre as it opens */
  @keyframes book-landscape {
    0% {
      transform: translate(var(--from-x), var(--from-y)) rotate(var(--from-r))
        scale(var(--from-sx), var(--from-sy));
      animation-timing-function: cubic-bezier(0.45, 0, 0.25, 1);
    }
    30%,
    42% {
      transform: translate(calc(var(--pw) * -0.39 - 4.68px), 0) rotate(0) scale(0.78);
      animation-timing-function: cubic-bezier(0.5, 0, 0.25, 1);
    }
    85%,
    100% {
      transform: none;
    }
  }

  @keyframes book-portrait {
    0% {
      transform: translate(var(--from-x), var(--from-y)) rotate(var(--from-r))
        scale(var(--from-sx), var(--from-sy));
      animation-timing-function: cubic-bezier(0.45, 0, 0.25, 1);
    }
    30%,
    42% {
      transform: translate(-5.4px, 0) rotate(0) scale(0.9);
      animation-timing-function: cubic-bezier(0.5, 0, 0.25, 1);
    }
    85%,
    100% {
      transform: none;
    }
  }

  @keyframes flip-y {
    0%,
    42% {
      transform: translateZ(1px) rotateY(0);
      animation-timing-function: cubic-bezier(0.55, 0.05, 0.3, 1);
    }
    85%,
    100% {
      transform: translateZ(1px) rotateY(-180deg);
    }
  }

  @keyframes shade {
    0%,
    42% {
      opacity: 0;
    }
    63% {
      opacity: 0.45;
    }
    64%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .book,
    .cover,
    .shade,
    .strip,
    .board,
    .page-2,
    dialog.removed .scene {
      animation: none;
    }

    .board-spine {
      display: none;
    }

    dialog::backdrop,
    .corner {
      animation: none;
    }

    dialog.closing::backdrop {
      transition: none;
    }
  }
</style>
