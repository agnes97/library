<script lang="ts">
  import { auth } from './lib/auth.svelte';
  import { shelfDecor } from './lib/books';
  import { library } from './lib/library.svelte';
  import type { Book } from './lib/types';
  import AddBookForm from './lib/components/AddBookForm.svelte';
  import Backdrop from './lib/components/Backdrop.svelte';
  import Bookcase from './lib/components/Bookcase.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';
  import OpenBook from './lib/components/OpenBook.svelte';

  let isLoginOpen = $state(false);
  let isAddOpen = $state(false);
  let selected = $state.raw<{ book: Book; read: string; spine: HTMLElement } | null>(null);

  // the shelves are only for those logged in
  $effect(() => {
    if (auth.isAuthenticated) library.load();
    else library.clear();
  });

  function select(book: Book, read: string, spine: HTMLElement) {
    selected = { book, read, spine };
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
        Scroll, hover, click: let the pages flick.
      </p>

      <Bookcase
        readings={library.readings}
        {shelfDecor}
        onSelect={select}
        onAdd={auth.isAuthenticated ? () => (isAddOpen = true) : undefined}
      />
    </main>
  </div>

  <footer>© <span class="years">2022 - {new Date().getFullYear()}</span> Jana Mácová</footer>
</div>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

<Modal bind:open={isAddOpen} title="Add a book you've read" width="640px">
  <!-- mounted only while open, so every visit starts with an empty search -->
  {#if isAddOpen}
    <AddBookForm onDone={() => (isAddOpen = false)} />
  {/if}
</Modal>

{#if selected}
  <OpenBook
    book={selected.book}
    read={selected.read}
    spine={selected.spine}
    onClose={() => (selected = null)}
  />
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
    padding: 44px 24px 0;
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
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--light-a-2) 45%, transparent));
  }

  .line:last-child {
    background: linear-gradient(90deg, color-mix(in srgb, var(--light-b-2) 45%, transparent), transparent);
  }

  .hint {
    margin: 0 auto 44px;
    text-align: center;
    font-style: italic;
    font-size: 19px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  /* outside .outer so it sits above the backdrop's fog and vignette */
  footer {
    --nudge: 2rem;
    position: relative;
    z-index: 6;
    max-width: 1060px;
    margin: 0 auto;
    padding: 56px calc(24px + var(--nudge)) 28px 24px;
    text-align: right;
    font-style: italic;
    font-size: 19px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  /* IM Fell only has old-style figures */
  .years {
    font-family: var(--serif);
    font-weight: 600;
    font-variant-numeric: lining-nums;
  }

  @media (max-width: 1340px) {
    .outer {
      padding-left: 110px;
      padding-right: 110px;
    }

    footer {
      padding-left: 110px;
      padding-right: calc(110px + var(--nudge));
    }
  }

  @media (max-width: 760px) {
    .outer {
      padding: 28px 16px 20px;
    }

    footer {
      padding: 56px calc(16px + var(--nudge)) 20px 16px;
    }
  }
</style>
