import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import {
  cacheBytes,
  clearCache,
  deleteAllDocuments,
  formatBytes,
  libraryBytes,
  loadSettings,
  saveSettings,
} from '@/lib/storage';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { ExportFormat, QualityPreset } from '@/lib/types';

const FACING_OPTIONS = [
  { value: 'back' as const, label: 'Back' },
  { value: 'front' as const, label: 'Front' },
];

const FORMAT_OPTIONS = [
  { value: 'pdf' as const, label: 'PDF' },
  { value: 'jpg' as const, label: 'JPG' },
  { value: 'png' as const, label: 'PNG' },
];

const QUALITY_OPTIONS = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'low' as const, label: 'Low' },
];

export default function SettingsScreen() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [quality, setQuality] = useState<QualityPreset>('medium');
  const [fastCapture, setFastCapture] = useState(false);
  const [libBytes, setLibBytes] = useState(0);
  const [tmpBytes, setTmpBytes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSettings().then((s) => {
        if (active) {
          setFacing(s.facing);
          setFormat(s.format);
          setQuality(s.quality);
          setFastCapture(s.fastCapture);
        }
      });
      setLibBytes(libraryBytes());
      setTmpBytes(cacheBytes());
      return () => {
        active = false;
      };
    }, []),
  );

  const persist = (
    next: Partial<{
      facing: 'back' | 'front';
      format: ExportFormat;
      quality: QualityPreset;
      fastCapture: boolean;
      onboarded: boolean;
    }>,
  ) => {
    // Read-modify-write against disk so fields this screen doesn't manage
    // (like `onboarded`) are never clobbered.
    loadSettings()
      .then((s) => saveSettings({ ...s, ...next }))
      .catch(() => {});
  };

  const onClearCache = () => {
    clearCache();
    setTmpBytes(cacheBytes());
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete all documents?',
      'Every saved scan will be permanently removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            deleteAllDocuments();
            setLibBytes(libraryBytes());
          },
        },
      ],
    );
  };

  const usageFraction = libBytes > 0 ? Math.min(1, libBytes / (512 * 1024 * 1024)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack={() => router.back()} style={styles.header} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.label, styles.sectionTitle]}>Capture</Text>
        <View style={[styles.card, styles.cardColumn]}>
          <View style={styles.rowColumn}>
            <Text style={[type.body, styles.rowLabel]}>Default camera</Text>
            <View style={styles.segmentWrap}>
              <Segmented
                options={FACING_OPTIONS}
                value={facing}
                onChange={(v) => {
                  setFacing(v);
                  persist({ facing: v });
                }}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={styles.rowColumn}>
              <Text style={[type.body, styles.rowLabel]}>Fast capture</Text>
              <Text style={[type.caption, styles.rowHint]}>
                Skip crop review — shots go straight to the session
              </Text>
            </View>
            <Switch
              value={fastCapture}
              onValueChange={(v) => {
                setFastCapture(v);
                persist({ fastCapture: v });
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Text style={[type.label, styles.sectionTitle]}>Export</Text>
        <View style={[styles.card, styles.cardColumn]}>
          <View style={styles.rowColumn}>
            <Text style={[type.body, styles.rowLabel]}>Default format</Text>
            <View style={styles.segmentWrap}>
              <Segmented
                options={FORMAT_OPTIONS}
                value={format}
                onChange={(v) => {
                  setFormat(v);
                  persist({ format: v });
                }}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowColumn}>
            <Text style={[type.body, styles.rowLabel]}>Quality</Text>
            <View style={styles.segmentWrap}>
              <Segmented
                options={QUALITY_OPTIONS}
                value={quality}
                onChange={(v) => {
                  setQuality(v);
                  persist({ quality: v });
                }}
              />
            </View>
          </View>
        </View>

        <Text style={[type.label, styles.sectionTitle]}>Storage</Text>
        <View style={[styles.card, styles.cardColumn]}>
          <View style={styles.usageRow}>
            <Text style={[type.body, styles.rowLabel]}>Documents</Text>
            <Text style={[type.caption, styles.usageValue]}>{formatBytes(libBytes)}</Text>
          </View>
          <View style={styles.usageTrack}>
            <View style={[styles.usageFill, { width: `${Math.max(usageFraction * 100, libBytes > 0 ? 2 : 0)}%` }]} />
          </View>
          <View style={styles.usageRow}>
            <Text style={[type.body, styles.rowLabel]}>Temporary cache</Text>
            <Text style={[type.caption, styles.usageValue]}>{formatBytes(tmpBytes)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear temporary cache"
            onPress={onClearCache}
            style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}>
            <Text style={[type.label, styles.rowActionText]}>Clear cache</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse stored files"
            onPress={() => router.push('/files')}
            style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}>
            <View style={styles.browseRow}>
              <Text style={[type.label, styles.rowActionText]}>Browse files</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]} onPress={onDeleteAll}>
            <Text style={[type.label, styles.rowDestructiveText]}>
              Delete all documents
            </Text>
          </Pressable>
        </View>
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
  sectionTitle: {
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.m,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.m,
  },
  cardColumn: {
    gap: spacing.m,
  },
  rowColumn: {
    gap: spacing.s,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    justifyContent: 'space-between',
  },
  rowHint: {
    color: colors.textSecondary,
    maxWidth: 230,
  },
  rowLabel: {
    color: colors.text,
  },
  segmentWrap: {},
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageValue: {
    color: colors.textSecondary,
  },
  usageTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgInset,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  rowButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowActionText: {
    color: colors.text,
  },
  rowDestructiveText: {
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.6,
  },
});
