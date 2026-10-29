import { SvelteMap } from 'svelte/reactivity';

/** each cover picture's width over its height once it has loaded, or null when it failed to */
const shapes = new SvelteMap<string, number | null>();
const loading = new Map<string, Promise<number | null>>();

/** Loads and decodes a cover ahead of time, so the open book never has to wait for it mid-flight. */
export function preloadCover(url: string): Promise<number | null> {
  let promise = loading.get(url);
  if (!promise) {
    const image = new Image();
    image.src = url;
    promise = image.decode().then(
      () => image.naturalWidth / image.naturalHeight,
      () => null
    );
    promise.then((shape) => shapes.set(url, shape));
    loading.set(url, promise);
  }
  return promise;
}

/** the cover's shape, null when it can't be loaded, or undefined while that isn't known yet */
export function coverShape(url: string | undefined): number | null | undefined {
  return url === undefined ? undefined : shapes.get(url);
}
