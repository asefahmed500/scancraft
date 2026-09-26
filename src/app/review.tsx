import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { GradientButton } from '@/components/gradient-button';import { useSession } from '@/lib/session';
import { cropRotate, downscaleIfNeeded, makeThumb, EDIT_MAX_DIM } from '@/lib/imaging';
import { safeDeleteCacheFile } from '@/lib/storage';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { CropRect } from '@/lib/types';

const HANDLE = 22;
const HIT_SLOP = 13;
const MIN_CROP = 48;
const STAGE_PAD = 16;

type Rect = { x: number; y: number; w: number; h: number };

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v ?? '');
}

export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    width: string;
    height: string;
    pageId?: string;
  }>();
  const { pages, addPage, replacePage } = useSession();

  const [uri, setUri] = useState(asString(params.uri));
  const [nat, setNat] = useState({
    w: Number(asString(params.width)),
    h: Number(asString(params.height)),
  });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  // Files produced by this screen's own rotate/crop steps — only these may
  // be deleted on the next step. params.uri belongs to the session page.
  const ownedUriRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Backing out mid-edit leaks the rotate intermediate — sweep it.
      if (ownedUriRef.current) safeDeleteCacheFile(ownedUriRef.current);
    };
  }, []);

  // Crop selection is an axis-aligned bounding box (display coords):
  // u0/u1 = left/right edges, v0/v1 = top/bottom edges.
  const u0 = useSharedValue(0);
  const u1 = useSharedValue(0);
  const v0 = useSharedValue(0);
  const v1 = useSharedValue(0);

  const rect: Rect | null = useMemo(() => {
    if (stage.w <= STAGE_PAD * 2 || stage.h <= STAGE_PAD * 2 || !nat.w || !nat.h) return null;
    const scale = Math.min((stage.w - STAGE_PAD * 2) / nat.w, (stage.h - STAGE_PAD * 2) / nat.h);
    const w = nat.w * scale;
    const h = nat.h * scale;
    return { x: (stage.w - w) / 2, y: (stage.h - h) / 2, w, h };
  }, [stage, nat]);

  const computeRect = (w: number, h: number, nw: number, nh: number): Rect | null => {
    if (w <= STAGE_PAD * 2 || h <= STAGE_PAD * 2 || !nw || !nh) return null;
    const scale = Math.min((w - STAGE_PAD * 2) / nw, (h - STAGE_PAD * 2) / nh);
    const rw = nw * scale;
    const rh = nh * scale;
    return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
  };

  const applyCorners = useCallback(
    (r: Rect) => {
      const inset = 0.08;
      u0.value = r.x + r.w * inset;
      v0.value = r.y + r.h * inset;
      u1.value = r.x + r.w * (1 - inset);
      v1.value = r.y + r.h * (1 - inset);
      setReady(true);
    },
    [u0, v0, u1, v1],
  );

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
    // Initialize corners synchronously with this layout — an effect would
    // paint one frame of uninitialized (all-zero) overlays first.
    const r = computeRect(width, height, nat.w, nat.h);
    if (r) applyCorners(r);
  };

  // Each corner maps to two bbox edges; clamps keep u0 < u1 and v0 < v1,
  // so a self-intersecting selection is impossible and the crop always
  // matches what is on screen.
  const gestures = useMemo(() => {
    const makePan = (
      a: SharedValue<number>,
      aBounds: () => [number, number],
      b: SharedValue<number>,
      bBounds: () => [number, number],
    ) => {
      const start = { a: 0, b: 0 };
      return Gesture.Pan()
        .onBegin(() => {
          start.a = a.value;
          start.b = b.value;
        })
        .onUpdate((e) => {
          const [aMin, aMax] = aBounds();
          const [bMin, bMax] = bBounds();
          a.value = Math.min(Math.max(start.a + e.translationX, aMin), aMax);
          b.value = Math.min(Math.max(start.b + e.translationY, bMin), bMax);
        });
    };
    if (!rect) return null;
    // a = horizontal edge, b = vertical edge
    return {
      tl: makePan(
        u0,
        () => [rect.x, Math.max(rect.x, u1.value - MIN_CROP)],
        v0,
        () => [rect.y, Math.max(rect.y, v1.value - MIN_CROP)],
      ),
      tr: makePan(
        u1,
        () => [Math.min(rect.x + rect.w, u0.value + MIN_CROP), rect.x + rect.w],
        v0,
        () => [rect.y, Math.max(rect.y, v1.value - MIN_CROP)],
      ),
      bl: makePan(
        u0,
        () => [rect.x, Math.max(rect.x, u1.value - MIN_CROP)],
        v1,
        () => [Math.min(rect.y + rect.h, v0.value + MIN_CROP), rect.y + rect.h],
      ),
      br: makePan(
        u1,
        () => [Math.min(rect.x + rect.w, u0.value + MIN_CROP), rect.x + rect.w],
        v1,
        () => [Math.min(rect.y + rect.h, v0.value + MIN_CROP), rect.y + rect.h],
      ),
    };
  }, [rect, u0, u1, v0, v1]);

  const tlStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: u0.value - HANDLE / 2 }, { translateY: v0.value - HANDLE / 2 }],
  }));
  const trStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: u1.value - HANDLE / 2 }, { translateY: v0.value - HANDLE / 2 }],
  }));
  const blStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: u0.value - HANDLE / 2 }, { translateY: v1.value - HANDLE / 2 }],
  }));
  const brStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: u1.value - HANDLE / 2 }, { translateY: v1.value - HANDLE / 2 }],
  }));

  const shadeTopStyle = useAnimatedStyle(() => {
    if (!rect) return { width: 0, height: 0 } as const;
    return {
      position: 'absolute' as const,
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: Math.max(0, v0.value - rect.y),
      backgroundColor: 'rgba(14,14,13,0.55)',
    } as const;
  });
  const shadeBottomStyle = useAnimatedStyle(() => {
    if (!rect) return { width: 0, height: 0 } as const;
    return {
      position: 'absolute' as const,
      left: rect.x,
      top: v1.value,
      width: rect.w,
      height: Math.max(0, rect.y + rect.h - v1.value),
      backgroundColor: 'rgba(14,14,13,0.55)',
    } as const;
  });
  const shadeLeftStyle = useAnimatedStyle(() => {
    if (!rect) return { width: 0, height: 0 } as const;
    return {
      position: 'absolute' as const,
      left: rect.x,
      top: v0.value,
      width: Math.max(0, u0.value - rect.x),
      height: Math.max(0, v1.value - v0.value),
      backgroundColor: 'rgba(14,14,13,0.55)',
    } as const;
  });
  const shadeRightStyle = useAnimatedStyle(() => {
    if (!rect) return { width: 0, height: 0 } as const;
    return {
      position: 'absolute' as const,
      left: u1.value,
      top: v0.value,
      width: Math.max(0, rect.x + rect.w - u1.value),
      height: Math.max(0, v1.value - v0.value),
      backgroundColor: 'rgba(14,14,13,0.55)',
    } as const;
  });
  const cropBoxStyle = useAnimatedStyle(() => {
    if (!rect) return { width: 0, height: 0 } as const;
    return {
      position: 'absolute' as const,
      left: u0.value,
      top: v0.value,
      width: Math.max(1, u1.value - u0.value),
      height: Math.max(1, v1.value - v0.value),
    } as const;
  });

  const buildCrop = (): CropRect | null => {
    if (!rect) return null;
    const x = Math.round(((u0.value - rect.x) / rect.w) * nat.w);
    const y = Math.round(((v0.value - rect.y) / rect.h) * nat.h);
    const width = Math.round(((u1.value - u0.value) / rect.w) * nat.w);
    const height = Math.round(((v1.value - v0.value) / rect.h) * nat.h);
    return {
      x: Math.max(0, Math.min(x, nat.w - 8)),
      y: Math.max(0, Math.min(y, nat.h - 8)),
      width: Math.max(8, Math.min(width, nat.w - x)),
      height: Math.max(8, Math.min(height, nat.h - y)),
    };
  };

  const onRotate = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Downscale huge captures first — editing a full 12MP bitmap can
      // exhaust memory on low-end devices.
      const src = await downscaleIfNeeded(uri, nat.w, nat.h, EDIT_MAX_DIM);
      const result = await cropRotate(src, null, 90);
      if (mountedRef.current) {
        // Only delete intermediates this screen created — in re-crop mode
        // `uri` is the live session page file and must stay until Confirm.
        if (ownedUriRef.current) safeDeleteCacheFile(ownedUriRef.current);
        if (src !== uri) safeDeleteCacheFile(src);
        ownedUriRef.current = result.uri;
        setUri(result.uri);
        setNat({ w: result.width, h: result.height });
        const r = computeRect(stage.w, stage.h, result.width, result.height);
        if (r) applyCorners(r);
      } else {
        safeDeleteCacheFile(result.uri);
      }
    } catch {
      // rotation failed — keep previous state
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let navigated = false;
    try {
      const rawCrop = buildCrop();
      if (rawCrop && (rawCrop.width < 8 || rawCrop.height < 8)) {
        busyRef.current = false;
        setBusy(false);
        Alert.alert('Selection too small', 'Drag the corner handles to select a larger area.');
        return;
      }
      const src = await downscaleIfNeeded(uri, nat.w, nat.h, EDIT_MAX_DIM);
      // Crop coordinates were computed against the original pixels —
      // rescale them if the source was downscaled.
      let crop = rawCrop;
      if (src !== uri && rawCrop) {
        const s = Math.min(1, EDIT_MAX_DIM / Math.max(nat.w, nat.h));
        crop = {
          x: Math.round(rawCrop.x * s),
          y: Math.round(rawCrop.y * s),
          width: Math.max(1, Math.round(rawCrop.width * s)),
          height: Math.max(1, Math.round(rawCrop.height * s)),
        };
      }
      const result = await cropRotate(src, crop, 0);
      if (!mountedRef.current) {
        safeDeleteCacheFile(result.uri);
        return;
      }
      if (src !== uri) safeDeleteCacheFile(src);
      let thumb: string | undefined;
      try {
        thumb = await makeThumb(result.uri);
      } catch {
        thumb = undefined; // fall back to the full image in lists
      }
      const page = {
        id: asString(params.pageId) || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        uri: result.uri,
        width: result.width,
        height: result.height,
        thumb,
      };
      // Everything below succeeded — intermediates can go.
      if (ownedUriRef.current) safeDeleteCacheFile(ownedUriRef.current);
      ownedUriRef.current = null;
      if (asString(params.pageId)) {
        safeDeleteCacheFile(uri);
        replacePage(asString(params.pageId), page);
        navigated = true;
        router.back();
      } else {
        const isFirstPage = pages.length === 0;
        addPage(page);
        navigated = true;
        // First page of a session flows into filter/enhance; later pages
        // return to the camera so the user can keep capturing.
        if (isFirstPage) {
          router.replace('/filter');
        } else {
          router.back();
        }
      }
    } catch {
      if (mountedRef.current) {
        Alert.alert('Crop failed', 'The page could not be processed. Please try again.');
        setBusy(false);
      }
      busyRef.current = false;
    } finally {
      if (navigated) {
        // Safety net: if navigation did not unmount us (deep link / state
        // restore), un-stick the busy state so the screen is not bricked.
        setTimeout(() => {
          if (mountedRef.current && busyRef.current) {
            busyRef.current = false;
            setBusy(false);
          }
        }, 1200);
      }
    }
  };

  const invalid = !uri || !nat.w || !nat.h;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={asString(params.pageId) ? 'Re-crop page' : 'Adjust crop'}
        onBack={() => router.back()}
        backDisabled={busy}
        style={styles.header}
      />
      {invalid ? (
        <View style={styles.invalid}>
          <Text style={[type.body, styles.invalidText]}>
            Nothing to crop. Go back and capture a page first.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.stage} onLayout={onStageLayout}>
            {rect && (
              <Image
                source={{ uri }}
                style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                contentFit="fill"
              />
            )}
            {rect && gestures && ready && (
              <>
                <Animated.View style={shadeTopStyle} pointerEvents="none" />
                <Animated.View style={shadeBottomStyle} pointerEvents="none" />
                <Animated.View style={shadeLeftStyle} pointerEvents="none" />
                <Animated.View style={shadeRightStyle} pointerEvents="none" />
                <Animated.View style={[cropBoxStyle, styles.cropBox]} pointerEvents="none">
                  <View style={styles.gridV1} />
                  <View style={styles.gridV2} />
                  <View style={styles.gridH1} />
                  <View style={styles.gridH2} />
                </Animated.View>
                <GestureDetector gesture={gestures.tl}>
                  <Animated.View style={[tlStyle, styles.handle]} hitSlop={HIT_SLOP} />
                </GestureDetector>
                <GestureDetector gesture={gestures.tr}>
                  <Animated.View style={[trStyle, styles.handle]} hitSlop={HIT_SLOP} />
                </GestureDetector>
                <GestureDetector gesture={gestures.bl}>
                  <Animated.View style={[blStyle, styles.handle]} hitSlop={HIT_SLOP} />
                </GestureDetector>
                <GestureDetector gesture={gestures.br}>
                  <Animated.View style={[brStyle, styles.handle]} hitSlop={HIT_SLOP} />
                </GestureDetector>
              </>
            )}
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[type.body, styles.busyText]}>Processing…</Text>
              </View>
            )}
          </View>
      <View style={styles.controls}>
        <GradientButton
          label="Retake"
          icon="refresh"
          onPress={() => router.back()}
          disabled={busy}
          variant="ghost"
          style={styles.ghostBtn}
        />
        <GradientButton
          label="Rotate"
          icon="sync-outline"
          onPress={onRotate}
          disabled={busy}
          variant="ghost"
          style={styles.ghostBtn}
        />
        <GradientButton
          label={asString(params.pageId) ? 'Update page' : 'Confirm'}
          onPress={onConfirm}
          disabled={busy}
          busy={busy}
          style={styles.primary}
        />
      </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  invalid: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  invalidText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stage: {
    flex: 1,
    backgroundColor: colors.cameraStage,
    overflow: 'hidden',
  },
  cropBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  gridV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
  },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,20,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  busyText: {
    color: colors.white,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.m,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ghostText: {
    color: colors.text,
  },
  ghostBtn: {
    paddingHorizontal: 8,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.m,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.white,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
