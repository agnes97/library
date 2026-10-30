<script lang="ts">
  import { auth } from '../auth.svelte';

  type Props = {
    onSuccess: () => void;
  };

  let { onSuccess }: Props = $props();

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);

  const isEmailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const isPasswordValid = $derived(password.length >= 8);
  const isValid = $derived(isEmailValid && isPasswordValid);

  async function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isValid) return;

    isSubmitting = true;

    try {
      await auth.login({ email, password });
      password = '';
      onSuccess();
    } catch {
      // auth.error holds the message
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form {onsubmit} novalidate>
  <label>
    <span>Email</span>
    <input type="email" autocomplete="email" bind:value={email} required />
    {#if email && !isEmailValid}
      <small>Must be an email</small>
    {/if}
  </label>

  <label>
    <span>Password</span>
    <input
      type="password"
      autocomplete="current-password"
      bind:value={password}
      required
    />
    {#if password && !isPasswordValid}
      <small>Must be at least 8 characters</small>
    {/if}
  </label>

  {#if auth.error}
    <p class="error" role="alert">{auth.error}</p>
  {/if}

  <button type="submit" disabled={!isValid || isSubmitting}>
    {isSubmitting ? 'Logging in…' : 'Login'}
  </button>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* underlined like the fields of the add-a-book form */
  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  span {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  input {
    padding: 0.125rem 0 0.375rem;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 1.125rem;
    transition: border-color 0.15s;
  }

  input:focus-visible {
    outline: none;
    border-bottom-color: var(--accent);
    box-shadow: 0 1px 0 var(--accent);
  }

  small,
  .error {
    color: var(--danger);
    font-size: 0.8125rem;
  }

  .error {
    margin: 0;
  }

  button {
    margin-top: 0.5rem;
    padding: 0.625rem;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
