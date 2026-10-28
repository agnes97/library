<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    open: boolean;
    title: string;
    width?: string;
    children: Snippet;
  };

  let { open = $bindable(), title, width = '400px', children }: Props = $props();

  const titleId = $props.id();

  function sync(dialog: HTMLDialogElement) {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) open = false;
  }
</script>

<dialog
  {@attach sync}
  onclose={() => (open = false)}
  onclick={onBackdropClick}
  aria-labelledby={titleId}
  style:--modal-width={width}
>
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
    border: none;
    border-radius: 4px;
    background: var(--surface-raised);
    color: var(--text);
    width: min(var(--modal-width), calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    box-shadow: 0 24px 60px rgb(0 0 0 / 0.55);
  }

  dialog::backdrop {
    background: rgb(10 6 4 / 0.62);
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
    padding: 1.5rem;
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
    font-size: 1.5rem;
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
