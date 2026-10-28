<script lang="ts">
  import type { Book } from '../types';
  import BookCover3D from './BookCover3D.svelte';

  type Props = {
    book: Book;
  };

  let { book }: Props = $props();
</script>

<div class="detail">
  <div class="cover">
    <BookCover3D {book} />
  </div>

  <div class="text">
    <p class="byline">{book.author}, {book.year}</p>
    <p class="description">{book.description}</p>
  </div>
</div>

<style>
  .detail {
    display: flex;
    align-items: flex-start;
    gap: 40px;
  }

  .cover {
    flex: none;
    padding: 8px 12px 16px;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  p {
    margin: 0;
  }

  .byline {
    color: var(--text-muted);
  }

  .description {
    font-size: 1.0625rem;
    line-height: 1.55;
  }

  @media (max-width: 560px) {
    .detail {
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
  }
</style>
