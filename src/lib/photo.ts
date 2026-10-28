/** the longest side a cover photo is sent at; prismify shrinks it further */
const MAX_SIDE = 1400;

/**
 * Turns a phone photo upright and shrinks it to a JPEG small enough to upload, as cameras
 * take photos many times bigger than a cover needs.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('That photo can’t be read'))),
      'image/jpeg',
      0.88
    )
  );
}
