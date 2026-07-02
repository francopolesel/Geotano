/**
 * Resize an image file to fit within `maxDimension` px and compress to
 * a JPEG with the given `quality`. Returns a base64 data URI.
 *
 * The user should NEVER see a size-limit error — this runs silently
 * on the client before upload.
 */
export function resizeImage(
  file: File,
  maxDimension = 400,
  quality = 0.7,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Downscale if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Output as JPEG with the given quality
      const dataUri = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUri);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
