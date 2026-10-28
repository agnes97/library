<script lang="ts">
  type Props = {
    side: 'left' | 'right';
  };

  let { side }: Props = $props();
</script>

<div class={['torch', side]} aria-hidden="true">
  <div class="halo"></div>
  <div class="plate">
    <span class="rivet" style:top="18px"></span>
    <span class="rivet" style:bottom="16px"></span>
  </div>
  <div class="stem"></div>
  <div class="knot"></div>
  <div class="cup"></div>
  <div class="rim"></div>
  <div class="flame">
    <div class="fl outer"></div>
    <div class="fl inner"></div>
    <div class="fl core"></div>
  </div>
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
    --f1: var(--rose-1);
    --f2: var(--rose-2);
    --f3: var(--rose-3);
    --fg: var(--rose-glow);
  }

  .right {
    right: -120px;
    --f1: var(--violet-1);
    --f2: var(--violet-2);
    --f3: var(--violet-3);
    --fg: var(--violet-glow);
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
    box-shadow: inset 0 3px 0 rgb(255 140 210 / 0.35);
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

  @media (max-width: 760px) {
    .torch {
      display: none;
    }
  }
</style>
