/**
 * Downscales + recompresses a photo in the browser before upload. A few
 * customer photos (e.g. high-entropy textures like dirt/gravel) compress
 * far worse than typical photos at the same resolution — the file can be
 * large enough to hit an infrastructure-level payload/size limit that fails
 * before our own error handling even runs, showing up as an unexplained 500.
 * Shrinking client-side avoids that regardless of the exact limit, and
 * speeds up uploads on slow mobile networks either way.
 *
 * HEIC can't be decoded via the browser's <img> tag on most non-Safari
 * browsers, so this quietly passes those files through unchanged — they
 * still work via the server-side Cloudinary conversion, just without this
 * extra client-side shrink.
 */
export async function compressImageForUpload(
  file: File,
  maxDimension = 1920,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        resolve(file);
        return;
      }
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}
