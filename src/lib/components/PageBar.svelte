<script lang="ts">
  import Pill from './Pill.svelte';

  type Props = {
    title: string;
    /** going up a level throws work away, so the way out says Cancel rather than Back */
    cancel?: boolean;
    disabled?: boolean;
    onBack: () => void;
  };

  let { title, cancel = false, disabled = false, onBack }: Props = $props();
</script>

<div class="bar">
  <Pill kind="ghost" icon={cancel ? 'cancel' : 'back'} {disabled} onclick={onBack}>
    {cancel ? 'Cancel' : 'Back'}
  </Pill>
  <p class="title">{title}</p>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: stretch;
  }

  /* centred on the page, clear of the button on its left */
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding-right: 88px;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 26px;
    line-height: 1.1;
    text-align: center;
    color: var(--paper-title);
  }

  @media (width < 700px) {
    .title {
      padding-right: 0;
      font-size: 21px;
      text-align: right;
    }
  }
</style>
