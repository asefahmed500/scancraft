import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { GradientButton } from '@/components/gradient-button';
import { useSession } from '@/lib/session';
import { applyLook, buildPdf, QUALITY_PRESETS } from '@/lib/imaging';
import { loadSettings, persistDocument, safeDeleteCacheFile } from '@/lib/storage';
import { matrixFor } from '@/lib/filters';
import { colors, radius, spacing, type } from '@/lib/theme';
import type { ExportFormat, QualityPreset, StoredDocument } from '@/lib/types';

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

export default function ExportScreen() {
  const { pages, filterId, adjustments, resetSession } = useSession();
  const [name, setName] = useState(
    `Scan_${new Date().toISOString().slice(0, 10)}`,
  );
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [quality, setQuality] = useState<QualityPreset>('medium');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ doc: StoredDocument; message: string } | null>(null);
  const busyRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fill defaults from settings once — not on every focus, which would
  // clobber choices the user already made in this form.
  useFocusEffect(
    useCallback(() => {
      if (settingsLoadedRef.current) return;
      settingsLoadedRef.current = true;
      let active = true;
      loadSettings().then((s) => {
        if (active) {
          setFormat(s.format);
          setQuality(s.quality);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (pages.length === 0 && !result) {
      router.replace('/');
    }
  }, [pages.length, result]);

  const save = async (share: boolean) => {
    if (busyRef.current || pages.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setProgress('');
    let doc: StoredDocument | null = null;
    try {
      const matrix = matrixFor(filterId, adjustments);
      const preset = QUALITY_PRESETS[quality];
      const imageFormat = format === 'png' ? 'png' : 'jpg';
      const processed = [];
      for (let i = 0; i < pages.length; i++) {
        setProgress(`Enhancing page ${i + 1} of ${pages.length}…`);
        const page = pages[i];
        const out = await applyLook(page.uri, matrix, preset.maxDim, preset.quality, imageFormat);
        processed.push({ uri: out.uri, width: out.width, height: out.height });
      }
      doc = await persistDocument(name, processed);
    } catch (error) {
      // Pre-persist failure: nothing was saved, so failing is accurate.
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
      return;
    }

    // From here the document IS saved to the library — delivery problems
    // (share sheet, photo library) must not report a total failure or the
    // user would retry and create a duplicate document.
    let message = 'Saved to your ScanCraft library.';
    try {
      if (share) {
        if (format === 'pdf') {
          setProgress('Creating PDF…');
          const pdfUri = await buildPdf(doc.pages);
          if (await Sharing.isAvailableAsync()) {
            try {
              await Sharing.shareAsync(pdfUri, {
                mimeType: 'application/pdf',
                dialogTitle: `${doc.name}.pdf`,
              });
              message = 'PDF created and sent to the share sheet.';
            } catch {
              message = 'PDF created, but the share sheet could not open.';
            }
          } else {
            message = 'Sharing is unavailable on this device — the PDF could not be delivered.';
          }
        } else {
          // write-only: the app only saves images, it never reads the library
          const permission = await MediaLibrary.requestPermissionsAsync(true);
          if (permission.granted) {
            let saved = 0;
            for (const page of doc.pages) {
              try {
                await MediaLibrary.Asset.create(page.file);
                saved += 1;
              } catch {
                break;
              }
            }
            message =
              saved === doc.pages.length
                ? `Saved ${saved} ${saved === 1 ? 'image' : 'images'} to your photo library.`
                : `Saved ${saved} of ${doc.pages.length} images to your photo library.`;
          } else {
            message = 'Photo library permission denied — saved to library only.';
          }
        }
      }
    } catch {
      message = 'Saved to your library, but delivery to the share sheet or photo library failed.';
    }
    if (!mountedRef.current) return;
    // The doc and its page files are fully persisted — reset the session
    // immediately so a hardware-back from the result screen can't land on
    // Pages with dead URIs.
    resetSession();
    setResult({ doc, message });
    busyRef.current = false;
    setBusy(false);
  };

  const onFinish = () => {
    // Originals stay in cache until the user explicitly leaves the flow, so
    // navigating away mid-session can never orphan live page files.
    for (const page of pages) {
      safeDeleteCacheFile(page.uri);
    }
    resetSession();
    router.dismissAll();
  };

  if (result) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={32} color={colors.white} />
          </View>
          <Text style={[type.display, styles.doneTitle]}>
            Document saved
          </Text>
          <Text style={[type.body, styles.doneMessage]}>{result.message}</Text>
          <Text style={[type.caption, styles.doneMeta]}>
            {result.doc.name} · {result.doc.pages.length}{' '}
            {result.doc.pages.length === 1 ? 'page' : 'pages'}
          </Text>
          <GradientButton label="Done" onPress={onFinish} style={styles.doneButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Save document"
        onBack={() => router.back()}
        backDisabled={busy}
        style={styles.header}
        right={
          <Text style={[type.caption, styles.pageCount]}>
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </Text>
        }
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[type.label, styles.fieldLabel]}>Name</Text>
          <TextInput
            style={[type.body, styles.input]}
            value={name}
            onChangeText={setName}
            placeholder="Document name"
            placeholderTextColor={colors.textTertiary}
            editable={!busy}
            autoCorrect={false}
            maxLength={80}
          />
        </View>
        <View style={styles.field}>
          <Text style={[type.label, styles.fieldLabel]}>Format</Text>
          <Segmented options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
        </View>
        {format !== 'png' && (
          <View style={styles.field}>
            <Text style={[type.label, styles.fieldLabel]}>
              Quality
            </Text>
            <Segmented options={QUALITY_OPTIONS} value={quality} onChange={setQuality} />
            <Text style={[type.caption, styles.fieldHint]}>
              High keeps more detail and produces larger files.
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton
          label="Save & Export"
          onPress={() => save(true)}
          disabled={busy}
          busy={busy}
          style={styles.primary}
        />
        <GradientButton
          label="Save to Library only"
          onPress={() => save(false)}
          disabled={busy}
          variant="ghost"
          style={styles.ghostBtn}
        />
      </View>
      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.body, styles.busyText]}>{progress || 'Processing…'}</Text>
        </View>
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
  pageCount: {
    color: colors.textSecondary,
  },
  form: {
    padding: spacing.m,
    gap: spacing.l,
  },
  field: {
    gap: spacing.s,
  },
  fieldLabel: {
    color: colors.text,
  },
  fieldHint: {
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    minHeight: 48,
    color: colors.text,
  },
  footer: {
    padding: spacing.m,
    gap: spacing.s,
  },
  ghostBtn: {
    paddingHorizontal: 8,
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
  ghost: {
    minHeight: 48,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ghostText: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250,250,248,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  busyText: {
    color: colors.textSecondary,
  },
  doneBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.l,
  },
  doneTitle: {
    marginBottom: spacing.s,
  },
  doneMessage: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  doneMeta: {
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },
  doneButton: {
    alignSelf: 'stretch',
  },
});
