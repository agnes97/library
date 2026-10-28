<script lang="ts">
  import { shelves } from './lib/books';
  import type { Book } from './lib/types';
  import Backdrop from './lib/components/Backdrop.svelte';
  import BookDetail from './lib/components/BookDetail.svelte';
  import Bookcase from './lib/components/Bookcase.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';

  let isLoginOpen = $state(false);
  let selected = $state.raw<Book | null>(null);

  function select(book: Book) {
    selected = book;
  }
</script>

<div class="room">
  <Backdrop />

  <div class="outer">
    <Header onLoginClick={() => (isLoginOpen = true)} />

    <main>
      <div class="divider" aria-hidden="true">
        <span class="line"></span>
        <svg width="40" height="14" viewBox="0 0 40 14" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M20 1 L26 7 L20 13 L14 7 Z" />
          <path d="M2 7 H12 M28 7 H38" />
          <circle cx="20" cy="7" r="1.6" fill="currentColor" />
        </svg>
        <span class="line"></span>
      </div>

      <p class="hint">
        Scroll the case to bring another shelf into the torchlight. Hover a spine to draw a volume
        from it; click to open it.
      </p>

      <Bookcase {shelves} onSelect={select} />
    </main>
  </div>
</div>

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
  .room {
    position: relative;
    min-height: 100vh;
    overflow: clip;
    background-color: var(--bg);
  }

  .outer {
    position: relative;
    z-index: 2;
    max-width: 1060px;
    margin: 0 auto;
    padding: 44px 24px 120px;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 18px;
    max-width: 640px;
    margin: 40px auto 30px;
    color: var(--accent);
  }

  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgb(240 166 212 / 0.45));
  }

  .line:last-child {
    background: linear-gradient(90deg, rgb(180 107 255 / 0.45), transparent);
  }

  .hint {
    margin: 0 auto 44px;
    text-align: center;
    font-style: italic;
    font-size: 19px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  @media (max-width: 1340px) {
    .outer {
      padding-left: 110px;
      padding-right: 110px;
    }
  }

  @media (max-width: 760px) {
    .outer {
      padding: 28px 16px 80px;
    }
  }
</style>
