<script lang="ts">
  import type { AiProvider } from '../types';
  import AccountMenu from './AccountMenu.svelte';

  type Props = {
    onLoginClick: () => void;
    onAiClick: (provider: AiProvider) => void;
  };

  let { onLoginClick, onAiClick }: Props = $props();
</script>

<header>
  <div class="brand">
    <svg
      width="56"
      height="56"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M32 18 C24 12 14 11 5 13 V48 C14 46 24 47 32 53 C40 47 50 46 59 48 V13 C50 11 40 12 32 18 Z" />
      <path d="M32 18 V53" />
      <path
        d="M11 21 C17 20 22 21 27 23 M11 28 C17 27 22 28 27 30 M11 35 C17 34 22 35 27 37 M11 42 C17 41 22 42 27 44"
      />
      <path
        d="M53 21 C47 20 42 21 37 23 M53 28 C47 27 42 28 37 30 M53 35 C47 34 42 35 37 37 M53 42 C47 41 42 42 37 44"
      />
      <!-- the ribbon hangs out from under the right page's bottom edge -->
      <path class="ribbon" d="M44 47.8 V60 L46.5 57.5 L49 60 V47.3" />
    </svg>
    <div>
      <p class="eyebrow">Bibliotheca</p>
      <h1>Library</h1>
    </div>
  </div>

  <AccountMenu {onLoginClick} {onAiClick} />
</header>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 0 4px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  svg {
    flex: none;
    /* from light a, so it trades places with the ribbon when the theme is swapped */
    color: color-mix(in srgb, var(--light-a-2) 55%, var(--light-a-1));
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--light-a-2) 45%, transparent));
  }

  .ribbon {
    stroke: var(--light-b-2);
  }

  .eyebrow {
    margin: 0 0 4px;
    font-family: var(--caps);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--light-b-1) 35%, var(--text-muted));
  }

  h1 {
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 54px;
    line-height: 1;
    letter-spacing: 0.02em;
    color: #efe2ea;
    text-shadow:
      0 0 28px color-mix(in srgb, var(--light-a-2) 28%, transparent),
      0 2px 0 #000;
  }
</style>
