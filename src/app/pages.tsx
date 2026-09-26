import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSession } from '@/lib/session';
import { cropRotate, downscaleIfNeeded, makeThumb, EDIT_MAX_DIM } from '@/lib/imaging';
import { safeDeleteCacheFile } from '@/lib/storage';
import { ScreenHeader } from '@/components/screen-header';
import { GradientButton } from '@/components/gradient-button';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { SessionPage } from '@/lib/types';

export default function PagesScreen() {
  const { pages, removePage, movePage, replacePage } = useSession();
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const rotatingRef = useRef(false);

  useEffect(() => {
    if (pages.length === 0) {
      router.replace('/');
    }
  }, [pages.length]);

  const onRotate = async (page: SessionPage) => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    setRotatingId(page.id);
    try {
      const src = await downscaleIfNeeded(page.uri, page.width, page.height, EDIT_MAX_DIM);
      const result = await cropRotate(src, null, 90);
      safeDeleteCacheFile(page.uri);
      if (src !== page.uri) safeDeleteCacheFile(src);
      let thumb = page.thumb;
      try {
        thumb = await makeThumb(result.uri);
      } catch {
        // keep previous thumb
      }
      replacePage(page.id, { ...page, uri: result.uri, width: result.width, height: result.height, thumb });
    } catch {
      Alert.alert('Rotate failed', 'The page could not be rotated. Please try again.');
    } finally {
      rotatingRef.current = false;
      setRotatingId(null);
    }
  };

  const onRecrop = (page: SessionPage) => {
    router.push({
      pathname: '/review',
      params: { uri: page.uri, width: String(page.width), height: String(page.height), pageId: page.id },
    });
  };

  const onDelete = (page: SessionPage) => {
    Alert.alert('Delete page?', 'This page will be removed from the current session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removePage(page.id) },
    ]);
  };

  if (pages.length === 0) {
    return <View style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Pages" onBack={() => router.back()} style={styles.header} />
      <ScrollView contentContainerStyle={styles.list}>
        {pages.map((page, index) => (
          <View key={page.id} style={styles.row}>
            <Image source={{ uri: page.thumb ?? page.uri }} style={styles.thumb} contentFit="cover" />
            <View style={styles.info}>
              <Text style={[type.label]}>Page {index + 1}</Text>
              <Text style={[type.caption, styles.caption]}>
                {page.width} × {page.height}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  hitSlop={8}
                  disabled={index === 0 || rotatingId !== null}
                  onPress={() => movePage(page.id, -1)}
                  accessibilityRole="button"
                  accessibilityLabel="Move page up"
                  style={({ pressed }) => [styles.action, pressed && styles.pressed, (index === 0 || rotatingId !== null) && styles.disabled]}>
                  <Ionicons name="arrow-up" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  disabled={index === pages.length - 1 || rotatingId !== null}
                  onPress={() => movePage(page.id, 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Move page down"
                  style={({ pressed }) => [styles.action, pressed && styles.pressed, (index === pages.length - 1 || rotatingId !== null) && styles.disabled]}>
                  <Ionicons name="arrow-down" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => onRotate(page)}
                  accessibilityRole="button"
                  accessibilityLabel="Rotate page"
                  disabled={rotatingId !== null}
                  style={({ pressed }) => [styles.action, rotatingId !== null && styles.disabled, pressed && styles.pressed]}>
                  {rotatingId === page.id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="sync-outline" size={18} color={colors.text} />
                  )}
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => onRecrop(page)}
                  accessibilityRole="button"
                  accessibilityLabel="Re-crop page"
                  disabled={rotatingId !== null}
                  style={({ pressed }) => [styles.action, rotatingId !== null && styles.disabled, pressed && styles.pressed]}>
                  <Ionicons name="crop-outline" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => onDelete(page)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete page"
                  disabled={rotatingId !== null}
                  style={({ pressed }) => [styles.action, rotatingId !== null && styles.disabled, pressed && styles.pressed]}>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        <Text style={[type.caption, styles.pageCount]}>
          {pages.length} {pages.length === 1 ? 'page' : 'pages'} in this session
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton
          label="Filters"
          icon="color-filter-outline"
          onPress={() => router.push('/filter')}
          variant="ghost"
          style={styles.ghostBtn}
        />
        <GradientButton
          label="Add"
          icon="add"
          onPress={() => router.push('/capture')}
          variant="ghost"
          style={styles.ghostBtn}
        />
        <GradientButton label="Continue to export" onPress={() => router.push('/export')} style={styles.primary} />
      </View>
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
  pressed: {
    opacity: 0.6,
  },
  list: {
    padding: spacing.m,
    gap: spacing.m,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.s,
    alignItems: 'center',
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: radius.s,
    backgroundColor: colors.bgInset,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  caption: {
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.m,
    marginTop: spacing.s,
  },
  action: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
  },
  disabled: {
    opacity: 0.3,
  },
  pageCount: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.s,
    padding: spacing.m,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
});
