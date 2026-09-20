import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { deleteDocuments, loadIndex, loadSettings, safeDeleteCacheFile } from '@/lib/storage';
import { buildPdf } from '@/lib/imaging';
import { GradientButton } from '@/components/gradient-button';
import { LogoReveal } from '@/components/logo-reveal';
import { colors, fonts, radius, spacing, type } from '@/lib/theme';
import type { StoredDocument } from '@/lib/types';

type SortMode = 'recent' | 'name';

export default function LibraryScreen() {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const insets = useSafeAreaInsets();

  const reload = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const list = await loadIndex();
    setDocs(list);
    setLoaded(true);
    if (showSpinner) setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      setSelected([]);
      setQuery('');
      let active = true;
      loadSettings().then((s) => {
        if (!active) return;
        if (!s.onboarded) {
          router.replace('/onboarding');
        } else {
          setChecked(true);
        }
      });
      return () => {
        active = false;
      };
    }, [reload]),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? docs.filter((d) => d.name.toLowerCase().includes(q))
      : docs;
    const sorted = [...filtered];
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [docs, query, sort]);

  const selecting = selected.length > 0;

  if (!checked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.checkGate}>
          <LogoReveal animate={false} size={48} />
        </View>
      </SafeAreaView>
    );
  }

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const exitSelection = () => setSelected([]);

  const onDeleteSelected = () => {
    Alert.alert(
      selected.length === 1 ? 'Delete document?' : `Delete ${selected.length} documents?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            try {
              const { deleted, failed } = await deleteDocuments(selected);
              if (failed > 0) {
                Alert.alert(
                  'Delete failed',
                  failed === deleted + failed
                    ? 'The documents could not be deleted.'
                    : `${failed} of ${deleted + failed} could not be deleted.`,
                );
              }
            } catch {
              Alert.alert('Delete failed', 'Something went wrong. Please try again.');
            } finally {
              setSelected([]);
              await reload().catch(() => {});
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onExportSelected = async () => {
    if (busy || selected.length === 0) return;
    setBusy(true);
    let pdfUri: string | null = null;
    try {
      // Export in the order the user sees on screen.
      const picked = visible.filter((d) => selected.includes(d.id));
      const pageUris = picked.flatMap((d) => d.pages);
      pdfUri = await buildPdf(pageUris);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'ScanCraft.pdf',
        });
      } else {
        Alert.alert(
          'Sharing unavailable',
          'This device cannot show a share sheet, so the PDF could not be delivered.',
        );
      }
    } catch {
      Alert.alert('Export failed', 'The combined PDF could not be created.');
    } finally {
      if (pdfUri) safeDeleteCacheFile(pdfUri);
      setBusy(false);
    }
  };

  const renderItem = ({ item }: { item: StoredDocument }) => {
    const isSelected = selected.includes(item.id);
    const date = new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isSelected && styles.cardSelected,
          pressed && styles.cardPressed,
        ]}
        onPress={() => {
          if (selecting) {
            toggleSelect(item.id);
          } else {
            router.push(`/document/${item.id}`);
          }
        }}
        onLongPress={
          selecting
            ? undefined
            : () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setSelected([item.id]);
              }
        }
        delayLongPress={280}>
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: item.pages[0]?.thumb || item.pages[0]?.file }}
            style={styles.thumb}
            contentFit="cover"
            transition={120}
          />
          {item.pages.length > 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.pages.length}</Text>
            </View>
          )}
          {selecting && (
            <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
              <Ionicons
                name={isSelected ? 'checkmark' : 'ellipsis-horizontal'}
                size={isSelected ? 14 : 12}
                color={colors.white}
              />
            </View>
          )}
        </View>
        <Text style={[type.label, styles.cardTitle]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[type.caption, styles.cardCaption]}>
          {item.pages.length} {item.pages.length === 1 ? 'page' : 'pages'} · {date}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {selecting ? (
        <View style={styles.header}>
          <Pressable
            hitSlop={12}
            onPress={exitSelection}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={[type.h2, styles.selectTitle]}>{selected.length} selected</Text>
          <Pressable
            hitSlop={12}
            disabled={busy}
            onPress={onExportSelected}
            style={({ pressed }) => [styles.iconButton, busy && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="share-outline" size={21} color={colors.text} />
          </Pressable>
          <Pressable
            hitSlop={12}
            disabled={busy}
            onPress={onDeleteSelected}
            style={({ pressed }) => [styles.iconButton, busy && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={[type.h1]}>ScanCraft</Text>
          <Link href="/settings" asChild>
            <Pressable hitSlop={12} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </Link>
        </View>
      )}

      {!selecting && (docs.length > 0 || query.length > 0) && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[type.body, styles.searchInput]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search scans"
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSort((s) => (s === 'recent' ? 'name' : 'recent'));
            }}>
            <Ionicons
              name={sort === 'recent' ? 'time-outline' : 'text-outline'}
              size={15}
              color={colors.text}
            />
            <Text style={[type.caption, styles.sortText]}>
              {sort === 'recent' ? 'Recent' : 'A–Z'}
            </Text>
          </Pressable>
        </View>
      )}

      {!loaded ? null : docs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
          </View>
          <Text style={[type.display, styles.emptyTitle]}>Nothing scanned yet</Text>
          <Text style={[type.body, styles.emptyHint]}>
            Scan documents with your camera and save them as PDF or images.
          </Text>
          <GradientButton
            label="Scan your first document"
            icon="scan-outline"
            onPress={() => router.push('/capture')}
            style={styles.cta}
          />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.body, styles.emptyHint]}>No scans match “{query.trim()}”.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => reload(true)}
              tintColor={colors.textTertiary}
            />
          }
        />
      )}

      {!selecting && docs.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            { bottom: spacing.l + insets.bottom },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/capture')}
          accessibilityLabel="Scan a document">
          <Ionicons name="scan-outline" size={26} color={colors.white} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  checkGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
    gap: spacing.s,
  },
  selectTitle: {
    flex: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.s,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    height: 40,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    color: colors.text,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    height: 40,
  },
  sortText: {
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.m,
    paddingBottom: 96,
    gap: spacing.m,
  },
  column: {
    gap: spacing.m,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.s,
  },
  cardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  thumbWrap: {
    aspectRatio: 3 / 4,
    borderRadius: radius.s,
    overflow: 'hidden',
    backgroundColor: colors.bgInset,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(20,20,20,0.75)',
    borderRadius: radius.s,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: fonts.label,
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(20,20,20,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cardTitle: {
    color: colors.text,
    marginTop: spacing.s,
  },
  cardCaption: {
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.l,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  emptyHint: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.accent,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    minHeight: 48,
  },
  ctaText: {
    color: colors.white,
  },
  fab: {
    position: 'absolute',
    right: spacing.l,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141414',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
