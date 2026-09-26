import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { ScreenHeader } from '@/components/screen-header';
import { GradientButton } from '@/components/gradient-button';
import { useSession } from '@/lib/session';
import { FILTER_PRESETS, matrixFor } from '@/lib/filters';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { Adjustments } from '@/lib/types';

const THUMB_W = 64;
const THUMB_H = 84;

export default function FilterScreen() {
  const { pages, filterId, adjustments, setFilterId, setAdjustments } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  // Slider drags update this local draft (big preview only); the session
  // context — and therefore the thumbnails — update once on release.
  const [draft, setDraft] = useState<Adjustments | null>(null);

  const previewUri = pages[0]?.uri;
  const image = useImage(previewUri ?? null);

  useEffect(() => {
    if (pages.length === 0) {
      router.replace('/');
    }
  }, [pages.length]);

  const activeAdj = draft ?? adjustments;
  const matrix = useMemo(() => matrixFor(filterId, activeAdj), [filterId, activeAdj]);
  const thumbMatrices = useMemo(
    () => FILTER_PRESETS.map((preset) => matrixFor(preset.id, adjustments)),
    [adjustments],
  );

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ w: width, h: height });
  };

  const draftAdj = (key: keyof Adjustments, value: number): Adjustments => ({
    ...(draft ?? adjustments),
    [key]: value,
  });

  if (pages.length === 0) {
    return <View style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Filter & enhance"
        onBack={() => router.back()}
        style={styles.header}
        right={
          <Text style={[type.caption, styles.pageCount]}>
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </Text>
        }
      />

      <View style={styles.preview} onLayout={onCanvasLayout}>
        {image && canvasSize.w > 0 && (
          <Canvas style={StyleSheet.absoluteFill}>
            <SkiaImage
              image={image}
              fit="contain"
              x={0}
              y={0}
              width={canvasSize.w}
              height={canvasSize.h}>
              <ColorMatrix matrix={matrix} />
            </SkiaImage>
          </Canvas>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filtersContent}>
        {FILTER_PRESETS.map((preset, i) => {
          const active = preset.id === filterId;
          return (
            <Pressable
              key={preset.id}
              style={({ pressed }) => [styles.filterItem, pressed && styles.pressed]}
              onPress={() => setFilterId(preset.id)}>
              <View style={[styles.filterThumbWrap, active && styles.filterThumbActive]}>
                {image && (
                  <Canvas style={styles.filterThumbCanvas}>
                    <SkiaImage
                      image={image}
                      fit="cover"
                      x={0}
                      y={0}
                      width={THUMB_W}
                      height={THUMB_H}>
                      <ColorMatrix matrix={thumbMatrices[i]} />
                    </SkiaImage>
                  </Canvas>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  type.caption,
                  active ? styles.filterLabelActive : styles.filterLabel,
                ]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.adjustSection}>
        <Pressable
          style={({ pressed }) => [styles.adjustToggle, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Toggle adjustments"
          accessibilityState={{ expanded }}
          hitSlop={4}
          onPress={() => setExpanded((v) => !v)}>
          <Text style={[type.label, styles.adjustToggleText]}>
            Adjust
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
        {expanded && (
          <View style={styles.sliders}>
            <SliderRow
              label="Brightness"
              value={activeAdj.brightness}
              min={0.6}
              max={1.4}
              onChange={(v) => setDraft(draftAdj('brightness', v))}
              onCommit={(v) => {
                setDraft(null);
                setAdjustments(draftAdj('brightness', v));
              }}
            />
            <SliderRow
              label="Contrast"
              value={activeAdj.contrast}
              min={0.6}
              max={1.4}
              onChange={(v) => setDraft(draftAdj('contrast', v))}
              onCommit={(v) => {
                setDraft(null);
                setAdjustments(draftAdj('contrast', v));
              }}
            />
            <SliderRow
              label="Saturation"
              value={activeAdj.saturation}
              min={0}
              max={2}
              onChange={(v) => setDraft(draftAdj('saturation', v))}
              onCommit={(v) => {
                setDraft(null);
                setAdjustments(draftAdj('saturation', v));
              }}
            />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <GradientButton label="Continue" onPress={() => router.replace('/pages')} style={styles.primary} />
      </View>
    </SafeAreaView>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={[type.label, styles.sliderLabel]}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onChange}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
      <Text style={[type.caption, styles.sliderValue]}>{value.toFixed(2)}</Text>
    </View>
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
  pageCount: {
    color: colors.textSecondary,
  },
  preview: {
    flex: 1,
    marginHorizontal: spacing.m,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: colors.bgInset,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersRow: {
    marginTop: spacing.m,
    flexGrow: 0,
  },
  filtersContent: {
    paddingHorizontal: spacing.m,
    gap: spacing.m,
  },
  filterItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterThumbWrap: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: radius.s,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgInset,
  },
  filterThumbActive: {
    borderColor: colors.accent,
  },
  filterThumbCanvas: {
    width: THUMB_W,
    height: THUMB_H,
  },
  filterLabel: {
    color: colors.textSecondary,
  },
  filterLabelActive: {
    color: colors.accent,
  },
  adjustSection: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  adjustToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  adjustToggleText: {
    color: colors.text,
  },
  sliders: {
    gap: spacing.xs,
    paddingBottom: spacing.s,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  sliderLabel: {
    color: colors.text,
    width: 80,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  sliderValue: {
    color: colors.textSecondary,
    width: 36,
    textAlign: 'right',
  },
  footer: {
    padding: spacing.m,
  },
  primary: {
    minHeight: 48,
    borderRadius: radius.m,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
