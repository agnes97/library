<script lang="ts">
  import { ai } from '../ai.svelte';

  let key = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const isKeyValid = $derived(/^sk-[\w-]{20,}$/.test(key.trim()));

  async function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isKeyValid || busy) return;

    busy = true;
    error = null;
    try {
      await ai.connect('openai', key.trim());
      key = '';
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Connecting failed, try again';
    } finally {
      busy = false;
    }
  }

  async function disconnect() {
    busy = true;
    error = null;
    try {
      await ai.disconnect('openai');
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Disconnecting failed, try again';
    } finally {
      busy = false;
    }
  }
</script>

<div class="connection">
  {#if ai.keys.openai}
    <p class="status">
      <span class="dot" aria-hidden="true"></span>
      Connected with the key ending <code>…{ai.keys.openai.hint}</code>
    </p>
    <p class="lead">
      Open a book, then <em>Spine photo</em>, and crop its spine out of a photo. ChatGPT draws a
      sharp one from the crop. Each spine is charged to your OpenAI account, usually a few cents,
      and no more than 10 drawings run in ten minutes, or 60 in a day.
    </p>
    <p class="note">
      To stop it, disconnect here, or revoke the key on
      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
        platform.openai.com/api-keys</a
      >.
    </p>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button type="button" class="secondary" disabled={busy} onclick={disconnect}>
      {busy ? 'Disconnecting…' : 'Disconnect'}
    </button>
  {:else}
    <p class="lead">
      ChatGPT can draw a sharp, straight spine that joins the cover from a photo of a book you
      crop. It runs on your own OpenAI API key, which you get like this:
    </p>

    <ol class="steps">
      <li>
        Sign in at
        <a href="https://platform.openai.com" target="_blank" rel="noreferrer">platform.openai.com</a>
        with your ChatGPT account. The API is billed separately: a ChatGPT Plus subscription doesn’t
        cover it.
      </li>
      <li>
        Under
        <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noreferrer"
          >Settings → Billing</a
        >, add a small amount of credit, say $5, and leave <em>auto recharge</em> off. That credit
        is the most the key can ever spend, whatever happens to it. A spine usually costs a few
        cents.
      </li>
      <li>
        Open
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">API keys</a>
        and choose <em>Create new secret key</em>. Name it “Library” and leave its permissions at
        <em>All</em>.
      </li>
      <li>Copy the key, which starts with <code>sk-</code>. It is shown only once. Paste it below.</li>
    </ol>

    <form {onsubmit} novalidate>
      <label>
        <span>OpenAI API key</span>
        <input
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="sk-…"
          bind:value={key}
          required
        />
        {#if key && !isKeyValid}
          <small>An OpenAI key starts with sk-</small>
        {/if}
      </label>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <button type="submit" disabled={!isKeyValid || busy}>
        {busy ? 'Checking the key…' : 'Connect'}
      </button>
    </form>

    <p class="note">
      The key is kept encrypted on the library’s server and never shown again, not even to you. It
      is used only when you, logged in, search for or draw a spine, and only a few times a minute.
      You can revoke it on OpenAI’s API keys page at any time.
    </p>
  {/if}
</div>

<style>
  .connection {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  p {
    margin: 0;
  }

  .lead {
    line-height: 1.5;
  }

  .note {
    font-size: 0.875rem;
    font-style: italic;
    line-height: 1.5;
    color: var(--text-muted);
  }

  a {
    color: var(--text-accent);
  }

  a:hover {
    color: var(--accent-hover);
  }

  code {
    font-size: 0.9em;
    color: var(--text-accent);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 1.125rem;
  }

  .dot {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }

  .steps li {
    position: relative;
    padding-left: 2.25rem;
    line-height: 1.5;
    counter-increment: step;
  }

  /* numbered in the menu's capitals, like the steps of an old manual */
  .steps li::before {
    content: counter(step, upper-roman);
    position: absolute;
    left: 0;
    top: 0.1em;
    width: 1.5rem;
    font-family: var(--caps);
    font-weight: 600;
    font-size: 0.8125rem;
    color: var(--accent);
    text-align: right;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* underlined like the login form's fields */
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

  button {
    padding: 0.625rem;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .secondary {
    border: 1px solid var(--border);
    background: none;
    color: var(--text);
  }

  .secondary:hover {
    border-color: var(--accent);
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
