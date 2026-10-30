<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconName } from './Icon.svelte';

  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    /** plain, the one choice that finishes, the one that destroys, or bare text */
    kind?: 'plain' | 'primary' | 'danger' | 'ghost';
    icon?: IconName;
    /** a column of choices, filling its width and reading from the left */
    wide?: boolean;
    /** the words; left out, only the icon shows and `aria-label` names the button */
    children?: Snippet;
  };

  let { kind = 'plain', icon, wide = false, children, ...rest }: Props = $props();
</script>

<!-- a rounded button on the open book's paper pages -->
<button type="button" class={['pill', kind, { wide, round: !children }]} {...rest}>
  {#if icon}<Icon name={icon} size={wide ? 16 : 18} />{/if}
  {@render children?.()}
</button>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 44px;
    box-sizing: border-box;
    padding: 0 16px;
    border: 1px solid rgb(107 74 88 / 0.35);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.3);
    color: var(--paper-muted);
    font-family: var(--caps);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  .pill:hover:not(:disabled) {
    background: rgb(107 74 88 / 0.1);
    color: var(--paper-title);
  }

  .round {
    width: 44px;
    padding: 0;
  }

  .wide {
    justify-content: flex-start;
    width: 100%;
    padding: 0 12px;
    gap: 6px;
    font-size: 10.5px;
    letter-spacing: 0.05em;
  }

  .ghost {
    border-color: transparent;
    background: none;
    padding: 0 12px 0 8px;
  }

  .primary {
    border-color: var(--paper-accent);
    background: var(--paper-accent);
    color: #f8efe0;
  }

  .primary:hover:not(:disabled) {
    background: #63244c;
    color: #f8efe0;
  }

  .danger {
    border-color: #a3243b;
    background: #a3243b;
    color: #fff7ec;
  }

  .danger:hover:not(:disabled) {
    background: #8a1c31;
    color: #fff7ec;
  }

  .pill:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* the choice the book already wears, which there is no point making again */
  .pill[aria-pressed='true']:disabled {
    border-color: var(--paper-accent);
    color: var(--paper-accent);
    opacity: 1;
    cursor: default;
  }

  .pill:focus-visible {
    outline: 2px solid var(--paper-accent);
    outline-offset: 2px;
  }
</style>
