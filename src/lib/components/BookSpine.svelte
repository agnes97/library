<script lang="ts">
  import { preloadCover } from '../covers';
  import type { Book } from '../types';

  type Props = {
    book: Book;
    width: number;
    height: number;
    /** tip back onto the book before it, standing this many px off it */
    lean?: number;
    /** lying on its side in a pile: `width` becomes its thickness, `height` its length */
    flat?: boolean;
    /** gets the spine, so the open book can fly out of it and back */
    onSelect: (spine: HTMLElement) => void;
  };

  let { book, width, height, lean, flat = false, onSelect }: Props = $props();

  /** a spine photo that failed to load, so the cloth one shows instead */
  let brokenPhoto = $state<string>();
  const photo = $derived(book.spineUrl !== brokenPhoto ? book.spineUrl : undefined);

  /** reaching for the book starts fetching its cover, so it is there by the time the book opens */
  function reach() {
    if (book.coverUrl) preloadCover(book.coverUrl);
  }
</script>

<button
  type="button"
  class={['spine', { lean: lean !== undefined, flat, photo }]}
  aria-label="{book.title} by {book.author}"
  style:--w="{width}px"
  style:--h="{height}px"
  style:--lean={lean === undefined ? undefined : `${lean}px`}
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
  style:--ink-shadow={book.colors.shadow}
  onpointerenter={reach}
  onpointerdown={reach}
  onfocus={reach}
  onclick={(event) => onSelect(event.currentTarget)}
>
  {#if photo}
    <img src={photo} alt="" draggable="false" onerror={() => (brokenPhoto = photo)} />
  {:else}
    <span class="band"></span>
    <span class="title">{book.title}</span>
    <span class="pip"></span>
  {/if}
</button>

<style>
  .spine {
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: var(--w);
    height: var(--h);
    padding: 18px 0;
    border: 0;
    border-radius: 2px 2px 1px 1px;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    background:
      linear-gradient(
        90deg,
        rgb(0 0 0 / 0.55),
        rgb(255 255 255 / 0.07) 20%,
        rgb(0 0 0 / 0.08) 55%,
        rgb(0 0 0 / 0.6)
      ),
      linear-gradient(180deg, var(--c1), var(--c2));
    transition:
      translate 0.6s cubic-bezier(0.22, 0.9, 0.3, 1),
      box-shadow 0.6s;
  }

  .spine:hover {
    translate: 0 -16px;
    box-shadow:
      0 0 0 1px var(--light-a-2),
      0 0 34px -6px var(--light-a-2);
  }

  .spine:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    translate: 0 -16px;
  }

  /* pivots on its bottom left corner, so it stays whole above the shelf */
  .lean {
    rotate: -9deg;
    transform-origin: bottom left;
    margin-left: var(--lean);
  }

  .flat {
    flex-direction: row;
    width: var(--h);
    height: var(--w);
    padding: 0 18px;
    border-radius: 1px 2px 2px 1px;
    background:
      linear-gradient(
        180deg,
        rgb(255 255 255 / 0.07),
        rgb(0 0 0 / 0.08) 45%,
        rgb(0 0 0 / 0.6)
      ),
      linear-gradient(90deg, var(--c1), var(--c2));
  }

  /* slide out of the pile instead of lifting into the book above */
  .flat:hover,
  .flat:focus-visible {
    translate: 16px 0;
  }

  .flat .band {
    width: 3px;
    height: 100%;
    box-shadow:
      5px 0 0 -1px var(--c2),
      7px 0 0 -1px var(--book-accent);
  }

  .flat .title {
    writing-mode: horizontal-tb;
    max-width: calc(var(--h) - 96px);
    max-height: none;
  }

  .band {
    display: block;
    width: 100%;
    height: 3px;
    background: var(--book-accent);
    opacity: 0.75;
    box-shadow:
      0 5px 0 -1px var(--c2),
      0 7px 0 -1px var(--book-accent);
  }

  .title {
    writing-mode: vertical-rl;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: calc(var(--h) - 96px);
    text-shadow: 0 1px 2px var(--ink-shadow, rgb(0 0 0 / 0.7));
  }

  .pip {
    display: block;
    width: 7px;
    height: 7px;
    rotate: 45deg;
    border: 1px solid var(--book-accent);
    opacity: 0.8;
  }

  /* a photo of the real spine, rounded by the same light as the cloth */
  .photo {
    overflow: hidden;
    background: var(--c2);
  }

  .photo img {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--w);
    height: var(--h);
    translate: -50% -50%;
  }

  /* lies with its top to the left, so the title reads along the pile */
  .photo.flat img {
    rotate: -90deg;
  }

  .photo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgb(0 0 0 / 0.35),
      rgb(255 255 255 / 0.06) 20%,
      transparent 55%,
      rgb(0 0 0 / 0.4)
    );
  }

  .photo.flat::after {
    background: linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent 45%, rgb(0 0 0 / 0.4));
  }

  @media (prefers-reduced-motion: reduce) {
    .spine {
      transition: none;
    }
  }
</style>
