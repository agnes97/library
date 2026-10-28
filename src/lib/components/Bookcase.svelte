<script lang="ts">
  import { tick } from 'svelte';
  import type { Book, Shelf, ShelfBook, ShelfOptions } from '../types';
  import BookSpine from './BookSpine.svelte';
  import ShelfTag from './ShelfTag.svelte';
  import Torch from './Torch.svelte';

  type Props = {
    /** every book read, newest first */
    readings: ShelfBook[];
    /** what sits on each shelf besides the spines, top shelf first */
    shelfDecor: ShelfOptions[];
    onSelect: (book: Book, read: string, spine: HTMLElement) => void;
  };

  let { readings, shelfDecor, onSelect }: Props = $props();

  let wrap = $state<HTMLElement>();
  let caseElement = $state<HTMLElement>();
  let viewport = $state<HTMLElement>();
  let stack = $state<HTMLElement>();

  /** width of a shelf row (they all match), measured on the last one once it mounts */
  let rowWidth = $state(0);

  /** gap between spines and the row's side padding, as in the styles below */
  const GAP = 5;
  const ROW_PADDING = 6;
  /** the pile's side margins, plus the room a flat book slides out into on hover */
  const PILE_MARGIN = 18;
  /** the room the candle takes, margins included */
  const CANDLE_WIDTH = 30 + 22 + 26;

  /** how far a tipped book leans back onto its neighbour, as in BookSpine's styles */
  const LEAN_ANGLE = (9 * Math.PI) / 180;
  /** the width of a hanging year tag with four digits, chains included */
  const TAG_WIDTH = 164;

  /** "The End", its letters lit alternately by the two lights, spaces skipped */
  const endLetters = [...'The End'].map((char, i, all) => ({
    char,
    light: all.slice(0, i).filter((c) => c !== ' ').length % 2 ? 'b' : 'a',
  }));

  const yearOf = (item: ShelfBook) => Number(item.read.slice(0, 4));

  /**
   * The margin a book tipped back from its bottom left corner keeps from the book before it,
   * so its left edge rests on that book's top corner (or its own top corner on that book's side).
   */
  const leanMargin = (before: ShelfBook, item: ShelfBook) =>
    Math.max(
      0,
      Math.ceil(
        Math.min(before.height, item.height * Math.cos(LEAN_ANGLE)) * Math.tan(LEAN_ANGLE)
      ) - GAP
    );

  /** Fill the shelves top down in reading order, moving whatever does not fit to the next one. */
  function layout(queue: ShelfBook[], decor: ShelfOptions[], across: number): Shelf[] {
    const shelves: Shelf[] = [];
    if (!across) return shelves;
    const inner = across - 2 * ROW_PADDING;

    let start = 0;
    while (start < queue.length) {
      const { pile: pileSize = 0, candle = false, lean = false } = decor[shelves.length] ?? {};
      let room = inner;
      if (candle) room -= CANDLE_WIDTH + GAP;

      /** the pile of books after the spines that end at `end`, and the room it takes */
      const pileAfter = (end: number) => {
        const pile = queue.slice(end, end + pileSize);
        if (!pile.length) return null;
        // a pile running into another year would hide the tag that marks where the year begins
        if (pile.some((item) => yearOf(item) !== yearOf(queue[end - 1]))) return null;
        // as wide as its longest book; dropped if it would crowd out the spines
        const width = Math.max(...pile.map((item) => item.height)) + 2 * PILE_MARGIN + GAP;
        return width <= room / 2 ? { pile, width } : null;
      };

      // take spines while they fit whole, next to the pile that would follow them
      let end = start + 1;
      let used = queue[start].width;
      while (end < queue.length) {
        const item = queue[end];
        // a tipped book needs room to lean back onto the one before it
        const extra = lean ? leanMargin(queue[end - 1], item) : 0;
        const next = used + GAP + item.width;
        if (next + extra + (pileAfter(end + 1)?.width ?? 0) > room) break;
        used = next;
        end++;
      }
      const pile = pileAfter(end);
      // the last spine tips over, unless it stands alone
      const tipped =
        lean && end - 1 > start ? leanMargin(queue[end - 2], queue[end - 1]) : undefined;

      // the row centres its contents; find where each spine starts to know where its tag fits
      const content =
        used +
        (tipped ?? 0) +
        (pile?.width ?? 0) +
        (candle ? CANDLE_WIDTH + GAP : 0);
      let offset = Math.max(0, (inner - content) / 2);

      const books = queue.slice(start, end).map((item, i): ShelfBook => {
        const j = start + i;
        const leans = tipped !== undefined && j === end - 1;
        if (leans) offset += tipped;
        const first = j === 0 || yearOf(item) !== yearOf(queue[j - 1]);
        const placed = {
          ...item,
          lean: leans ? tipped : undefined,
          tag: first ? yearOf(item) : undefined,
          tagFlip: first && offset + TAG_WIDTH > inner,
        };
        offset += item.width + GAP;
        return placed;
      });

      shelves.push({
        key: `shelf-${shelves.length}`,
        books,
        pile: pile?.pile ?? [],
        candle,
      });
      start = end + (pile?.pile.length ?? 0);
    }
    return shelves;
  }

  const shelves = $derived(layout(readings, shelfDecor, rowWidth));

  /** re-measures the case while it is mounted */
  let refit: (() => void) | undefined;

  // the case grows and shrinks by whole shelves as its width changes
  $effect(() => {
    void shelves.length;
    refit?.();
  });

  let viewportHeight = $state(760);
  /** How far the shelves scroll inside the case; the page gets this much extra room for it. */
  let travel = $state(0);

  /**
   * The case pins near the top of the window (sticky). While it is pinned, page scroll moves the
   * shelves inside it instead of the case.
   */
  $effect(() => {
    if (!wrap || !caseElement || !viewport || !stack) return;
    const [wrapEl, caseEl, viewportEl, stackEl] = [wrap, caseElement, viewport, stack];

    /** where the case pins, in px below the window top (1rem) */
    let pinTop = 16;
    /** the shelf scroll position the page scroll last asked for */
    let wanted = 0;

    function measure() {
      pinTop = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const above = viewportEl.getBoundingClientRect().top - caseEl.getBoundingClientRect().top;
      // the shelf window runs to the bottom of the window, so the plinth only scrolls into view
      // once the last shelf has passed
      const height = Math.max(380, Math.floor(window.innerHeight - pinTop - above));
      viewportHeight = height;
      travel = Math.max(0, stackEl.scrollHeight - height);
    }

    function sync() {
      wanted = Math.max(0, Math.min(travel, pinTop - wrapEl.getBoundingClientRect().top));
      if (Math.abs(stackEl.scrollTop - wanted) > 0.5) stackEl.scrollTop = wanted;
    }

    function onScroll(event: Event) {
      if (event.target === stackEl) {
        // the shelves moved on their own (keyboard focus on a spine): move the page to match
        const drift = stackEl.scrollTop - wanted;
        if (Math.abs(drift) > 1) {
          wanted = stackEl.scrollTop;
          window.scrollBy(0, drift);
        }
        return;
      }
      sync();
    }

    async function onResize() {
      measure();
      await tick();
      sync();
    }

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    refit = onResize;
    onResize();
    // the webfonts change the case's height once they arrive
    document.fonts.ready.then(onResize);

    return () => {
      refit = undefined;
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<div class="wrap" bind:this={wrap}>
  <div class="pin">
    <Torch side="left" />
    <Torch side="right" />

    <div class="case" bind:this={caseElement}>
      <div class="cap"></div>
      <div class="cove"></div>
      <div class="dentils"></div>
      <div class="frieze">
        <span class="panel"></span>
        <span class="panel"></span>
        <span class="panel"></span>
      </div>
      <div class="bead"></div>

      <div class="body">
        <div class="pillar"></div>
        <div class="viewport" bind:this={viewport} style:height="{viewportHeight}px">
          <div class="stack" bind:this={stack}>
            {#each shelves as shelf (shelf.key)}
              <div class="unit">
                <div class="row">
                  {#each shelf.books as { key, book, width, height, lean, read, tag, tagFlip } (key)}
                    {#if tag}
                      <!-- as tall as the row, so the tag hangs from the shelf above while the
                           spine stands on the plank -->
                      <div class="tagged">
                        <ShelfTag year={tag} flip={tagFlip} />
                        <BookSpine {book} {width} {height} {lean} {read} {onSelect} />
                      </div>
                    {:else}
                      <BookSpine {book} {width} {height} {lean} {read} {onSelect} />
                    {/if}
                  {/each}

                  {#if shelf.pile.length}
                    <div class="pile">
                      <!-- listed bottom first, stacked from the shelf up -->
                      {#each shelf.pile as { key, book, width, height, read } (key)}
                        <BookSpine {book} {width} {height} flat {read} {onSelect} />
                      {/each}
                    </div>
                  {/if}

                  {#if shelf.candle}
                    <div class="candle" aria-hidden="true">
                      <span class="candle-glow"></span>
                      <span class="candle-flame"></span>
                      <span class="saucer"></span>
                    </div>
                  {/if}
                </div>
                <div class="plank"></div>
              </div>
            {/each}
            <div class="unit last">
              <div class="row end" bind:clientWidth={rowWidth}>
                <p>
                  {#each endLetters as { char, light }, i (i)}<span class="light-{light}">{char}</span
                    >{/each}
                </p>
              </div>
              <div class="plank"></div>
            </div>
          </div>
          <div class="shade" aria-hidden="true"></div>
          <div class="lightfx" aria-hidden="true"></div>
        </div>
        <div class="pillar"></div>
      </div>

      <div class="plinth"></div>
      <div class="plinth-base"></div>
    </div>
  </div>
  <div aria-hidden="true" style:height="{travel}px"></div>
</div>

<style>
  .wrap {
    position: relative;
  }

  .pin {
    position: sticky;
    top: 1rem;
  }

  .case {
    position: relative;
    z-index: 2;
    box-shadow: 0 50px 90px -20px rgb(0 0 0 / 0.95);
  }

  /* torchlight on the case, clipped to its silhouette: cap, cove, dentils, frieze + body, bead,
     plinth, plinth base */
  .case::after {
    --silhouette:
      linear-gradient(#000 0 0) 0 0 / 100% 14px no-repeat,
      linear-gradient(#000 0 0) center 14px / calc(100% - 20px) 11px no-repeat,
      linear-gradient(#000 0 0) center 25px / calc(100% - 36px) 10px no-repeat,
      linear-gradient(#000 0 0) center 35px / calc(100% - 56px) calc(100% - 89px) no-repeat,
      linear-gradient(#000 0 0) center 73px / calc(100% - 44px) 9px no-repeat,
      linear-gradient(#000 0 0) center calc(100% - 34px) / calc(100% - 36px) 20px no-repeat,
      linear-gradient(#000 0 0) center bottom / calc(100% - 20px) 34px no-repeat;
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -28px;
    right: -28px;
    z-index: 6;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: 0.7;
    background:
      radial-gradient(ellipse 200px 420px at 0 215px, var(--light-a-glow), transparent),
      radial-gradient(ellipse 200px 420px at 100% 215px, var(--light-b-glow), transparent);
    -webkit-mask: var(--silhouette);
    mask: var(--silhouette);
  }

  .cap {
    position: relative;
    z-index: 3;
    height: 14px;
    margin: 0 -28px;
    border-radius: 2px 2px 0 0;
    background: linear-gradient(180deg, #7a5238 0, #54382a 2px, #3e281b 55%, #26180f);
    box-shadow: 0 8px 12px -2px rgb(0 0 0 / 0.85);
    filter: url(#grainH);
  }

  .cove {
    position: relative;
    z-index: 2;
    height: 11px;
    margin: 0 -18px;
    background: linear-gradient(180deg, #0d0705, #22150e 45%, #4a3122 90%, #2a1a11);
    filter: url(#grainH);
  }

  .dentils {
    height: 10px;
    margin: 0 -10px;
    background:
      linear-gradient(180deg, rgb(255 200 160 / 0.08), transparent 30%, rgb(0 0 0 / 0.5)),
      repeating-linear-gradient(90deg, #3e2a1c 0 15px, #5a3d2a 15px 16px, #090504 16px 25px);
    filter: url(#grainH);
  }

  .frieze {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 38px;
    padding: 0 26px;
    background: linear-gradient(180deg, #34221a, #24170f);
    box-shadow: inset 0 6px 8px -4px rgb(0 0 0 / 0.8);
    filter: url(#grainH);
  }

  .panel {
    flex: 1;
    height: 20px;
    border-radius: 2px;
    background: linear-gradient(180deg, #160d09, #291a11);
    box-shadow:
      inset 0 3px 7px rgb(0 0 0 / 0.85),
      inset 0 -1px 0 rgb(255 190 150 / 0.1),
      0 1px 0 rgb(255 190 150 / 0.07);
  }

  .bead {
    position: relative;
    z-index: 2;
    height: 9px;
    margin: 0 -6px;
    border-radius: 5px;
    background: linear-gradient(180deg, #664530, #33211a 50%, #120b07);
    box-shadow: 0 5px 9px rgb(0 0 0 / 0.8);
    filter: url(#grainH);
  }

  .body {
    display: flex;
  }

  .pillar {
    flex: none;
    width: 36px;
    background:
      repeating-linear-gradient(90deg, rgb(0 0 0 / 0.4) 0 1px, transparent 1px 9px),
      linear-gradient(90deg, #120b07, #3e2a1c 28%, #2c1c13 62%, #0e0805);
    filter: url(#grainV);
  }

  .viewport {
    position: relative;
    flex: 1;
    min-width: 0;
    background: #0a0605;
    box-shadow: inset 0 0 0 1px #000;
  }

  .stack {
    --side: 30px;
    height: 100%;
    padding: 0 var(--side);
    overflow: hidden;
  }

  .unit {
    position: relative;
    isolation: isolate;
    height: 380px;
  }

  /* the back panel of the shelf */
  .unit::before {
    content: '';
    position: absolute;
    z-index: -1;
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--side));
    right: calc(-1 * var(--side));
    background:
      repeating-linear-gradient(
        90deg,
        rgb(0 0 0 / 0.65) 0 2px,
        rgb(255 200 160 / 0.03) 2px 3px,
        transparent 3px 148px
      ),
      linear-gradient(180deg, #1e140e, #140c08);
    box-shadow: inset 0 34px 40px -12px rgb(0 0 0 / 0.9);
    filter: url(#grainV);
  }

  .row {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: safe center;
    gap: 5px;
    /* fills the unit down to the plank, so the plank covers the seam where back panels meet */
    height: 354px;
    padding: 0 6px;
    overflow: hidden;
  }

  .tagged {
    position: relative;
    flex: none;
    align-self: stretch;
    display: flex;
    align-items: flex-end;
  }

  /* the last, empty shelf */
  .end {
    align-items: center;
  }

  /*
   * not isolated, so its words can rise above the case's shade; the back panel
   * moves up to z-index 0 to stay in front of the case like the other shelves'
   */
  .last {
    isolation: auto;
  }

  .last::before {
    z-index: 0;
  }

  .end p {
    position: relative;
    z-index: 6;
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 50px;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    white-space: pre;
  }

  .end span {
    color: color-mix(in srgb, var(--l2) 70%, var(--l1));
    text-shadow:
      0 0 24px color-mix(in srgb, var(--l2) 45%, transparent),
      0 2px 0 #000;
  }

  .end .light-a {
    --l1: var(--light-a-1);
    --l2: var(--light-a-2);
  }

  .end .light-b {
    --l1: var(--light-b-1);
    --l2: var(--light-b-2);
  }

  .plank {
    position: relative;
    height: 26px;
    margin: 0 calc(-1 * var(--side));
    box-shadow: 0 18px 24px rgb(0 0 0 / 0.8);
  }

  /* the grain sits on its own layer: a filter on .plank would paint grain into the shadow too */
  .plank::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #6a4831 0, #4a3122 6px, #2e1d14 7px, #24170f 60%, #120b07);
    filter: url(#grainH);
  }

  .plinth {
    height: 20px;
    margin: 0 -10px;
    background: linear-gradient(180deg, #5a3d2a, #2a1b12 30%, #170e09);
    filter: url(#grainH);
  }

  .plinth-base {
    height: 34px;
    margin: 0 -18px;
    background: linear-gradient(180deg, #2b1c13, #120b07);
    box-shadow: 0 20px 30px rgb(0 0 0 / 0.9);
    filter: url(#grainH);
  }

  .shade {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgb(4 2 3 / 0.35) 0%,
      rgb(4 2 3 / 0) 8%,
      rgb(4 2 3 / 0) 50%,
      rgb(4 2 3 / 0.55) 78%,
      rgb(4 2 3 / 0.9) 100%
    );
  }

  .lightfx {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    mix-blend-mode: screen;
    background:
      radial-gradient(ellipse 50% 42% at 0% 135px, var(--light-a-glow), transparent 100%),
      radial-gradient(ellipse 50% 42% at 100% 135px, var(--light-b-glow), transparent 100%);
  }

  /* shelf props */
  .pile {
    flex: none;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 1px;
    margin: 0 18px;
  }

  .candle {
    position: relative;
    flex: none;
    align-self: flex-end;
    width: 30px;
    height: 74px;
    margin: 0 22px 0 26px;
    border-radius: 4px 4px 2px 2px;
    background: linear-gradient(90deg, #8d7d72, #d9cbbd 40%, #a39183 75%, #6d5f56);
  }

  /* a drip of wax */
  .candle::before {
    content: '';
    position: absolute;
    left: 4px;
    top: -3px;
    width: 9px;
    height: 22px;
    border-radius: 5px;
    background: #cdbfb1;
  }

  .candle-flame {
    position: absolute;
    left: 50%;
    bottom: 100%;
    width: 14px;
    height: 30px;
    translate: -50% -4px;
    transform-origin: 50% 100%;
    border-radius: 50% 50% 22% 22% / 62% 62% 38% 38%;
    background: radial-gradient(
      ellipse 60% 70% at 50% 80%,
      var(--light-a-1),
      var(--light-a-2) 60%,
      transparent 80%
    );
    filter: blur(0.6px);
  }

  .candle-glow {
    position: absolute;
    left: 50%;
    bottom: 60px;
    width: 240px;
    height: 240px;
    translate: -50% 50%;
    border-radius: 50%;
    background: radial-gradient(circle, var(--light-a-glow), transparent 65%);
    mix-blend-mode: screen;
    pointer-events: none;
  }

  .saucer {
    position: absolute;
    left: -12px;
    right: -12px;
    bottom: -2px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(180deg, #4a3b42, #16101a);
  }

  @media (prefers-reduced-motion: no-preference) {
    .lightfx {
      animation: pulse 3.2s ease-in-out infinite;
    }

    .candle-flame {
      animation: flick 1.3s ease-in-out infinite alternate;
    }
  }

  @media (max-width: 760px) {
    .case::after {
      display: none;
    }

    .stack {
      --side: 14px;
    }

    .pillar {
      width: 18px;
    }

    .cap {
      margin: 0 -12px;
    }

    .cove {
      margin: 0 -8px;
    }

    .dentils {
      margin: 0 -4px;
    }

    .frieze {
      padding: 0 12px;
      gap: 10px;
    }
  }
</style>
