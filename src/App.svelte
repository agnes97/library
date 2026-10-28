<script lang="ts">
  import { shelves } from './lib/books';
  import type { Book } from './lib/types';
  import BookDetail from './lib/components/BookDetail.svelte';
  import Bookshelf from './lib/components/Bookshelf.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';

  let isLoginOpen = $state(false);
  let selected = $state.raw<Book | null>(null);

  function select(book: Book) {
    selected = book;
  }
</script>

<Header onLoginClick={() => (isLoginOpen = true)} />

<main>
  <p class="hint">
    Hover a spine to pull the book off the shelf. Click it to open it.
  </p>

  <div class="shelves">
    {#each shelves as shelf (shelf[0].key)}
      <Bookshelf books={shelf} onSelect={select} />
    {/each}
  </div>
</main>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

{#if selected}
  <Modal
    title={selected.title}
    width="600px"
    bind:open={
      () => selected !== null,
      (open) => {
        if (!open) selected = null;
      }
    }
  >
    <BookDetail book={selected} />
  </Modal>
{/if}

<style>
  main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 1rem 1.5rem 4rem;
  }

  .hint {
    margin: 0 0 1rem;
    color: var(--text-muted);
  }

  .shelves {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
