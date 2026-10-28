<script lang="ts">
  import type { Book } from '../types';

  type Props = {
    book: Book;
    width: number;
    height: number;
    lean?: boolean;
    /** lying on its side in a pile: `width` becomes its thickness, `height` its length */
    flat?: boolean;
    onSelect: (book: Book) => void;
  };

  let { book, width, height, lean = false, flat = false, onSelect }: Props = $props();
</script>

<button
  type="button"
  class={['spine', { lean, flat }]}
  aria-label="{book.title} by {book.author}"
  style:--w="{width}px"
  style:--h="{height}px"
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
  onclick={() => onSelect(book)}
>
  <span class="band"></span>
  <span class="title">{book.title}</span>
  <span class="pip"></span>
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
      0 0 0 1px var(--book-accent),
      0 0 34px -6px var(--book-accent);
  }

  .spine:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    translate: 0 -16px;
  }

  .lean {
    rotate: 9deg;
    transform-origin: bottom left;
    margin-left: 22px;
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
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.7);
  }

  .pip {
    display: block;
    width: 7px;
    height: 7px;
    rotate: 45deg;
    border: 1px solid var(--book-accent);
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .spine {
      transition: none;
    }
  }
</style>
