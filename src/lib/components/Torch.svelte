<script lang="ts">
  type Props = {
    side: 'left' | 'right';
    /** whether the flame burns; a click on the torch toggles it */
    lit?: boolean;
  };

  let { side, lit = $bindable(true) }: Props = $props();
</script>

<div class={['torch', side, { out: !lit }]}>
  <button
    type="button"
    class="switch"
    aria-pressed={lit}
    aria-label="{side === 'left' ? 'Left' : 'Right'} torch"
    onclick={() => (lit = !lit)}
  ></button>
  <div class="halo"></div>
  <div class="plate">
    <span class="rivet" style:top="18px"></span>
    <span class="rivet" style:bottom="16px"></span>
  </div>
  <div class="stem"></div>
  <div class="knot"></div>
  <!-- the collar, band, ember bed and sparks belong to the phone's brazier -->
  <div class="collar"></div>
  <div class="cup"></div>
  <div class="band"></div>
  <div class="rim"></div>
  <div class="ember"></div>
  <div class="flame">
    <div class="fl outer"></div>
    <div class="fl inner"></div>
    <div class="fl core"></div>
  </div>
  <span class="spark"></span>
  <span class="spark"></span>
</div>

<style>
  .torch {
    position: absolute;
    top: 170px;
    width: 64px;
    height: 300px;
    z-index: 1;
    pointer-events: none;
  }

  .left {
    left: -120px;
    --f1: var(--light-a-1);
    --f2: var(--light-a-2);
    --f3: var(--light-a-3);
    --fg: var(--light-a-glow);
  }

  .right {
    right: -120px;
    --f1: var(--light-b-1);
    --f2: var(--light-b-2);
    --f3: var(--light-b-3);
    --fg: var(--light-b-glow);
  }

  /* the torch itself takes clicks; its halo stays out of the way */
  .switch {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: none;
    cursor: pointer;
    pointer-events: auto;
  }

  .switch:focus-visible {
    outline: 2px solid var(--f2);
    outline-offset: 4px;
  }

  .halo,
  .flame {
    transition:
      opacity 0.4s ease,
      scale 0.4s ease;
  }

  .out .halo {
    opacity: 0;
    animation: none;
  }

  .out .rim,
  .out .rivet {
    box-shadow: none;
  }

  .out .flame {
    opacity: 0;
    scale: 0.3 0.15;
  }

  .out .ember,
  .out .spark {
    visibility: hidden;
  }

  .halo {
    position: absolute;
    left: 50%;
    top: 40px;
    width: 900px;
    height: 900px;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(circle, var(--fg) 0%, transparent 62%);
    mix-blend-mode: screen;
  }

  .flame {
    position: absolute;
    left: 50%;
    top: 0;
    width: 44px;
    height: 82px;
    translate: -50% 0;
    transform-origin: 50% 100%;
  }

  .fl {
    position: absolute;
    left: 50%;
    bottom: 0;
    translate: -50% 0;
    transform-origin: 50% 100%;
    border-radius: 50% 50% 22% 22% / 62% 62% 38% 38%;
  }

  .outer {
    width: 44px;
    height: 82px;
    background: radial-gradient(
      ellipse 60% 70% at 50% 78%,
      var(--f2),
      var(--f3) 58%,
      transparent 74%
    );
    filter: blur(3px);
  }

  .inner {
    width: 24px;
    height: 52px;
    bottom: 4px;
    background: radial-gradient(
      ellipse 60% 70% at 50% 82%,
      var(--f1),
      var(--f2) 68%,
      transparent 92%
    );
    filter: blur(1px);
  }

  .core {
    width: 10px;
    height: 20px;
    bottom: 6px;
    background: var(--f1);
    filter: blur(1.5px);
  }

  .cup {
    position: absolute;
    left: 50%;
    top: 78px;
    width: 54px;
    height: 30px;
    translate: -50% 0;
    clip-path: polygon(0 0, 100% 0, 78% 100%, 22% 100%);
    background: linear-gradient(90deg, #120d0f, #3a2e33 40%, #1b1417 70%, #0b0809);
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--light-a-2) 35%, transparent);
  }

  .rim {
    position: absolute;
    left: 50%;
    top: 74px;
    width: 62px;
    height: 7px;
    translate: -50% 0;
    border-radius: 3px;
    background: linear-gradient(90deg, #1a1316, #5a4650 45%, #241b1f);
    box-shadow: 0 -2px 10px var(--f3);
  }

  .stem {
    position: absolute;
    left: 50%;
    top: 106px;
    width: 12px;
    height: 96px;
    translate: -50% 0;
    background: linear-gradient(90deg, #0d0a0b, #3a2f34 45%, #141012);
  }

  .knot {
    position: absolute;
    left: 50%;
    top: 150px;
    width: 22px;
    height: 10px;
    translate: -50% 0;
    border-radius: 5px;
    background: linear-gradient(90deg, #140f11, #4a3b42 50%, #140f11);
  }

  .plate {
    position: absolute;
    left: 50%;
    top: 186px;
    width: 34px;
    height: 104px;
    translate: -50% 0;
    border-radius: 17px 17px 4px 4px;
    background: linear-gradient(90deg, #0f0b0c, #2e2428 50%, #0f0b0c);
    box-shadow:
      0 10px 24px rgb(0 0 0 / 0.8),
      inset 0 0 0 1px rgb(255 255 255 / 0.05);
  }

  .rivet {
    position: absolute;
    left: 50%;
    width: 6px;
    height: 6px;
    translate: -50% 0;
    border-radius: 50%;
    background: #5b4a52;
    box-shadow: 0 0 4px var(--f3);
  }

  .collar,
  .band,
  .ember,
  .spark {
    display: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .outer {
      animation: flick 1.7s ease-in-out infinite alternate;
    }

    .inner {
      animation: flick 1.1s ease-in-out infinite alternate-reverse;
    }

    .core {
      animation: flick 0.8s ease-in-out infinite alternate;
    }

    .halo {
      animation: pulse 3.2s ease-in-out infinite;
    }

    .right .outer {
      animation-duration: 1.9s;
    }

    .right .halo {
      animation-duration: 2.7s;
    }
  }

  @media (max-width: 1340px) {
    .torch {
      scale: 0.8;
    }

    .left {
      left: -96px;
    }

    .right {
      right: -96px;
    }
  }

  /* no wall beside the case: small sconces on the wall above it, at the screen's edges */
  @media (max-width: 760px) {
    .torch {
      top: -122px;
      scale: 0.4;
      transform-origin: 50% 0;
    }

    .left {
      left: -31px;
    }

    .right {
      right: -31px;
    }
  }

  /*
   * phones: braziers rather than sconces, just the bowl and its fire on a stub of the pole,
   * standing on the bookcase's top at either side of the hint
   */
  @media (max-width: 560px) {
    .torch {
      top: auto;
      bottom: 100%;
      height: 126px;
      scale: 0.74;
      transform-origin: 50% 100%;
    }

    .left {
      left: -12px;
    }

    .right {
      right: -12px;
    }

    .plate,
    .stem,
    .knot {
      display: none;
    }

    .collar,
    .band,
    .ember,
    .spark {
      display: block;
    }

    .halo {
      top: 50px;
      width: 520px;
      height: 520px;
    }

    .flame {
      top: 4px;
    }

    .rim {
      top: 78px;
      width: 66px;
      height: 8px;
      border-radius: 4px;
      background: linear-gradient(90deg, #1a1316, #6a5560 40%, #8a7480 48%, #2a2024);
    }

    /* a deeper hammered-iron bowl, lit from the fire inside it */
    .cup {
      top: 84px;
      width: 58px;
      height: 36px;
      clip-path: polygon(0 0, 100% 0, 84% 70%, 64% 100%, 36% 100%, 16% 70%);
      background:
        radial-gradient(
          ellipse 60% 30% at 50% 0%,
          color-mix(in srgb, var(--f2) 55%, transparent),
          transparent 70%
        ),
        repeating-linear-gradient(90deg, transparent 0 7px, rgb(0 0 0 / 0.25) 7px 8px),
        linear-gradient(90deg, #120d0f, #463840 38%, #2a2024 62%, #0b0809);
      box-shadow: none;
    }

    .band {
      position: absolute;
      left: 50%;
      top: 96px;
      width: 52px;
      height: 4px;
      translate: -50% 0;
      clip-path: polygon(0 0, 100% 0, 97% 100%, 3% 100%);
      background: linear-gradient(90deg, #1a1316, #6a5560 45%, #241b1f);
    }

    .ember {
      position: absolute;
      left: 50%;
      top: 79px;
      width: 46px;
      height: 6px;
      translate: -50% 0;
      border-radius: 50%;
      background: radial-gradient(ellipse, var(--f1), var(--f2) 45%, transparent 75%);
      filter: blur(1px);
    }

    .collar {
      position: absolute;
      left: 50%;
      top: 118px;
      width: 18px;
      height: 8px;
      translate: -50% 0;
      border-radius: 4px;
      background: linear-gradient(90deg, #140f11, #5a4650 50%, #140f11);
    }

    .spark {
      position: absolute;
      top: 20px;
      left: 46%;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--f1);
      box-shadow: 0 0 4px var(--f2);
      opacity: 0;
    }

    .spark + .spark {
      left: 58%;
    }
  }

  @media (max-width: 560px) and (prefers-reduced-motion: no-preference) {
    .spark {
      animation: rise 2.4s linear infinite;
    }

    .spark + .spark {
      animation-delay: 1.1s;
      animation-duration: 2.9s;
    }
  }

  @keyframes rise {
    from {
      translate: 0 0;
      opacity: 0;
    }

    15% {
      opacity: 1;
    }

    to {
      translate: 6px -46px;
      opacity: 0;
    }
  }
</style>
