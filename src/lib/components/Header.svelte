<script lang="ts">
  import { auth } from '../auth.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();
</script>

<header>
  <h1>Library</h1>

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
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 1080px;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 0;
  }

  h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2.25rem;
    letter-spacing: -0.01em;
    line-height: 1;
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
    padding: 0.5rem 1.125rem;
    border: none;
    border-radius: 0;
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background: #f6d18a;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  @media (max-width: 560px) {
    .user span {
      display: none;
    }
  }
</style>
