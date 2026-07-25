/**
 * Browsers only honor the HTML `download` attribute for same-origin (or
 * blob:/data:) URLs — for a cross-origin URL like a Cloudinary asset, it's
 * silently ignored and the link just navigates the current tab to the image
 * instead of downloading it. Cloudinary's `fl_attachment` flag makes it
 * respond with a real `Content-Disposition: attachment` header, which forces
 * an actual download regardless of origin.
 */
export function toDownloadUrl(url: string): string {
  return url.replace("/upload/", "/upload/fl_attachment/");
}
