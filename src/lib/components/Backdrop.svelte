<!--
  The castle room behind (and the fog in front of) the page content. It also defines the
  #grainH and #grainV wood filters the bookcase uses.
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

<svg class="wall" aria-hidden="true">
  <defs>
    <pattern id="blocks" width="330" height="176" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="108" height="42" rx="3" fill="#1d1618" />
      <rect x="110" y="0" width="108" height="42" rx="3" fill="#1b1416" />
      <rect x="220" y="0" width="108" height="42" rx="3" fill="#1e1719" />
      <rect x="-55" y="44" width="108" height="42" rx="3" fill="#1a1415" />
      <rect x="55" y="44" width="108" height="42" rx="3" fill="#1d1618" />
      <rect x="165" y="44" width="108" height="42" rx="3" fill="#1c1517" />
      <rect x="275" y="44" width="108" height="42" rx="3" fill="#1a1415" />
      <rect x="-90" y="88" width="108" height="42" rx="3" fill="#1c1517" />
      <rect x="20" y="88" width="108" height="42" rx="3" fill="#1b1416" />
      <rect x="130" y="88" width="108" height="42" rx="3" fill="#1e1719" />
      <rect x="240" y="88" width="108" height="42" rx="3" fill="#1c1517" />
      <rect x="-35" y="132" width="108" height="42" rx="3" fill="#1b1517" />
      <rect x="75" y="132" width="108" height="42" rx="3" fill="#1d1618" />
      <rect x="185" y="132" width="108" height="42" rx="3" fill="#1a1415" />
      <rect x="295" y="132" width="108" height="42" rx="3" fill="#1b1517" />
    </pattern>
    <filter id="stone" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="soft" />
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="7" result="grit" />
      <feColorMatrix
        in="grit"
        type="matrix"
        values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.47  0 0 0 0.09 0"
        result="gritA"
      />
      <feComposite in="gritA" in2="soft" operator="in" result="gritIn" />
      <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="2" result="blot" />
      <feColorMatrix
        in="blot"
        type="matrix"
        values="0 0 0 0 0.03  0 0 0 0 0.015  0 0 0 0 0.025  -1.3 0 0 0 0.85"
        result="blotA"
      />
      <feMerge>
        <feMergeNode in="soft" />
        <feMergeNode in="gritIn" />
        <feMergeNode in="blotA" />
      </feMerge>
    </filter>
    <!-- wood grain running along (H) or across (V) a board -->
    <filter id="grainH" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.42" numOctaves="3" seed="4" result="n" />
      <feColorMatrix
        in="n"
        type="matrix"
        values="0 0 0 0 0.02  0 0 0 0 0.01  0 0 0 0 0  -2 0 0 0 1.12"
        result="dark"
      />
      <feComposite in="dark" in2="SourceGraphic" operator="in" result="darkIn" />
      <feColorMatrix
        in="n"
        type="matrix"
        values="0 0 0 0 0.78  0 0 0 0 0.55  0 0 0 0 0.38  1.4 0 0 0 -0.78"
        result="light"
      />
      <feComposite in="light" in2="SourceGraphic" operator="in" result="lightIn" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="lightIn" />
        <feMergeNode in="darkIn" />
      </feMerge>
    </filter>
    <filter id="grainV" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.42 0.006" numOctaves="3" seed="9" result="n" />
      <feColorMatrix
        in="n"
        type="matrix"
        values="0 0 0 0 0.02  0 0 0 0 0.01  0 0 0 0 0  -2 0 0 0 1.12"
        result="dark"
      />
      <feComposite in="dark" in2="SourceGraphic" operator="in" result="darkIn" />
      <feColorMatrix
        in="n"
        type="matrix"
        values="0 0 0 0 0.78  0 0 0 0 0.55  0 0 0 0 0.38  1.4 0 0 0 -0.8"
        result="light"
      />
      <feComposite in="light" in2="SourceGraphic" operator="in" result="lightIn" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="lightIn" />
        <feMergeNode in="darkIn" />
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#blocks)" filter="url(#stone)" />
</svg>
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

  .wall {
    width: 100%;
    height: 100%;
  }

  .haze {
    background:
      radial-gradient(ellipse 70% 30% at 50% 0%, rgb(92 44 84 / 0.22), transparent 70%),
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
    background: #f7c9e6;
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
      radial-gradient(ellipse 40% 50% at 25% 100%, rgb(150 90 160 / 0.16), transparent 70%),
      radial-gradient(ellipse 45% 55% at 75% 100%, rgb(200 90 150 / 0.13), transparent 70%),
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
