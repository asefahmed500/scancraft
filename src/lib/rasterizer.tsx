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
  Image as SkiaImage,
  ImageFormat,
  makeImageFromView,
  useImage,
} from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { cacheDirUri, ensureCacheDir, safeDeleteCacheFile } from './storage';

export type RasterizeRequest = {
  uri: string;
  matrix: number[] | null;
  maxDim: number;
  quality: number;
  format: 'jpg' | 'png';
};

export type RasterizerHandle = {
  rasterize: (req: RasterizeRequest) => Promise<{ uri: string; width: number; height: number }>;
};

type PendingRequest = RasterizeRequest & {
  resolve: (r: { uri: string; width: number; height: number }) => void;
  reject: (e: Error) => void;
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

// Exports are rasterized through a hidden, declarative <Canvas> — the same
// rendering path as the on-screen filter preview — then snapshotted. The
// imperative offscreen Surface path produces black frames on some devices,
// so it is deliberately not used.
export function ImageRasterizerProvider({ children }: { children: ReactNode }) {
  const viewRef = useRef<View>(null);
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const image = useImage(request?.uri ?? null);

  const rasterize = useCallback(
    (req: RasterizeRequest) =>
      new Promise<{ uri: string; width: number; height: number }>((resolve, reject) => {
        setRequest({ ...req, resolve, reject });
      }),
    [],
  );

  const handle = useMemo<RasterizerHandle>(() => ({ rasterize }), [rasterize]);

  useEffect(() => {
    registerRasterizer(handle);
    return () => registerRasterizer(null);
  }, [handle]);

  // Size the canvas to the decoded image, capped at maxDim — derived
  // during render, no effect needed.
  const dims = useMemo(() => {
    if (!request || !image) return null;
    const iw = image.width();
    const ih = image.height();
    const scale = Math.min(1, request.maxDim / Math.max(iw, ih));
    return {
      w: Math.max(1, Math.round(iw * scale)),
      h: Math.max(1, Math.round(ih * scale)),
    };
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
        const bytes = snapshot.encodeToBytes(
          req.format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG,
          Math.round(req.quality * 100),
        );
        ensureCacheDir();
        const out = new File(
          cacheDirUri(),
          `scancraft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${req.format}`,
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
            <SkiaImage image={image} fit="fill" x={0} y={0} width={dims.w} height={dims.h}>
              {request.matrix ? <ColorMatrix matrix={request.matrix} /> : null}
            </SkiaImage>
          </Canvas>
        )}
      </View>
    </RasterizerContext.Provider>
  );
}
