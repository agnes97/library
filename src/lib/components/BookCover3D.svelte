<script lang="ts">
  import type { Book } from '../types';

  type Props = {
    book: Book;
    height?: number;
  };

  let { book, height = 220 }: Props = $props();

  const REST_X = -8;
  const REST_Y = 26;
  /** degrees per pixel of pointer movement */
  const SPEED = 0.7;
  const RETURN = 'transform 1.6s cubic-bezier(0.25, 0.8, 0.3, 1)';

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const width = $derived(Math.round(height * 0.68));
  const depth = $derived(clamp(Math.round(height * 0.13), 14, 30));
  const fontSize = $derived(clamp(Math.round(height * 0.085), 10, 18));

  let rx = $state(REST_X);
  let ry = $state(REST_Y);
  let transition = $state('none');
  let grabbing = $state(false);

  /** Turns the box by dragging; letting go away from it (or lifting a finger) sends it home. */
  function draggable(host: HTMLElement) {
    const box = host.firstElementChild as HTMLElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let lastX = 0;
    let lastY = 0;
    let turned = false;

    // the angles the box shows right now (it may be halfway through the swing back)
    function readPose() {
      const matrix = new DOMMatrix(getComputedStyle(box).transform);
      ry = (Math.atan2(matrix.m13, matrix.m11) * 180) / Math.PI;
      rx = (Math.atan2(matrix.m32, matrix.m22) * 180) / Math.PI;
    }

    function goHome() {
      if (!turned) return;
      turned = false;

      // drop whole extra turns first (looks identical), then ease back the shortest way
      ry -= Math.round((ry - REST_Y) / 360) * 360;
      // state updates are batched, so jump to the normalised pose on the DOM directly
      box.style.transition = 'none';
      box.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      void box.offsetWidth;

      transition = reducedMotion.matches ? 'none' : RETURN;
      rx = REST_X;
      ry = REST_Y;
    }

    function isOver(event: PointerEvent) {
      const rect = host.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      grabbing = true;
      turned = true;
      lastX = event.clientX;
      lastY = event.clientY;
      readPose();
      transition = 'none';
      host.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!grabbing) return;
      ry += (event.clientX - lastX) * SPEED;
      rx = clamp(rx - (event.clientY - lastY) * SPEED, -85, 85);
      lastX = event.clientX;
      lastY = event.clientY;
    }

    function onRelease(event: PointerEvent) {
      if (!grabbing) return;
      grabbing = false;
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
      // a mouse still over the book keeps the pose; anything else goes home right away
      if (event.pointerType !== 'mouse' || event.type === 'pointercancel' || !isOver(event)) {
        goHome();
      }
    }

    function onPointerLeave() {
      if (!grabbing) goHome();
    }

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onRelease);
    host.addEventListener('pointercancel', onRelease);
    host.addEventListener('pointerleave', onPointerLeave);

    return () => {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onRelease);
      host.removeEventListener('pointercancel', onRelease);
      host.removeEventListener('pointerleave', onPointerLeave);
    };
  }
</script>

<div
  class={['c3d', { grabbing }]}
  title="Drag to turn the book"
  style:width="{width}px"
  style:height="{height}px"
  style:--w="{width}px"
  style:--h="{height}px"
  style:--d="{depth}px"
  style:--fs="{fontSize}px"
  style:--c1={book.colors.c1}
  style:--c2={book.colors.c2}
  style:--book-accent={book.colors.accent}
  style:--ink={book.colors.ink}
  {@attach draggable}
>
  <div
    class="box"
    style:transform="rotateX({rx}deg) rotateY({ry}deg)"
    style:transition
  >
    <div class="face front">
      <span class="ornament" aria-hidden="true">❦</span>
      <span class="title">{book.title}</span>
      <span class="author">{book.author}</span>
    </div>
    <div class="face back"></div>
    <div class="face spine"><span>{book.title}</span></div>
    <div class="face pages"></div>
    <div class="face top"></div>
    <div class="face bottom"></div>
  </div>
</div>

<style>
  .c3d {
    position: relative;
    flex: none;
    perspective: 900px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    filter: drop-shadow(0 12px 12px rgb(0 0 0 / 0.5));
  }

  .c3d.grabbing {
    cursor: grabbing;
  }

  .box {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    will-change: transform;
  }

  .face {
    position: absolute;
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .front {
    inset: 0;
    transform: translateZ(calc(var(--d) / 2));
    border-radius: 1px 4px 4px 1px;
    background: linear-gradient(135deg, var(--c1), var(--c2));
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--fs) * 1.4) calc(var(--fs) * 1);
    text-align: center;
  }

  .front::before {
    content: '';
    position: absolute;
    inset: 7px;
    border: 1px solid var(--book-accent);
    border-radius: 2px;
    opacity: 0.7;
  }

  /* hinge groove next to the spine and a soft gloss */
  .front::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        90deg,
        rgb(0 0 0 / 0.3) 0,
        rgb(255 255 255 / 0.14) 3%,
        rgb(0 0 0 / 0) 7%
      ),
      linear-gradient(135deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 45%);
  }

  .ornament {
    color: var(--book-accent);
    font-size: calc(var(--fs) * 1.3);
    line-height: 1;
  }

  .title {
    font-family: var(--serif);
    font-weight: 700;
    font-size: var(--fs);
    line-height: 1.2;
  }

  .author {
    font-size: calc(var(--fs) * 0.62);
    opacity: 0.9;
  }

  .back {
    inset: 0;
    transform: rotateY(180deg) translateZ(calc(var(--d) / 2));
    border-radius: 4px 1px 1px 4px;
    background: linear-gradient(135deg, rgb(255 255 255 / 0.1), rgb(0 0 0 / 0.25)),
      var(--c2);
  }

  .spine {
    left: calc(50% - var(--d) / 2);
    top: 0;
    width: var(--d);
    height: 100%;
    transform: rotateY(-90deg) translateZ(calc(var(--w) / 2));
    background: linear-gradient(90deg, var(--c1), var(--c2));
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spine span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-family: var(--serif);
    font-weight: 700;
    font-size: calc(var(--fs) * 0.8);
    max-height: 90%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pages {
    left: calc(50% - var(--d) / 2);
    top: 2px;
    width: var(--d);
    height: calc(100% - 4px);
    transform: rotateY(90deg) translateZ(calc(var(--w) / 2 - 1px));
    background: repeating-linear-gradient(90deg, #f3ead6 0 1.5px, #d6c9ab 1.5px 2.5px);
  }

  .top,
  .bottom {
    left: 1px;
    top: calc(50% - var(--d) / 2);
    width: calc(100% - 2px);
    height: var(--d);
    background: repeating-linear-gradient(180deg, #f3ead6 0 1.5px, #d6c9ab 1.5px 2.5px);
  }

  .top {
    transform: rotateX(90deg) translateZ(calc(var(--h) / 2 - 1px));
  }

  .bottom {
    transform: rotateX(-90deg) translateZ(calc(var(--h) / 2 - 1px));
    filter: brightness(0.75);
  }
</style>
