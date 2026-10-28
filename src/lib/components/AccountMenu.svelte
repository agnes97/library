<script lang="ts">
  import { tick } from 'svelte';
  import { auth } from '../auth.svelte';
  import { theme, themes } from '../theme.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement>();
  let trigger = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();

  const user = $derived(auth.isAuthenticated ? auth.user : null);
  // a stored token is still being checked; don't flash the guest state meanwhile
  const pending = $derived(auth.status === 'initializing' || auth.status === 'loading');
  const shortName = $derived(user ? 'Reader' : 'Guest');
  const initials = $derived(
    user?.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() ?? ''
  );

  function items() {
    return [...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
  }

  async function show() {
    open = true;
    await tick();
    (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
  }

  function hide(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function onMenuKeydown(event: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;

    if (event.key === 'ArrowDown') next = (index + 1) % list.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else if (event.key === 'Escape') hide();
    else if (event.key === 'Tab') hide(false);
    else return;

    event.preventDefault();
    if (next !== null) list[next]?.focus();
  }

  function onDocumentPointerDown(event: PointerEvent) {
    if (open && !root?.contains(event.target as Node)) hide(false);
  }

  function login() {
    hide(false);
    onLoginClick();
  }

  function logout() {
    hide();
    auth.logout();
  }
</script>

<svelte:document onpointerdown={onDocumentPointerDown} />

<div class="account" bind:this={root}>
  <button
    type="button"
    class="trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="account-menu"
    bind:this={trigger}
    onclick={() => (open ? hide(false) : show())}
  >
    <span class="name" class:pending>{shortName}</span>
    <span class="avatar" aria-hidden="true">
      {#if pending}
        <!-- blank until the user is known -->
      {:else if user}
        {initials}
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4.5" />
          <path d="M3.5 21.5c0-4.8 3.8-8 8.5-8s8.5 3.2 8.5 8z" />
        </svg>
      {/if}
    </span>
  </button>

  {#if open}
    <div
      id="account-menu"
      class="menu"
      role="menu"
      aria-label="Account"
      tabindex="-1"
      bind:this={menu}
      onkeydown={onMenuKeydown}
    >
      {#if user}
        <div class="who">
          <p class="who-label">Signed in as</p>
          <p class="who-name">{user.name}</p>
        </div>
      {/if}

      <p class="group" id="theme-label">Torchlight</p>

      <div role="group" aria-labelledby="theme-label">
        {#each themes as t (t.id)}
          {@const [first, second] =
            theme.current === t.id && theme.swapped ? [t.colors[1], t.colors[0]] : t.colors}
          <button
            type="button"
            class="item theme"
            role="menuitemradio"
            aria-checked={theme.current === t.id}
            onclick={() => theme.set(t.id)}
          >
            <span class="swatch" aria-hidden="true">
              <span style:background={first} style:--glow={first}></span>
              {#if second !== first}
                <span style:background={second} style:--glow={second}></span>
              {/if}
            </span>
            <span class="label">{t.label}</span>
            {#if theme.current === t.id}
              {#if second !== first}
                <!-- clicking the chosen theme again swaps its colours -->
                <svg
                  class="swap"
                  width="28"
                  height="22"
                  viewBox="0 0 26 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12h8M7 8.5l3.5 3.5L7 15.5" />
                  <path d="M24 12h-8M19 8.5L15.5 12l3.5 3.5" />
                </svg>
              {/if}
              <svg
                class="check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            {/if}
          </button>
        {/each}
      </div>

      {#if user || auth.status === 'unauthenticated'}
        <div class="separator" role="separator"></div>
      {/if}

      {#if user}
        <button type="button" class="item action" role="menuitem" onclick={logout}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 8l-4 4 4 4" />
            <path d="M6 12h10" />
          </svg>
          Logout
        </button>
      {:else if auth.status === 'unauthenticated'}
        <button type="button" class="item action" role="menuitem" onclick={login}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="M14 8l4 4-4 4" />
            <path d="M18 12H8" />
          </svg>
          Login
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account {
    position: relative;
    z-index: 10;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 0 8px 0 16px;
    border: 1px solid color-mix(in srgb, var(--light-a-2) 55%, transparent);
    background: rgb(20 10 16 / 0.6);
    color: color-mix(in srgb, var(--light-a-1) 65%, var(--light-a-2));
    font-family: var(--caps);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      box-shadow 0.4s,
      border-color 0.4s,
      background-color 0.4s,
      color 0.4s;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    border-color: var(--light-a-2);
    background: rgb(40 18 32 / 0.8);
    color: var(--light-a-1);
    box-shadow:
      0 0 24px -4px color-mix(in srgb, var(--light-a-2) 55%, transparent),
      inset 0 0 18px -8px color-mix(in srgb, var(--light-a-2) 60%, transparent);
  }

  .trigger:focus-visible {
    outline: 2px solid var(--light-a-2);
    outline-offset: 4px;
  }

  .name.pending {
    visibility: hidden;
  }

  .avatar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: var(--light-b-2);
    color: var(--on-accent);
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  .menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 300px;
    max-width: calc(100vw - 32px);
    padding: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow:
      0 24px 60px -12px rgb(0 0 0 / 0.8),
      0 0 40px -16px var(--light-a-glow);
  }

  .menu > div[role='group'] {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .who {
    margin-bottom: 6px;
    padding: 10px 12px 12px;
    border-bottom: 1px solid #3a2934;
  }

  .who p {
    margin: 0;
  }

  .who-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .who-name {
    margin-top: 2px;
    font-size: 17px;
    color: var(--text);
  }

  .group {
    margin: 6px 12px;
    font-family: var(--caps);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: #d6c6d0;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 0.2s,
      box-shadow 0.2s,
      color 0.2s;
  }

  .item:hover,
  .item:focus-visible {
    background: color-mix(in srgb, var(--light-a-2) 14%, transparent);
    color: #fff4fa;
  }

  .item:focus-visible {
    outline: 2px solid var(--light-a-2);
    outline-offset: -2px;
  }

  .theme {
    font-family: inherit;
    font-size: 16px;
  }

  .theme[aria-checked='true'] {
    background: color-mix(in srgb, var(--light-a-2) 17%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--light-a-2) 60%, transparent);
    color: #fff;
  }

  .theme[aria-checked='true']:hover {
    background: color-mix(in srgb, var(--light-a-2) 25%, transparent);
  }

  .swatch {
    position: relative;
    flex: none;
    width: 34px;
    height: 20px;
  }

  .swatch > span {
    position: absolute;
    top: 0;
    left: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    box-shadow: 0 0 10px -2px var(--glow);
  }

  .swatch > span + span {
    left: 13px;
    box-shadow:
      0 0 0 2px #140a10,
      0 0 10px -2px var(--glow);
  }

  .label {
    flex: 1;
  }

  .check {
    color: var(--light-a-2);
  }

  .swap {
    flex: none;
    color: var(--light-b-2);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .theme:hover .swap,
  .theme:focus-visible .swap {
    opacity: 1;
  }

  .separator {
    height: 1px;
    margin: 6px 4px;
    background: #3a2934;
  }

  .action {
    font-family: var(--caps);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  @media (max-width: 560px) {
    /* stays readable to screen readers as the button's name */
    .name {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .trigger {
      padding: 0 8px;
    }
  }
</style>
