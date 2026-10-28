<script lang="ts">
  import type { Attachment } from 'svelte/attachments';

  type Props = {
    onclick: () => void;
  };

  let { onclick }: Props = $props();

  type Bat = {
    id: number;
    /** where the flock burst from, in viewport coordinates */
    x: number;
    y: number;
    start: number;
    life: number;
    width: number;
    angle: number;
    dist: number;
    lean: number;
    amp: number;
    freq: number;
    phase: number;
    /** which of the theme's two lights rims its wings */
    rim: 'a' | 'b';
  };

  type Shock = { id: number; x: number; y: number; start: number };

  const COUNT = 32;
  const SHOCK_LIFE = 520;
  /** the button's width, where the shock ring starts from */
  const SIZE = 96;
  /** long enough to see the flock scatter before the dialog's backdrop covers it */
  const OPEN_DELAY = 450;

  let flock = $state.raw<Bat[]>([]);
  let shocks = $state.raw<Shock[]>([]);
  let now = $state(0);
  let nextId = 0;
  let frame: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** the bats fly over the whole page, so they live on the body, out of the shelf's clipping */
  const portal: Attachment<HTMLElement> = (node) => {
    document.body.append(node);
    return () => node.remove();
  };

  function burst(button: HTMLElement) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const start = performance.now();

    const fresh = Array.from({ length: COUNT }, (): Bat => {
      const big = Math.random() < 0.3;
      const angle = Math.random() * Math.PI * 2;
      return {
        id: nextId++,
        x,
        y,
        start: start + Math.random() * 60,
        life: 900 + Math.random() * 800,
        width: big ? 64 + Math.random() * 56 : 16 + Math.random() * 36,
        angle,
        dist: 240 + Math.random() * 380 + (big ? 80 : 0),
        lean: Math.cos(angle) * 14,
        amp: 6 + Math.random() * 9,
        freq: 30 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        rim: Math.random() < 0.5 ? 'a' : 'b',
      };
    });
    flock = [...flock, ...fresh];
    shocks = [...shocks, { id: nextId++, x, y, start }];
    if (frame === undefined) tick();
  }

  function tick() {
    now = performance.now();
    flock = flock.filter((bat) => now - bat.start < bat.life);
    shocks = shocks.filter((shock) => now - shock.start < SHOCK_LIFE);
    frame = flock.length || shocks.length ? requestAnimationFrame(tick) : undefined;
  }

  function click(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onclick();
      return;
    }
    burst(event.currentTarget);
    clearTimeout(timer);
    timer = setTimeout(onclick, OPEN_DELAY);
  }

  $effect(() => () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timer);
  });

  /** each bat shoots out on an ease-out, pops in, shrinks away and flutters as it goes */
  const bats = $derived(
    flock.map((bat) => {
      const elapsed = Math.max(0, now - bat.start);
      const p = Math.min(1, elapsed / bat.life);
      const travel = 1 - (1 - p) ** 3;
      const height = (bat.width * 365) / 880;
      return {
        id: bat.id,
        rim: bat.rim,
        left: bat.x - bat.width / 2,
        top: bat.y - height / 2,
        width: bat.width,
        height,
        transform: `translate(${(Math.cos(bat.angle) * bat.dist * travel).toFixed(1)}px, ${(
          Math.sin(bat.angle) * bat.dist * travel
        ).toFixed(1)}px) rotate(${(
          bat.lean +
          bat.amp * Math.sin((elapsed / 1000) * bat.freq + bat.phase)
        ).toFixed(2)}deg) scale(${(Math.min(1, p / 0.07) * (1 - p) ** 0.85).toFixed(3)})`,
        opacity: p > 0.85 ? (1 - p) / 0.15 : 1,
      };
    })
  );

  const rings = $derived(
    shocks.map((shock) => {
      const p = Math.min(1, Math.max(0, now - shock.start) / SHOCK_LIFE);
      const size = SIZE + (1 - (1 - p) ** 3) * 300;
      return {
        id: shock.id,
        left: shock.x - size / 2,
        top: shock.y - size / 2,
        size,
        opacity: 0.5 * (1 - p),
      };
    })
  );
</script>

<button type="button" class="add" aria-label="Add a book" onclick={click}>
  <span class="face" aria-hidden="true"><span class="plus"></span></span>
</button>

<div class="flock" aria-hidden="true" {@attach portal}>
  {#each rings as ring (ring.id)}
    <span
      class="ring"
      style:left="{ring.left}px"
      style:top="{ring.top}px"
      style:width="{ring.size}px"
      style:height="{ring.size}px"
      style:opacity={ring.opacity}
    ></span>
  {/each}
  {#each bats as bat (bat.id)}
    <svg
      class="bat"
      class:rim-b={bat.rim === 'b'}
      viewBox="0 -5 880 365"
      style:left="{bat.left}px"
      style:top="{bat.top}px"
      style:width="{bat.width}px"
      style:height="{bat.height}px"
      style:transform={bat.transform}
      style:opacity={bat.opacity}
    >
      <path
        d="M440 355 C400 280 320 250 268 282 C230 210 150 180 110 215 C100 150 60 80 5 40 C100 0 270 -30 378 155 C375 120 385 100 405 95 C410 110 415 118 420 120 C430 135 450 135 460 120 C465 118 470 110 475 95 C495 100 505 120 502 155 C610 -30 780 0 875 40 C820 80 780 150 770 215 C730 180 650 210 612 282 C560 250 480 280 440 355 Z"
      />
    </svg>
  {/each}
</div>

<style>
  /* a socket bored into the back panel, with a light kept somewhere behind the shelf */
  .add {
    position: relative;
    z-index: 3;
    flex: none;
    box-sizing: border-box;
    width: 96px;
    height: 96px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: radial-gradient(
      circle at 50% 40%,
      #030102 0 50%,
      #0b0604 62%,
      #1c120b 78%,
      #3a271a 90%,
      #5a3d2a 100%
    );
    box-shadow:
      inset 0 13px 18px rgb(0 0 0 / 0.95),
      inset 0 -1px 1px rgb(255 200 160 / 0.2),
      0 1px 0 rgb(255 200 160 / 0.12),
      0 -1px 1px rgb(0 0 0 / 0.7);
    cursor: pointer;
  }

  .face {
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    border-radius: 50%;
  }

  .face::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    opacity: 0.4;
    background: radial-gradient(circle at 50% 54%, var(--light-a-glow), transparent 62%);
  }

  .plus {
    position: absolute;
    inset: 0;
    opacity: 0.5;
    filter: drop-shadow(0 0 3px var(--light-a-2));
  }

  .plus::before,
  .plus::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 34px;
    height: 5px;
    translate: -50% -50%;
    border-radius: 3px;
    background: var(--light-a-1);
  }

  .plus::after {
    rotate: 90deg;
  }

  .add:hover,
  .add:focus-visible {
    box-shadow:
      inset 0 7px 10px rgb(0 0 0 / 0.95),
      inset 0 -1px 1px color-mix(in srgb, var(--light-a-2) 45%, transparent),
      0 1px 0 rgb(255 200 160 / 0.12),
      0 0 24px -2px var(--light-a-glow);
  }

  .add:hover .face::before,
  .add:focus-visible .face::before {
    opacity: 1;
  }

  .add:hover .plus,
  .add:focus-visible .plus {
    opacity: 1;
    filter: drop-shadow(0 0 2px var(--light-a-1)) drop-shadow(0 0 8px var(--light-a-2));
  }

  .add:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  .add:active .plus {
    scale: 0.9;
  }

  .flock {
    position: fixed;
    inset: 0;
    z-index: 50;
    overflow: hidden;
    pointer-events: none;
  }

  .ring {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid var(--light-a-2);
    border-radius: 50%;
    filter: drop-shadow(0 0 2px var(--light-a-2));
  }

  /* dark wings, each rimmed by one of the two lights they fly out of */
  .bat {
    position: absolute;
    overflow: visible;
    fill: #0b0605;
    filter: drop-shadow(0 0 2px var(--light-a-2));
  }

  .bat.rim-b {
    filter: drop-shadow(0 0 2px var(--light-b-2));
  }

  @keyframes breathe {
    50% {
      opacity: 0.62;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .face::before,
    .plus {
      transition:
        opacity 0.4s ease,
        filter 0.4s ease,
        scale 0.15s ease;
    }

    .add:not(:hover):not(:focus-visible) .face::before {
      animation: breathe 5s ease-in-out infinite;
    }
  }
</style>
