<script lang="ts">
  type Props = {
    year: number;
    /** hang from the right edge of the book instead of its left */
    flip?: boolean;
  };

  let { year, flip = false }: Props = $props();
</script>

<div class={['tag', { flip }]}>
  {#each ['left', 'right'] as side (side)}
    <span class="chain {side}" aria-hidden="true">
      <span class="ring"></span>
      {#each [0, 1, 2] as link (link)}
        <span class="bar"></span>
        <span class="link"></span>
      {/each}
      <span class="bar"></span>
    </span>
  {/each}

  <div class="frame">
    <div class="plate">
      <span class="rivet left" aria-hidden="true"></span>
      {year}
      <span class="rivet right" aria-hidden="true"></span>
    </div>
  </div>
</div>

<style>
  /* polished brass, hanging on two chains from the shelf above */
  .tag {
    position: absolute;
    z-index: 3;
    top: 30px;
    left: 0;
    pointer-events: none;
    filter: drop-shadow(0 6px 6px rgb(0 0 0 / 0.85));
  }

  .flip {
    left: auto;
    right: 0;
  }

  .chain {
    position: absolute;
    top: -34px;
    width: 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .chain.left {
    left: 16px;
  }

  .chain.right {
    right: 16px;
  }

  .ring {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 2px solid #d9b45a;
  }

  .bar {
    width: 2px;
    height: 9px;
    margin-top: -2px;
    border-radius: 1px;
    background: #b8913f;
  }

  .link {
    width: 6px;
    height: 9px;
    margin-top: -2px;
    border-radius: 50%;
    border: 2px solid #c9a24a;
  }

  .frame {
    position: relative;
    padding: 3px;
    clip-path: polygon(
      8px 0,
      calc(100% - 8px) 0,
      100% 8px,
      100% calc(100% - 8px),
      calc(100% - 8px) 100%,
      8px 100%,
      0 calc(100% - 8px),
      0 8px
    );
    background: linear-gradient(
      180deg,
      #fff0b3 0%,
      #d9b14f 18%,
      #9b7426 52%,
      #c99f43 78%,
      #5e4313 100%
    );
  }

  .plate {
    position: relative;
    padding: 10px 40px 10px 44px;
    clip-path: polygon(
      6px 0,
      calc(100% - 6px) 0,
      100% 6px,
      100% calc(100% - 6px),
      calc(100% - 6px) 100%,
      6px 100%,
      0 calc(100% - 6px),
      0 6px
    );
    background:
      repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px),
      linear-gradient(172deg, #ecd084 0%, #c69c42 42%, #a77d2b 68%, #d4ae58 100%);
    font-family: var(--caps);
    font-weight: 700;
    font-size: 19px;
    font-variant-numeric: lining-nums;
    line-height: 1;
    letter-spacing: 0.16em;
    white-space: nowrap;
    color: #2b1d06;
    text-shadow:
      0 1px 0 rgb(255 236 170 / 0.75),
      0 -1px 0 rgb(0 0 0 / 0.35);
  }

  .rivet {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    margin-top: -4px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff4c8, #c99f43 45%, #4a340c);
    box-shadow: 0 1px 1px rgb(0 0 0 / 0.5);
  }

  .rivet.left {
    left: 13px;
  }

  .rivet.right {
    right: 13px;
  }
</style>
