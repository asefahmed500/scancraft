import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/screen-header';
import {
  cacheBytes,
  clearCache,
  deleteDocument,
  formatBytes,
  libraryBytes,
  listDocumentFiles,
  type StoredDocFiles,
} from '@/lib/storage';
import { colors, fonts, radius, spacing, type } from '@/lib/theme';

const LIBRARY_BUDGET = 512 * 1024 * 1024;

export default function FilesScreen() {
  const [docs, setDocs] = useState<StoredDocFiles[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tmpBytes, setTmpBytes] = useState(0);

  const reload = useCallback(async () => {
    const list = await listDocumentFiles();
    setDocs(list);
    setTmpBytes(cacheBytes());
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onDeleteDoc = (doc: StoredDocFiles) => {
    Alert.alert('Delete document?', `"${doc.name}" and its files will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc.id);
          await reload();
        },
      },
    ]);
  };

  const onClearCache = () => {
    clearCache();
    setTmpBytes(cacheBytes());
  };

  const totalBytes = libraryBytes();
  const usage = totalBytes > 0 ? Math.min(1, totalBytes / LIBRARY_BUDGET) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Files" onBack={() => router.back()} style={styles.header} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={[type.body, styles.summaryLabel]}>
              {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            </Text>
            <Text style={[type.caption, styles.summaryValue]}>{formatBytes(totalBytes)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(usage * 100, totalBytes > 0 ? 2 : 0)}%` }]} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={[type.caption, styles.cacheLabel]}>Temporary cache</Text>
            <Pressable
              hitSlop={8}
              onPress={onClearCache}
              accessibilityRole="button"
              accessibilityLabel="Clear temporary cache"
              style={({ pressed }) => [styles.cacheRow, pressed && styles.pressed]}>
              <Text style={[type.caption, styles.cacheValue]}>{formatBytes(tmpBytes)}</Text>
              <Ionicons name="refresh" size={13} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {!loaded ? null : docs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[type.body, styles.emptyText]}>No documents stored yet.</Text>
          </View>
        ) : (
          docs.map((doc) => {
            const open = expanded === doc.id;
            const date = new Date(doc.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            return (
              <View key={doc.id} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show files for ${doc.name}`}
                  onPress={() => setExpanded(open ? null : doc.id)}
                  style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}>
                  <Image
                    source={{ uri: doc.files.find((f) => f.name.startsWith('thumb'))?.uri }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  <View style={styles.info}>
                    <Text style={[type.label, styles.docName]} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    <Text style={[type.caption, styles.docMeta]}>
                      {doc.files.length} files · {formatBytes(doc.bytes)} · {date}
                    </Text>
                  </View>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>

                {open && (
                  <View style={styles.fileList}>
                    {doc.files.map((file) => (
                      <View key={file.uri} style={styles.fileRow}>
                        <Ionicons
                          name={file.name.startsWith('thumb') ? 'image-outline' : 'document-outline'}
                          size={14}
                          color={colors.textTertiary}
                        />
                        <Text style={[type.caption, styles.fileName]} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={[type.caption, styles.fileSize]}>{formatBytes(file.bytes)}</Text>
                      </View>
                    ))}
                    <View style={styles.docActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${doc.name}`}
                        onPress={() => router.push(`/document/${doc.id}`)}
                        style={({ pressed }) => [styles.docAction, pressed && styles.pressed]}>
                        <Ionicons name="open-outline" size={15} color={colors.text} />
                        <Text style={[type.caption, styles.docActionText]}>Open</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${doc.name}`}
                        onPress={() => onDeleteDoc(doc)}
                        style={({ pressed }) => [styles.docAction, pressed && styles.pressed]}>
                        <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                        <Text style={[type.caption, styles.docActionText, { color: colors.destructive }]}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
  content: {
    padding: spacing.m,
    gap: spacing.s,
  },
  summary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.m,
    gap: spacing.s,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.text,
  },
  summaryValue: {
    color: colors.textSecondary,
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgInset,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  cacheLabel: {
    color: colors.textSecondary,
  },
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cacheValue: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.s,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.xs,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: radius.s,
    backgroundColor: colors.bgInset,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  docName: {
    color: colors.text,
  },
  docMeta: {
    color: colors.textSecondary,
  },
  fileList: {
    marginTop: spacing.s,
    paddingTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  fileName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
  },
  fileSize: {
    color: colors.textTertiary,
  },
  docActions: {
    flexDirection: 'row',
    gap: spacing.m,
    marginTop: spacing.s,
  },
  docAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: spacing.s,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  docActionText: {
    color: colors.text,
  },
});
