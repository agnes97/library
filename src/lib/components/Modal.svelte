<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    open: boolean;
    title: string;
    children: Snippet;
  };

  let { open = $bindable(), title, children }: Props = $props();

  const titleId = $props.id();

  /** each corner's ornament is the top-left one turned to face its own corner */
  const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

  function sync(dialog: HTMLDialogElement) {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }

  // the page stays put behind an open modal; the gutter keeps the shelves from shifting
  $effect(() => {
    if (!open) return;
    const root = document.documentElement;
    const { overflow, scrollbarGutter } = root.style;
    root.style.overflow = 'hidden';
    root.style.scrollbarGutter = 'stable';
    return () => {
      root.style.overflow = overflow;
      root.style.scrollbarGutter = scrollbarGutter;
    };
  });

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) open = false;
  }
</script>

<dialog
  {@attach sync}
  onclose={() => (open = false)}
  onclick={onBackdropClick}
  aria-labelledby={titleId}
>
  {#each corners as corner (corner)}
    <svg
      class="corner {corner}"
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M3 30 V10 Q3 3 10 3 H30" />
      <path d="M8 22 V14 Q8 8 14 8 H22" stroke-width="0.8" />
      <path d="M13 9.5 L16.5 13 L13 16.5 L9.5 13 Z" />
      <circle cx="13" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M30 3 Q35 3 35 7 Q35 10 32 10" />
      <path d="M3 30 Q3 35 7 35 Q10 35 10 32" />
      <circle cx="40" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="40" r="1" fill="currentColor" stroke="none" />
    </svg>
  {/each}

  <div class="content">
    <header>
      <h2 id={titleId}>{title}</h2>
      <button
        type="button"
        class="close"
        aria-label="Close"
        onclick={() => (open = false)}
      >
        ×
      </button>
    </header>

    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-radius: 4px;
    background: var(--surface-raised);
    color: var(--text);
    /* one size for every popup, so they read as a set */
    width: min(600px, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    box-shadow:
      0 24px 60px rgb(0 0 0 / 0.7),
      0 0 40px -12px color-mix(in srgb, var(--light-a-2) 35%, transparent);
  }

  dialog::backdrop {
    background: rgb(7 4 5 / 0.72);
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open] {
      animation: dialog-in 0.22s ease-out;
    }

    dialog[open]::backdrop {
      animation: backdrop-in 0.22s ease-out;
    }
  }

  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
  }

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
  }

  .content {
    padding: 2.5rem 3rem 3rem;
  }

  @media (max-width: 480px) {
    .content {
      padding: 2.25rem 1.75rem 2.25rem;
    }
  }

  /* left corners take the right torch's light, right corners the left's */
  .corner {
    position: absolute;
    pointer-events: none;
    color: color-mix(in srgb, var(--light-b-2) 70%, var(--accent));
    filter: drop-shadow(0 0 4px var(--light-b-glow));
    opacity: 0.85;
  }

  .corner.top-right,
  .corner.bottom-right {
    color: color-mix(in srgb, var(--light-a-2) 70%, var(--accent));
    filter: drop-shadow(0 0 4px var(--light-a-glow));
  }

  .top-left {
    top: 4px;
    left: 4px;
  }

  .top-right {
    top: 4px;
    right: 4px;
    transform: scaleX(-1);
  }

  .bottom-right {
    right: 4px;
    bottom: 4px;
    transform: scale(-1);
  }

  .bottom-left {
    bottom: 4px;
    left: 4px;
    transform: scaleY(-1);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: 1.75rem;
    line-height: 1.15;
  }

  .close {
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    color: var(--text);
  }

  .close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
