import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSession } from '@/lib/session';
import { loadSettings, saveSettings } from '@/lib/storage';
import { makeThumb } from '@/lib/imaging';
import { GradientButton } from '@/components/gradient-button';
import { colors, radius, spacing, type } from '@/lib/theme';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturing, setCapturing] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const fastTouchedRef = useRef(false);
  const focusAliveRef = useRef(true);
  const mountedRef = useRef(true);
  const flashOpacity = useSharedValue(0);
  const { pages, addPage } = useSession();
  // Expo requires the native camera to unmount when its screen is not
  // focused — otherwise the camera session is held and previews freeze.
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      focusAliveRef.current = true;
      setIsFocused(true);
      return () => {
        focusAliveRef.current = false;
        setIsFocused(false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      // Apply the saved defaults once per mount, not on every focus —
      // otherwise an in-session camera flip would be silently reverted.
      if (settingsLoadedRef.current) return;
      let active = true;
      loadSettings().then((s) => {
        if (!active) return;
        settingsLoadedRef.current = true;
        setFacing(s.facing);
        // Don't clobber a toggle the user already flipped this mount.
        if (!fastTouchedRef.current) setFastMode(s.fastCapture);
      });
      return () => {
        active = false;
      };
    }, []),
  );
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flashScreen = () => {
    flashOpacity.value = withSequence(
      withTiming(0.85, { duration: 70 }),
      withTiming(0, { duration: 260 }),
    );
  };
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  if (!permission) {
    return (
      <View style={[styles.stage, styles.permissionSpinner]}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.stage, styles.permissionSafe]}>
        <View style={styles.permissionBody}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={36} color={colors.textTertiary} />
          </View>
          <Text style={[type.display, styles.permissionTitle]}>
            Camera access needed
          </Text>
          <Text style={[type.body, styles.permissionHint]}>
            ScanCraft uses the camera to capture documents. Nothing is uploaded — scans stay on
            your device.
          </Text>
          {permission.canAskAgain ? (
            <GradientButton
              label="Grant camera access"
              onPress={requestPermission}
              style={styles.cta}
            />
          ) : (
            <GradientButton
              label="Open Settings to allow camera"
              onPress={() => Linking.openSettings()}
              style={styles.cta}
            />
          )}
          <Pressable style={({ pressed }) => [pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={[type.label, styles.backText]}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // Guard against a hung native capture — never leave the shutter stuck.
      const photo = await Promise.race([
        cameraRef.current?.takePictureAsync({ quality: 0.95 }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
      if (!photo?.uri || !focusAliveRef.current || !mountedRef.current) return;

      if (fastMode) {
        // Burst capture: skip crop review, add straight to the session.
        flashScreen();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        let thumb: string | undefined;
        try {
          thumb = await makeThumb(photo.uri);
        } catch {
          thumb = undefined;
        }
        addPage({
          id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          thumb,
        });
      } else {
        router.push({
          pathname: '/review',
          params: {
            uri: photo.uri,
            width: String(photo.width),
            height: String(photo.height),
          },
        });
      }
    } catch {
      // capture failed (e.g. interrupted) — stay on camera, no action needed
    } finally {
      busyRef.current = false;
      setCapturing(false);
    }
  };

  const toggleFastMode = () => {
    const next = !fastMode;
    fastTouchedRef.current = true;
    setFastMode(next);
    Haptics.selectionAsync().catch(() => {});
    loadSettings()
      .then((s) => saveSettings({ ...s, fastCapture: next }))
      .catch(() => {});
  };

  const pickFromLibrary = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await pickFromLibraryInner();
    } finally {
      busyRef.current = false;
    }
  };

  const pickFromLibraryInner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.95,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      router.push({
        pathname: '/review',
        params: {
          uri: asset.uri,
          width: String(asset.width),
          height: String(asset.height),
        },
      });
    }
  };

  return (
    <View style={styles.stage}>
      <StatusBar style="light" />
      {isFocused ? (
        <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash} mode="picture" />
      ) : (
        <View style={styles.camera} />
      )}

      <View style={styles.frame} pointerEvents="none">
        <View style={styles.frameBox}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={[type.caption, styles.hint]}>Position the document within the frame</Text>
      </View>

      <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable
          hitSlop={6}
          style={({ pressed }) => [styles.roundButton, capturing && styles.shutterBusy, pressed && styles.pressed]}
          onPress={() => router.back()}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          style={({ pressed }) => [styles.fastChip, fastMode && styles.fastChipOn, pressed && styles.pressed]}
          onPress={toggleFastMode}
          accessibilityRole="button"
          accessibilityLabel="Toggle fast capture"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="layers-outline" size={14} color={fastMode ? colors.white : 'rgba(255,255,255,0.85)'} />
          <Text style={[type.caption, styles.fastChipText]}>Fast</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}
          accessibilityRole="button"
          accessibilityLabel="Toggle flash"
          disabled={capturing}
          hitSlop={6}>
          <Ionicons
            name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
            size={22}
            color={flash === 'off' ? colors.white : '#FFD666'}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
          disabled={capturing}
          hitSlop={6}>
          <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {pages.length > 0 && (
          <View style={styles.stripRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {pages.map((page) => (
                <Image key={page.id} source={{ uri: page.thumb ?? page.uri }} style={styles.stripThumb} contentFit="cover" />
              ))}
            </ScrollView>
            <Pressable style={({ pressed }) => [styles.donePill, pressed && styles.pressed]} onPress={() => router.push('/pages')}
          accessibilityRole="button"
          accessibilityLabel="Review captured pages"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[type.label, styles.donePillText]}>
                {pages.length}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.white} />
            </Pressable>
          </View>
        )}
        <View style={styles.controlsRow}>
          <Pressable disabled={capturing} style={({ pressed }) => [styles.sideButton, capturing && styles.shutterBusy, pressed && styles.pressed]} onPress={pickFromLibrary}
          accessibilityRole="button"
          accessibilityLabel="Pick an image from the library">
            <Ionicons name="images-outline" size={26} color={colors.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.shutter, capturing && styles.shutterBusy, pressed && styles.pressed]}
            onPress={takePicture}
            disabled={capturing}
            accessibilityLabel="Capture page">
            <View style={styles.shutterInner} />
            {pages.length > 0 && (
              <View style={styles.shutterBadge}>
                <Text style={styles.shutterBadgeText}>{pages.length}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.sideButton}>
            {capturing && <ActivityIndicator color={colors.white} />}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: colors.cameraStage,
  },
  permissionSafe: {
    backgroundColor: colors.bg,
  },
  permissionSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  permissionIcon: {
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
  permissionTitle: {
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  permissionHint: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
  },
  ctaText: {
    color: colors.white,
  },
  backText: {
    color: colors.textSecondary,
  },
  camera: {
    flex: 1,
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBox: {
    width: '78%',
    height: '62%',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.accent,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  hint: {
    color: colors.white,
    marginTop: spacing.m,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    gap: spacing.s,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(20,20,20,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    marginBottom: spacing.m,
    gap: spacing.s,
  },
  strip: {
    gap: spacing.s,
    alignItems: 'center',
  },
  stripThumb: {
    width: 40,
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(20,20,20,0.4)',
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    height: 32,
  },
  donePillText: {
    color: colors.white,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.m,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  shutterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.cameraStage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shutterBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
  },
  fastChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(20,20,20,0.4)',
    marginRight: 2,
  },
  fastChipOn: {
    backgroundColor: colors.accent,
  },
  fastChipText: {
    color: colors.white,
  },
});
