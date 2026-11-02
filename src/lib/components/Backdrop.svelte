<!--
  The castle room behind (and the fog in front of) the page content.
-->
<script lang="ts">
  const motes = [
    { left: '12%', top: '34%', delay: '0s' },
    { left: '16%', top: '28%', delay: '3.2s' },
    { left: '85%', top: '32%', delay: '1.4s' },
    { left: '80%', top: '24%', delay: '5.6s' },
    { left: '46%', top: '86%', delay: '7.1s' },
  ];
</script>

<div class="wall" aria-hidden="true"></div>
<div class="haze" aria-hidden="true"></div>

{#each motes as mote, i (i)}
  <span
    class="mote"
    aria-hidden="true"
    style:left={mote.left}
    style:top={mote.top}
    style:animation-delay={mote.delay}
  ></span>
{/each}

<div class="fog" aria-hidden="true"></div>
<div class="vignette" aria-hidden="true"></div>

<style>
  .wall,
  .haze {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  /* a tile drawn once, not a filter run over the whole page on every change to its height */
  .wall {
    background: url('../../assets/stone.svg') 0 0 / 990px 704px;
  }

  .haze {
    background:
      radial-gradient(ellipse 70% 30% at 50% 0%, color-mix(in srgb, var(--light-a-3) 22%, transparent), transparent 70%),
      linear-gradient(
        180deg,
        rgb(7 4 5 / 0.55) 0%,
        rgb(7 4 5 / 0.25) 30%,
        rgb(7 4 5 / 0.35) 70%,
        rgb(7 4 5 / 0.9) 100%
      );
  }

  .mote {
    position: absolute;
    z-index: 3;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--light-a-1);
    box-shadow: 0 0 8px var(--accent);
    opacity: 0;
    pointer-events: none;
  }

  .fog {
    position: absolute;
    left: -10%;
    right: -10%;
    bottom: -40px;
    height: 420px;
    z-index: 4;
    pointer-events: none;
    background:
      radial-gradient(ellipse 40% 50% at 25% 100%, color-mix(in srgb, var(--light-b-2) 16%, transparent), transparent 70%),
      radial-gradient(ellipse 45% 55% at 75% 100%, color-mix(in srgb, var(--light-a-2) 13%, transparent), transparent 70%),
      linear-gradient(0deg, rgb(7 4 5 / 0.95), transparent 60%);
  }

  .vignette {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background: radial-gradient(
      ellipse 85% 75% at 50% 45%,
      transparent 55%,
      rgb(0 0 0 / 0.75)
    );
  }

  @media (prefers-reduced-motion: no-preference) {
    .mote {
      animation: float 9s linear infinite;
    }

    .fog {
      animation: drift 14s ease-in-out infinite alternate;
    }
  }

  @keyframes float {
    0% {
      opacity: 0;
      translate: 0 0;
    }
    15% {
      opacity: 0.7;
    }
    100% {
      opacity: 0;
      translate: 30px -260px;
    }
  }

  @keyframes drift {
    from {
      translate: -3% 0;
    }
    to {
      translate: 3% 0;
    }
  }
</style>
