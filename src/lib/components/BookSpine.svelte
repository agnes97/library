<script lang="ts">
  import type { Book } from '../types';

  type Props = {
    book: Book;
    onSelect: (book: Book) => void;
  };

  let { book, onSelect }: Props = $props();
</script>

<!--
  The button itself ignores the pointer; only its ::after plate (fixed where the spine rests)
  receives hover and clicks. A pulled-out book therefore never covers its neighbours.
-->
<button
  type="button"
  class="slot"
  aria-label="{book.title} by {book.author}"
  style:--w="{book.width}px"
  style:--h="{book.height}px"
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
  onclick={() => onSelect(book)}
>
  <span class="book" aria-hidden="true">
    <span class="face spine"><span class="spine-title">{book.title}</span></span>
    <span class="face cover">
      <span class="cover-inner">
        <span class="ornament">❦</span>
        <span class="title">{book.title}</span>
        <span class="author">{book.author}</span>
      </span>
    </span>
    <span class="face backcover"></span>
    <span class="face back"></span>
    <span class="face top"></span>
    <span class="face bottom"></span>
  </span>
</button>

<style>
  .slot {
    --d: var(--depth, 180px);
    position: relative;
    display: block;
    flex: none;
    width: var(--w);
    height: var(--h);
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    transform-style: preserve-3d;
    pointer-events: none;
    outline: none;
  }

  .slot::after {
    content: '';
    position: absolute;
    left: -3px;
    top: 0;
    width: calc(var(--w) + 6px);
    height: var(--h);
    transform: translateZ(calc(var(--d) / 2));
    pointer-events: auto;
    cursor: pointer;
    border-radius: 2px;
  }

  .slot:focus-visible::after {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .book {
    position: relative;
    display: block;
    width: var(--w);
    height: var(--h);
    transform-style: preserve-3d;
    transition: transform 0.7s cubic-bezier(0.22, 0.9, 0.3, 1);
    pointer-events: none;
  }

  .slot:hover .book,
  .slot:focus-visible .book {
    transform: translateZ(170px) translateY(-14px) rotateY(-90deg);
  }

  .face {
    position: absolute;
    display: block;
    backface-visibility: hidden;
  }

  /* spine: faces the viewer at rest */
  .spine {
    width: var(--w);
    height: var(--h);
    transform: translateZ(calc(var(--d) / 2));
    background:
      linear-gradient(
        90deg,
        rgb(0 0 0 / 0.28),
        rgb(255 255 255 / 0.12) 18%,
        rgb(0 0 0 / 0.05) 60%,
        rgb(0 0 0 / 0.3)
      ),
      var(--c1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
  }

  .spine::before,
  .spine::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 5px;
    background: var(--book-accent);
    opacity: 0.85;
  }

  .spine::before {
    top: 20px;
  }

  .spine::after {
    bottom: 20px;
  }

  .spine-title {
    writing-mode: vertical-rl;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.04em;
    color: var(--ink);
    white-space: nowrap;
    max-height: calc(var(--h) - 62px);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* front cover: on the right side, turns to face the viewer on hover */
  .cover,
  .backcover {
    width: var(--d);
    height: var(--h);
    left: calc((var(--w) - var(--d)) / 2);
  }

  .cover {
    transform: rotateY(90deg) translateZ(calc(var(--w) / 2));
    background:
      linear-gradient(
        135deg,
        rgb(255 255 255 / 0.18),
        rgb(255 255 255 / 0) 40%,
        rgb(0 0 0 / 0.25)
      ),
      linear-gradient(180deg, var(--c1), var(--c2));
    border-radius: 2px 5px 5px 2px;
    box-shadow: inset 8px 0 10px -6px rgb(0 0 0 / 0.45);
  }

  .cover-inner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 26px 18px;
    text-align: center;
    color: var(--ink);
  }

  .cover-inner::before {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1.5px solid var(--book-accent);
    border-radius: 3px;
    opacity: 0.7;
  }

  .ornament {
    font-size: 26px;
    color: var(--book-accent);
    line-height: 1;
  }

  .title {
    font-family: var(--serif);
    font-weight: 700;
    font-size: 20px;
    line-height: 1.15;
  }

  .author {
    font-size: 12px;
    opacity: 0.9;
  }

  .backcover {
    transform: rotateY(-90deg) translateZ(calc(var(--w) / 2));
    background: var(--c2);
  }

  .back {
    width: var(--w);
    height: var(--h);
    transform: translateZ(calc(var(--d) / -2)) rotateY(180deg);
    background: var(--c2);
  }

  .top,
  .bottom {
    width: var(--w);
    height: var(--d);
    top: calc((var(--h) - var(--d)) / 2);
    background: #efe5d2;
    background-image: repeating-linear-gradient(
      90deg,
      rgb(0 0 0 / 0.08) 0 1px,
      transparent 1px 4px
    );
  }

  .top {
    transform: rotateX(90deg) translateZ(calc(var(--h) / 2));
  }

  .bottom {
    transform: rotateX(-90deg) translateZ(calc(var(--h) / 2));
    background: #3a2a1d;
  }

  @media (prefers-reduced-motion: reduce) {
    .book {
      transition-duration: 0.01s;
    }
  }
</style>
