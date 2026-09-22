import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  ImageFormat,
  makeImageFromView,
  useImage,
} from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { cacheDirUri, ensureCacheDir, safeDeleteCacheFile } from './storage';

export type LookRequest = {
  kind: 'look';
  uri: string;
  matrix: number[] | null;
  maxDim: number;
  quality: number;
  format: 'jpg' | 'png';
};

export type CropRequest = {
  kind: 'crop';
  uri: string;
  rect: { x: number; y: number; width: number; height: number } | null;
  rotation: number;
  quality: number;
};

export type RasterizeRequest = LookRequest | CropRequest;

export type ImageResult = { uri: string; width: number; height: number };

type Pending = (LookRequest | CropRequest) & {
  resolve: (r: ImageResult) => void;
  reject: (e: Error) => void;
};

const RASTERIZE_TIMEOUT_MS = 15000;

export type RasterizerHandle = {
  rasterize: (req: LookRequest) => Promise<ImageResult>;
  crop: (req: CropRequest) => Promise<ImageResult>;
};

let activeRasterizer: RasterizerHandle | null = null;

export function registerRasterizer(handle: RasterizerHandle | null): void {
  activeRasterizer = handle;
}

export function getRasterizer(): RasterizerHandle {
  if (!activeRasterizer) {
    throw new Error('Image engine not ready — please try again.');
  }
  return activeRasterizer;
}

const RasterizerContext = createContext<RasterizerHandle | null>(null);

export function useRasterizer(): RasterizerHandle {
  const value = useContext(RasterizerContext);
  if (!value) throw new Error('useRasterizer must be used inside ImageRasterizerProvider');
  return value;
}

function withTimeout(promise: Promise<ImageResult>): Promise<ImageResult> {
  return Promise.race([
    promise,
    new Promise<ImageResult>((_, reject) =>
      setTimeout(() => reject(new Error('Image processing timed out. Try again.')), RASTERIZE_TIMEOUT_MS),
    ),
  ]);
}

// All image processing is rasterized through a hidden, declarative <Canvas> —
// the same rendering path as the on-screen filter preview — then snapshotted.
// The imperative offscreen Surface path produces black frames on some devices,
// and ImageManipulator crop/rotate can natively crash on EXIF-rotated camera
// photos, so neither is used.
export function ImageRasterizerProvider({ children }: { children: ReactNode }) {
  const viewRef = useRef<View>(null);
  const [request, setRequest] = useState<Pending | null>(null);
  const image = useImage(request?.uri ?? null);

  const run = useCallback(
    (req: RasterizeRequest) =>
      withTimeout(
        new Promise<ImageResult>((resolve, reject) => {
          setRequest({ ...req, resolve, reject });
        }),
      ),
    [],
  );

  const handle = useMemo<RasterizerHandle>(
    () => ({
      rasterize: (req: LookRequest) => run(req),
      crop: (req: CropRequest) => run(req),
    }),
    [run],
  );

  useEffect(() => {
    registerRasterizer(handle);
    return () => registerRasterizer(null);
  }, [handle]);

  // Output geometry, derived during render (no effects for state).
  const { dims, rect, rotation } = useMemo(() => {
    if (!request || !image) return { dims: null, rect: null, rotation: 0 };
    const iw = image.width();
    const ih = image.height();
    if (request.kind === 'look') {
      const scale = Math.min(1, request.maxDim / Math.max(iw, ih));
      return {
        dims: { w: Math.max(1, Math.round(iw * scale)), h: Math.max(1, Math.round(ih * scale)) },
        rect: null,
        rotation: 0,
      };
    }
    const r = request.rect ?? { x: 0, y: 0, width: iw, height: ih };
    const rot = ((Math.round(request.rotation) % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    return {
      dims: {
        w: Math.max(1, Math.round(swap ? r.height : r.width)),
        h: Math.max(1, Math.round(swap ? r.width : r.height)),
      },
      rect: r,
      rotation: rot,
    };
  }, [request, image]);

  // Decode-failure path: if the image never loads, fail fast with a useful
  // message instead of waiting for the generic timeout.
  useEffect(() => {
    if (!request || image) return;
    const t = setTimeout(() => {
      request.reject(new Error("We couldn't read this image. Try retaking the page."));
    }, 6000);
    return () => clearTimeout(t);
  }, [request, image]);

  // Once painted, snapshot the hidden view and persist the bytes.
  useEffect(() => {
    if (!request || !image || !dims) return;
    let cancelled = false;
    (async () => {
      const req = request;
      try {
        // Wait two frames so the Canvas has definitely painted.
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
        if (cancelled) return;
        const snapshot = await makeImageFromView(viewRef);
        if (!snapshot) throw new Error('Could not capture the rendered image');
        const format = req.kind === 'look' ? req.format : 'jpg';
        const quality = req.kind === 'look' ? req.quality : req.quality;
        const bytes = snapshot.encodeToBytes(
          format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG,
          Math.round(quality * 100),
        );
        ensureCacheDir();
        const out = new File(
          cacheDirUri(),
          `scancraft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`,
        );
        out.write(bytes);
        const result = { uri: out.uri, width: dims.w, height: dims.h };
        if (cancelled) {
          safeDeleteCacheFile(result.uri);
          return;
        }
        req.resolve(result);
      } catch (error) {
        req.reject(error instanceof Error ? error : new Error('Could not process image'));
      } finally {
        if (!cancelled) {
          setRequest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, image, dims]);

  return (
    <RasterizerContext.Provider value={handle}>
      {children}
      <View
        ref={viewRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: dims?.w ?? 1,
          height: dims?.h ?? 1,
          zIndex: -1,
          backgroundColor: '#FFFFFF',
        }}>
        {request && image && dims && (
          <Canvas style={{ width: dims.w, height: dims.h }}>
            {request.kind === 'look' ? (
              <SkiaImage image={image} fit="fill" x={0} y={0} width={dims.w} height={dims.h}>
                {request.matrix ? <ColorMatrix matrix={request.matrix} /> : null}
              </SkiaImage>
            ) : (
              <Group
                transform={[
                  ...(rotation === 90
                    ? [{ translate: [dims.w, 0] as [number, number] }, { rotate: Math.PI / 2 }]
                    : rotation === 180
                      ? [{ translate: [dims.w, dims.h] as [number, number] }, { rotate: Math.PI }]
                      : rotation === 270
                        ? [{ translate: [0, dims.h] as [number, number] }, { rotate: -Math.PI / 2 }]
                        : []),
                  { translate: [-(rect?.x ?? 0), -(rect?.y ?? 0)] as [number, number] },
                ]}>
                <SkiaImage
                  image={image}
                  fit="none"
                  x={0}
                  y={0}
                  width={image.width()}
                  height={image.height()}
                />
              </Group>
            )}
          </Canvas>
        )}
      </View>
    </RasterizerContext.Provider>
  );
}
