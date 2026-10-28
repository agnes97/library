<script lang="ts">
  import { auth } from '../auth.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();
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
      <path d="M53 21 C47 20 42 21 37 23 M53 28 C47 27 42 28 37 30 M53 35 C47 34 42 35 37 37" />
      <path d="M44 41 V58 L47.5 55 L51 58 V40.5" />
    </svg>
    <div>
      <p class="eyebrow">Bibliotheca</p>
      <h1>Library</h1>
    </div>
  </div>

  {#if auth.isAuthenticated && auth.user}
    <div class="user">
      <span>Logged in as <strong>{auth.user.name}</strong></span>
      <button type="button" onclick={() => auth.logout()}>Logout</button>
    </div>
  {:else if auth.status === 'unauthenticated'}
    <button type="button" onclick={onLoginClick}>Login</button>
  {/if}
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
    color: var(--accent);
    filter: drop-shadow(0 0 10px rgb(232 111 181 / 0.45));
  }

  .eyebrow {
    margin: 0 0 4px;
    font-family: var(--caps);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    color: #b9a2c4;
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
      0 0 28px rgb(232 111 181 / 0.28),
      0 2px 0 #000;
  }

  .user {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: var(--text-muted);
  }

  strong {
    color: var(--text);
  }

  button {
    min-height: 44px;
    padding: 0 26px;
    border: 1px solid rgb(240 166 212 / 0.55);
    background: rgb(20 10 16 / 0.6);
    color: #f3c4e2;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      box-shadow 0.4s,
      border-color 0.4s,
      color 0.4s;
  }

  button:hover {
    border-color: var(--accent);
    color: #ffe4f4;
    box-shadow:
      0 0 24px -4px rgb(232 111 181 / 0.55),
      inset 0 0 18px -8px rgb(232 111 181 / 0.6);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  @media (max-width: 560px) {
    .user span {
      display: none;
    }
  }
</style>
