import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/screen-header';
import { GradientButton } from '@/components/gradient-button';
import { loadIndex, safeDeleteCacheFile, setFavorite, softDeleteDocuments } from '@/lib/storage';
import { buildPdf } from '@/lib/imaging';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { StoredDocument } from '@/lib/types';

export default function DocumentScreen() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [doc, setDoc] = useState<StoredDocument | null>(null);
  const [missing, setMissing] = useState(false);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadIndex().then((docs) => {
        if (!active) return;
        const found = docs.find((d) => d.id === id) ?? null;
        setDoc(found);
        setMissing(!found);
        setIndex(0);
      });
      return () => {
        active = false;
      };
    }, [id]),
  );

  const onDelete = () => {
    if (!doc) return;
    Alert.alert('Move to Recently Deleted?', `You can restore "${doc.name}" from Files.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await softDeleteDocuments([doc.id]);
            router.back();
          } catch (error) {
            Alert.alert(
              'Delete failed',
              error instanceof Error ? error.message : 'Something went wrong.',
            );
          }
        },
      },
    ]);
  };

  const onExportPdf = async () => {
    if (!doc || busy) return;
    setBusy(true);
    let pdfUri: string | null = null;
    try {
      pdfUri = await buildPdf(doc.pages);
      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `${doc.name}.pdf`,
          });
        } catch {
          // share sheet dismissed/failed — nothing else to do here
        }
      } else {
        Alert.alert(
          'Sharing unavailable',
          'This device cannot show a share sheet, so the PDF could not be delivered.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      if (pdfUri) safeDeleteCacheFile(pdfUri);
      setBusy(false);
    }
  };

  const onSavePhotos = async () => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Photo library access is required to save images.');
        return;
      }
      let saved = 0;
      for (const page of doc.pages) {
        try {
          await MediaLibrary.Asset.create(page.file);
          saved += 1;
        } catch {
          break;
        }
      }
      Alert.alert(
        'Saved',
        `${saved} of ${doc.pages.length} ${doc.pages.length === 1 ? 'image' : 'images'} saved to your photo library.`,
      );
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Not found" onBack={() => router.back()} style={styles.header} />
        <View style={styles.center}>
          <Text style={[type.body, styles.centerText]}>This document no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Loading…" onBack={() => router.back()} style={styles.header} />
        <View style={[styles.center, { padding: spacing.l }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const clampedIndex = Math.min(index, doc.pages.length - 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={doc.name}
        onBack={() => router.back()}
        style={styles.header}
        right={
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => {});
                const next = !doc.favorite;
                setDoc({ ...doc, favorite: next });
                try {
                  await setFavorite(doc.id, next);
                } catch {
                  // keep optimistic UI; persistence retried on next toggle
                }
              }}
              style={({ pressed }) => [styles.trash, pressed && styles.pressed]}>
              <Ionicons
                name={doc.favorite ? 'star' : 'star-outline'}
                size={20}
                color={doc.favorite ? colors.accent : colors.text}
              />
            </Pressable>
            <Pressable
              hitSlop={12}
              onPress={onDelete}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Move to Recently Deleted"
              style={({ pressed }) => [styles.trash, busy && styles.disabled, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </Pressable>
          </View>
        }
      />
      <FlatList
        data={doc.pages}
        horizontal
        pagingEnabled
        keyExtractor={(item) => item.file}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({
          length: windowWidth,
          offset: windowWidth * i,
          index: i,
        })}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / windowWidth));
        }}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: windowWidth }]}>
            <Image source={{ uri: item.file }} style={styles.pageImage} contentFit="contain" />
          </View>
        )}
      />
      <Text style={[type.caption, styles.counter]}>
        {clampedIndex + 1} / {doc.pages.length}
      </Text>
      <BlurView intensity={40} tint="light" style={styles.footer}>
        <GradientButton
          label="PDF"
          icon="share-outline"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onExportPdf();
          }}
          disabled={busy}
          busy={busy}
          style={styles.primary}
        />
        <GradientButton
          label="Photos"
          icon="image-outline"
          busy={busy}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onSavePhotos();
          }}
          disabled={busy}
          variant="ghost"
          style={styles.ghostBtn}
        />
      </BlurView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trash: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  page: {
    flex: 1,
    backgroundColor: colors.cameraStage,
  },
  pageImage: {
    flex: 1,
  },
  counter: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.s,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.s,
    padding: spacing.m,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  disabled: {
    opacity: 0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    color: colors.textSecondary,
  },
});
