/** the longest side a cover photo is sent at; prismify shrinks it further */
const MAX_SIDE = 1400;

/** A part of a photo, in shares of its width and height as it shows once turned. */
export type Crop = { x: number; y: number; width: number; height: number };

export const WHOLE: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Loads a photo the right way up, as cameras store it sideways with a note to turn it. */
export function loadPhoto(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** The same part of the photo before it was turned `turns` quarter turns clockwise. */
function unturn({ x, y, width, height }: Crop, turns: number): Crop {
  switch (turns % 4) {
    case 1:
      return { x: y, y: 1 - x - width, width: height, height: width };
    case 2:
      return { x: 1 - x - width, y: 1 - y - height, width, height };
    case 3:
      return { x: 1 - y - height, y: x, width: height, height: width };
    default:
      return { x, y, width, height };
  }
}

/**
 * Draws a part of the photo turned `turns` quarter turns clockwise, no longer than `maxSide`.
 * It is cut straight from the photo, so a huge one never needs a canvas as big as itself.
 */
export function drawTurned(
  bitmap: ImageBitmap,
  turns: number,
  crop: Crop,
  maxSide: number
): HTMLCanvasElement {
  const source = unturn(crop, turns);
  const sx = source.x * bitmap.width;
  const sy = source.y * bitmap.height;
  const sw = Math.max(1, source.width * bitmap.width);
  const sh = Math.max(1, source.height * bitmap.height);
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const sideways = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? dh : dw;
  canvas.height = sideways ? dw : dh;
  const context = canvas.getContext('2d');
  if (context) {
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((turns * Math.PI) / 2);
    context.drawImage(bitmap, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  }
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('That photo can’t be read'))),
      'image/jpeg',
      0.88
    )
  );
}

/**
 * Turns a phone photo upright and shrinks it to a JPEG small enough to upload, as cameras
 * take photos many times bigger than a cover needs.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await loadPhoto(file);
  const canvas = drawTurned(bitmap, 0, WHOLE, MAX_SIDE);
  bitmap.close();
  return toJpeg(canvas);
}

/** Cuts the part of the turned photo out as a JPEG small enough to upload. */
export function cropPhoto(bitmap: ImageBitmap, turns: number, crop: Crop): Promise<Blob> {
  return toJpeg(drawTurned(bitmap, turns, crop, MAX_SIDE));
}
