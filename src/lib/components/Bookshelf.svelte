<script lang="ts">
  import type { Book, ShelfBook } from '../types';
  import BookSpine from './BookSpine.svelte';

  type Props = {
    books: ShelfBook[];
    onSelect: (book: Book) => void;
  };

  let { books, onSelect }: Props = $props();

  /** The scene is laid out at a fixed size and scaled down to fit narrow containers. */
  const SCENE_WIDTH = 1012;
  const SCENE_HEIGHT = 456;
  /**
   * How far a pulled-out book at either end reaches past the scene: its cover turns to face the
   * viewer and perspective pushes it outwards. The viewport keeps this much room on each side.
   */
  const OVERHANG = 100;

  let frameWidth = $state(SCENE_WIDTH);
  let innerWidth = $state(SCENE_WIDTH + 2 * OVERHANG);

  const scale = $derived(
    Math.min(1, frameWidth / SCENE_WIDTH, innerWidth / (SCENE_WIDTH + 2 * OVERHANG))
  );

  function fit(element: HTMLElement) {
    const observer = new ResizeObserver(([entry]) => {
      frameWidth = entry.contentRect.width;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }
</script>

<svelte:window bind:innerWidth />

<div class="frame" {@attach fit} style:height="{SCENE_HEIGHT * scale}px">
  <div class="scaler" style:transform="scale({scale})">
    <div class="shelf">
      <div class="books">
        <div class="wall"></div>
        <div class="plank-top"></div>
        <div class="plank-front"></div>

        {#each books as { key, book } (key)}
          <BookSpine {book} {onSelect} />
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .frame {
    position: relative;
  }

  .scaler {
    position: absolute;
    top: 0;
    left: 50%;
    width: 1012px;
    margin-left: -506px;
    padding: 0 26px;
    transform-origin: top center;
  }

  .shelf {
    padding: 50px 0 44px;
    perspective: 1400px;
    perspective-origin: 50% 20%;
  }

  /* One 3D space for the books and the shelf, so the books really stand on the plank. */
  .books {
    --depth: 180px;
    --plank: 230px;
    position: relative;
    width: 960px;
    height: 340px;
    padding: 0 26px;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 6px;
    transform-style: preserve-3d;
  }

  .wall,
  .plank-top,
  .plank-front {
    position: absolute;
    left: -26px;
    right: -26px;
    pointer-events: none;
  }

  .wall {
    top: -20px;
    bottom: 0;
    transform: translateZ(calc(var(--plank) / -2));
    background:
      linear-gradient(
        180deg,
        rgb(0 0 0 / 0.35),
        rgb(0 0 0 / 0.1) 40%,
        rgb(0 0 0 / 0.3)
      ),
      var(--wood-wall);
    box-shadow: inset 0 0 40px rgb(0 0 0 / 0.55);
  }

  .plank-top {
    top: calc(100% - var(--plank) / 2);
    height: var(--plank);
    transform: translateY(1px) rotateX(90deg);
    background:
      repeating-linear-gradient(
        90deg,
        rgb(0 0 0 / 0.06) 0 2px,
        transparent 2px 9px
      ),
      linear-gradient(180deg, #a06f46, var(--wood-plank));
  }

  .plank-front {
    top: 100%;
    height: 22px;
    transform: translateY(1px) translateZ(calc(var(--plank) / 2));
    background: linear-gradient(180deg, #7a5133, var(--wood-edge) 70%, #482c19);
    border-radius: 0 0 3px 3px;
    box-shadow: 0 16px 26px rgb(0 0 0 / 0.55);
  }
</style>
