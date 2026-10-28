<script lang="ts">
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import type { Book } from '../types';
  import BookCover3D from './BookCover3D.svelte';

  type Props = {
    book: Book;
    /** the day it was read, as an ISO date */
    read: string;
    /** the shelf spine the book flies out of and back into */
    spine: HTMLElement;
    onClose: () => void;
  };

  let { book, read, spine, onClose }: Props = $props();

  const titleId = $props.id();

  /** wide screens open the book sideways, narrow ones flip the cover up */
  const LANDSCAPE = { pageWidth: 440, pageHeight: 580, coverHeight: 300 };
  const PORTRAIT = { pageWidth: 340, pageHeight: 360, coverHeight: 210 };
  /** leather and page edges sticking out past the pages */
  const OVERHANG = 20;
  const GUTTER = 32;
  /** closing replays the opening backwards, this much faster */
  const CLOSE_RATE = 1.6;

  const portrait = $derived((innerWidth.current ?? 1024) < 700);
  const layout = $derived(portrait ? PORTRAIT : LANDSCAPE);

  // shrink the whole book until it fits the window
  const scale = $derived.by(() => {
    const { pageWidth, pageHeight } = layout;
    const width = (portrait ? pageWidth : pageWidth * 2) + OVERHANG * 2;
    const height = (portrait ? pageHeight * 2 : pageHeight) + OVERHANG * 2;
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
        ? { x: 0, y: ph * -0.39 - 4.68, r: 0, sx: 0.78, sy: 0.78 }
        : { x: pw * -0.39 - 4.68, y: 0, r: 0, sx: 0.78, sy: 0.78 };
    }

    // the closed cover's size and how far its centre sits from the book's centre
    const coverWidth = portrait ? pw + 24 : pw + 12;
    const coverHeight = portrait ? ph + 12 : ph + 24;
    const offsetX = portrait ? 0 : pw / 2 + 6;
    const offsetY = portrait ? ph / 2 + 6 : 0;

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
    const cy = sy * offsetY;
    return { x: dx - (cx * cos - cy * sin), y: dy - (cx * sin + cy * cos), r, sx, sy };
  });

  let closing = $state(false);
  let dialog: HTMLDialogElement;

  /** Plays every opening animation backwards from wherever it is, then closes. */
  async function requestClose() {
    if (closing) return;
    closing = true;
    // the spine has slid back into the shelf since it was clicked
    origin = measure();

    const animations = dialog
      .getAnimations({ subtree: true })
      // the backdrop keeps its own timing
      .filter(
        (animation) =>
          animation instanceof CSSAnimation &&
          !(animation.effect as KeyframeEffect | null)?.pseudoElement
      );
    for (const animation of animations) {
      animation.reverse();
      animation.updatePlaybackRate(-CLOSE_RATE);
    }
    await Promise.allSettled(animations.map((animation) => animation.finished));
    onClose();
  }

  function show(node: HTMLDialogElement) {
    dialog = node;
    origin = measure();
    node.showModal();

    // the page stays put behind the open book; the gutter keeps the shelves from shifting
    const root = document.documentElement;
    const { overflow, scrollbarGutter } = root.style;
    root.style.overflow = 'hidden';
    root.style.scrollbarGutter = 'stable';
    return () => {
      root.style.overflow = overflow;
      root.style.scrollbarGutter = scrollbarGutter;
    };
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) requestClose();
  }
</script>

<dialog
  {@attach show}
  class={[portrait ? 'portrait' : 'landscape', { closing }]}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    requestClose();
  }}
  onclick={onBackdropClick}
  style:--pw="{layout.pageWidth}px"
  style:--ph="{layout.pageHeight}px"
  style:--s={scale}
  style:--from-x="{from.x}px"
  style:--from-y="{from.y}px"
  style:--from-r="{from.r}deg"
  style:--from-sx={from.sx}
  style:--from-sy={from.sy}
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
>
  <div class="scene">
    <div class="book">
      <div class="board"></div>

      <div class="page page-2">
        <div class="details">
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
          <span class="ornament" aria-hidden="true">❦</span>
          <h2 id={titleId}>{book.title}</h2>
          <p class="byline">{book.author} · {book.year}</p>
          <div class="rule" aria-hidden="true">
            <span></span>
            <span class="diamond">◆</span>
            <span></span>
          </div>
          <p class="description">{book.description}</p>
        </div>
        <p class="read-in">Last read in {read.slice(0, 4)}</p>
      </div>

      <!-- the first page is on the inside of the cover, so it turns with it -->
      <div class="cover">
        <div class="face front">
          <span class="ornament" aria-hidden="true">❦</span>
          <span class="cover-title">{book.title}</span>
          <span class="cover-author">{book.author}</span>
          <span class="shade"></span>
        </div>
        <div class="face back">
          <div class="page page-1">
            <div class="leaf">
              <BookCover3D {book} height={layout.coverHeight} />
              <p class="hint">Drag the cover to turn it</p>
            </div>
          </div>
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

  dialog[open] {
    display: grid;
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
    height: calc(var(--ph) * 2);
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
      0 0 60px -18px rgb(232 111 181 / 0.35);
  }

  .landscape .board,
  .landscape .cover {
    left: var(--pw);
    top: -12px;
  }

  .portrait .board,
  .portrait .cover {
    left: -12px;
    top: var(--ph);
    width: calc(var(--pw) + 24px);
    height: calc(var(--ph) + 12px);
  }

  .landscape .board {
    border-radius: 2px 8px 8px 2px;
  }

  .portrait .board {
    border-radius: 2px 2px 8px 8px;
  }

  .page {
    width: var(--pw);
    height: var(--ph);
  }

  .page {
    background-color: var(--paper);
  }

  .landscape .page-2 {
    left: var(--pw);
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

  .portrait .page-2 {
    left: 0;
    top: var(--ph);
    border-radius: 0 0 3px 3px;
    background-image: linear-gradient(180deg, var(--gutter-shade));
    box-shadow:
      1px 1px 0 #d6c9ab,
      1px 2px 0 #efe5cf,
      2px 3px 0 #d3c5a5,
      2px 4px 0 #ebdfc6,
      3px 5px 0 #cfc09e,
      3px 6px 0 #e6d9bc,
      4px 7px 0 #cabb97,
      4px 8px 0 #ddd0b0;
  }

  .portrait .page-1 {
    left: 12px;
    top: 12px;
    border-radius: 3px 3px 0 0;
    background-image: linear-gradient(0deg, var(--gutter-shade));
    box-shadow:
      1px -1px 0 #d6c9ab,
      1px -2px 0 #efe5cf,
      2px -3px 0 #d3c5a5,
      2px -4px 0 #ebdfc6,
      3px -5px 0 #cfc09e,
      3px -6px 0 #e6d9bc,
      4px -7px 0 #cabb97,
      4px -8px 0 #ddd0b0;
  }

  /* the front cover swings open on its hinge and ends up holding the first page */
  .cover {
    transform-style: preserve-3d;
    animation: var(--t) both;
  }

  .landscape .cover {
    transform-origin: 0 50%;
    transform: translateZ(1px) rotateY(-180deg);
    animation-name: flip-y;
  }

  .portrait .cover {
    transform-origin: 50% 0;
    transform: translateZ(1px) rotateX(180deg);
    animation-name: flip-x;
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

  .landscape .front {
    --hinge: 90deg;
    border-radius: 2px 8px 8px 2px;
  }

  .portrait .front {
    --hinge: 180deg;
    border-radius: 2px 2px 8px 8px;
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

  /* darkens the cover as it turns edge-on */
  .front > .shade {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: #000;
    opacity: 0;
    animation: shade var(--t) both;
  }

  .landscape .back {
    transform: rotateY(180deg);
    border-radius: 8px 2px 2px 8px;
  }

  .portrait .back {
    transform: rotateX(180deg);
    border-radius: 8px 8px 2px 2px;
  }

  .leaf {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
  }

  .hint {
    margin: 0;
    font-style: italic;
    font-size: 15px;
    color: var(--paper-muted);
  }

  .details {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .landscape .details {
    padding: 64px 56px 72px 64px;
  }

  .portrait .details {
    gap: 12px;
    padding: 36px 28px 52px;
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

  .portrait .read-in {
    right: 24px;
    bottom: 18px;
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
    font-size: 19px;
    line-height: 1.6;
  }

  .portrait .description {
    font-size: 17px;
  }

  .description::first-letter {
    float: left;
    margin: 4px 8px 0 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 58px;
    line-height: 0.86;
    color: var(--paper-accent);
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
      transform: translate(0, calc(var(--ph) * -0.39 - 4.68px)) rotate(0) scale(0.78);
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

  @keyframes flip-x {
    0%,
    42% {
      transform: translateZ(1px) rotateX(0);
      animation-timing-function: cubic-bezier(0.55, 0.05, 0.3, 1);
    }
    85%,
    100% {
      transform: translateZ(1px) rotateX(180deg);
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
    .shade {
      animation: none;
    }

    dialog::backdrop {
      animation: none;
    }

    dialog.closing::backdrop {
      transition: none;
    }
  }
</style>
