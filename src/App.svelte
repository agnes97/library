<script lang="ts">
  import { tick } from 'svelte';
  import { ai, providers } from './lib/ai.svelte';
  import { auth } from './lib/auth.svelte';
  import { shelfDecor } from './lib/books';
  import { library, SAMPLES_QUERY } from './lib/library.svelte';
  import { spineJob } from './lib/spineJob';
  import type { AiProvider, ShelfBook } from './lib/types';
  import AddBookForm from './lib/components/AddBookForm.svelte';
  import Backdrop from './lib/components/Backdrop.svelte';
  import Bookcase from './lib/components/Bookcase.svelte';
  import ChatGptConnection from './lib/components/ChatGptConnection.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';
  import OpenBook from './lib/components/OpenBook.svelte';

  let isLoginOpen = $state(false);
  let isAddOpen = $state(false);
  let isAiOpen = $state(false);
  /** the AI service whose key the open popup connects */
  let aiProvider = $state<AiProvider>('openai');
  const aiLabel = $derived(providers.find(({ id }) => id === aiProvider)?.label ?? 'AI');

  function openAi(provider: AiProvider) {
    aiProvider = provider;
    isAiOpen = true;
  }
  /**
   * visitors not logged in see a few sample books, as do readers who ask for them; nothing shows
   * while the login is checked
   */
  const sampling = $derived(auth.status === 'unauthenticated' || library.showingSamples);
  const readings = $derived(sampling ? library.samples : library.readings);
  let selected = $state.raw<{ reading: ShelfBook; spine: HTMLElement } | null>(null);
  /**
   * the query param that keeps a book open through a reload, by its reading's key, as when the
   * browser drops a tab left in the background: `?book=…`
   */
  const BOOK_QUERY = 'book';
  /** the book open before the page reloaded, until it opens again or turns out to be gone */
  let reopening = $state(new URLSearchParams(location.search).get(BOOK_QUERY));
  /** the shelves are as they will stay, so a book not on them isn't coming */
  const shelved = $derived(sampling || (auth.isAuthenticated && library.status !== 'loading'));
  /**
   * the open book as it is now on the shelves, so a correction shows at once; one just removed
   * stays open as it was while it fades away
   */
  const openReading = $derived(
    selected &&
      (readings.find(({ key }) => key === selected?.reading.key) ?? selected.reading)
  );

  // the shelves, and the AI that draws their spines, are only for those logged in
  $effect(() => {
    if (auth.isAuthenticated) {
      library.load();
      ai.load();
    } else {
      library.clear();
      ai.clear();
    }
  });

  // the address says when the samples are showing and which book is open, so a reload keeps them
  $effect(() => {
    const url = new URL(location.href);
    const [key, value] = SAMPLES_QUERY;
    if (library.showingSamples) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    const open = selected?.reading.key ?? reopening;
    if (open) url.searchParams.set(BOOK_QUERY, open);
    else url.searchParams.delete(BOOK_QUERY);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  });

  // the book open before a reload flies out of its spine again once the shelves hold it
  $effect(() => {
    const key = reopening;
    if (!key) return;
    const reading = readings.find((item) => item.key === key);
    if (reading) {
      tick().then(() => {
        reopening = null;
        const spine = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
        if (spine && !selected) select(reading, spine);
      });
    } else if (shelved) {
      reopening = null;
      // and a drawing for it has nothing left to show in
      spineJob.forget();
    }
  });

  /** a load lost to a dropped connection is tried again once the reader is back */
  function retry() {
    if (auth.isAuthenticated && document.visibilityState === 'visible') library.retry();
  }

  $effect(() => {
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  });

  function select(reading: ShelfBook, spine: HTMLElement) {
    selected = { reading, spine };
  }
</script>

<div class="room">
  <Backdrop />

  <div class="outer">
    <Header onLoginClick={() => (isLoginOpen = true)} onAiClick={openAi} />

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
        {readings}
        label={sampling ? 'Sample shelves' : undefined}
        onBack={auth.isAuthenticated && library.showingSamples ? () => (library.showingSamples = false) : undefined}
        ownReadings={auth.isAuthenticated ? library.readings : undefined}
        {shelfDecor}
        onSelect={select}
        onAdd={auth.isAuthenticated && !sampling ? () => (isAddOpen = true) : undefined}
      />
    </main>
  </div>

  <footer>© <span class="years">2022 - {new Date().getFullYear()}</span> Jana Mácová</footer>
</div>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

<Modal bind:open={isAddOpen} title="Add a book you've read">
  <!-- mounted only while open, so every visit starts with an empty search -->
  {#if isAddOpen}
    <AddBookForm onDone={() => (isAddOpen = false)} />
  {/if}
</Modal>

<Modal bind:open={isAiOpen} title={aiLabel}>
  {#if aiProvider === 'openai'}
    <ChatGptConnection />
  {/if}
</Modal>

{#if selected && openReading}
  <OpenBook
    reading={openReading}
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
