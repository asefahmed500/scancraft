import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { PDFDocument } from 'pdf-lib';
import { File } from 'expo-file-system';
import { ensureCacheDir, cacheDirUri, safeDeleteCacheFile } from './storage';
import { getRasterizer } from './rasterizer';
import type { CropRect, QualityPreset } from './types';

export const QUALITY_PRESETS: Record<QualityPreset, { maxDim: number; quality: number }> = {
  high: { maxDim: 2480, quality: 0.92 },
  medium: { maxDim: 1600, quality: 0.8 },
  low: { maxDim: 1080, quality: 0.62 },
};

export type ImageResult = { uri: string; width: number; height: number };

// Cap before crop/rotate on huge captures — decoding a 12MP bitmap for an
// edit pass can exhaust memory on low-end devices (crop crash source).
export const EDIT_MAX_DIM = 3024;

// Crop + rotate are rasterized through the declarative Canvas pipeline
// (EXIF-consistent, crash-free) — NOT ImageManipulator, which natively
// crashes on EXIF-rotated camera photos.
export async function cropRotate(
  srcUri: string,
  crop: CropRect | null,
  rotation: number,
): Promise<ImageResult> {
  return getRasterizer().crop({
    kind: 'crop',
    uri: srcUri,
    rect: crop,
    rotation,
    quality: 0.95,
  });
}

export async function makeThumb(srcUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(srcUri).resize({ width: 480 });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  ref.release();
  return result.uri;
}

// Downscales oversized captures BEFORE an edit pass. Returns the original
// uri when no resize is needed.
export async function downscaleIfNeeded(
  srcUri: string,
  width: number,
  height: number,
  maxDim: number,
): Promise<string> {
  if (!width || !height || Math.max(width, height) <= maxDim) return srcUri;
  const targetWidth = width >= height ? maxDim : Math.max(1, Math.round((maxDim * width) / height));
  const ctx = ImageManipulator.manipulate(srcUri).resize({ width: targetWidth });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  ref.release();
  return result.uri;
}

// Applies the document look (color matrix) by rasterizing through the
// hidden declarative Canvas — the same rendering path as the on-screen
// filter preview, which is verified to work on-device.
export async function applyLook(
  srcUri: string,
  matrix: number[] | null,
  maxDim: number,
  quality: number,
  format: 'jpg' | 'png',
): Promise<ImageResult> {
  return getRasterizer().rasterize({
    kind: 'look',
    uri: srcUri,
    matrix,
    maxDim,
    quality,
    format,
  });
}

// Builds a real PDF by embedding the JPEG bytes directly with pdf-lib —
// no WebView, no HTML, no data-URI size limits. Each page is sized to the
// exact pixel dimensions of its image.
export async function buildPdf(
  pages: { file: string; width: number; height: number }[],
): Promise<string> {
  ensureCacheDir();
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const scaled = await applyLook(page.file, null, 1500, 0.8, 'jpg');
    const bytes = await new File(scaled.uri).bytes();
    safeDeleteCacheFile(scaled.uri);
    const image = await pdf.embedJpg(bytes);
    const pdfPage = pdf.addPage([image.width, image.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }
  const outBytes = await pdf.save();
  const out = new File(
    cacheDirUri(),
    `scancraft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`,
  );
  out.write(outBytes);
  return out.uri;
}
