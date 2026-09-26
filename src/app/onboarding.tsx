import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LogoReveal } from '@/components/logo-reveal';
import { GradientButton } from '@/components/gradient-button';
import { loadSettings, saveSettings } from '@/lib/storage';
import { colors, radius, spacing, type } from '@/lib/theme';

const SLIDES = [
  {
    icon: 'scan-outline' as const,
    title: 'Scan anything',
    body: 'Capture documents with your camera. Fast mode snaps page after page — crop later.',
  },
  {
    icon: 'color-wand-outline' as const,
    title: 'Make it perfect',
    body: 'Crop precisely, rotate, and enhance every page with five clean filters.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Export anywhere',
    body: 'Save as PDF or images, then share, print, or keep everything on your device.',
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(-1); // -1 = logo reveal
  const fade = useSharedValue(1);

  const revealStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const finishReveal = useCallback(() => {
    fade.value = withDelay(300, withTiming(0, { duration: 350 }, (done) => {
      if (done) runOnJS(setStep)(0);
    }));
  }, [fade]);

  useEffect(() => {
    if (step !== -1) return;
    const t = setTimeout(finishReveal, 1900);
    return () => clearTimeout(t);
  }, [step, finishReveal]);

  const finish = async () => {
    try {
      const s = await loadSettings();
      await saveSettings({ ...s, onboarded: true });
    } catch {
      // even if persistence fails, continue into the app
    }
    router.replace('/');
  };

  const isLast = step === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {step === -1 ? (
        <Animated.View style={[styles.reveal, revealStyle]} pointerEvents="none">
          <LogoReveal />
        </Animated.View>
      ) : (
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }} />
            <Pressable onPress={finish} style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}>
              <Text style={[type.label, styles.skip]}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.slideArea} key={step}>
            <Animated.View entering={FadeInDown.duration(420)} style={styles.illustration}>
              <View style={styles.tile}>
                <View style={[styles.corner, styles.cTL]} />
                <View style={[styles.corner, styles.cTR]} />
                <View style={[styles.corner, styles.cBL]} />
                <View style={[styles.corner, styles.cBR]} />
                <Ionicons name={SLIDES[step].icon} size={56} color={colors.text} />
              </View>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(120).duration(420)} style={styles.copy}>
              <Text style={[type.display, styles.title]}>{SLIDES[step].title}</Text>
              <Text style={[type.body, styles.bodyText]}>{SLIDES[step].body}</Text>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>
            <GradientButton
              label={isLast ? 'Get started' : 'Next'}
              icon={isLast ? 'arrow-forward' : undefined}
              onPress={() => (isLast ? finish() : setStep(step + 1))}
              style={styles.next}
            />
          </View>
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
  reveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
    minHeight: 44,
  },
  skip: {
    color: colors.textSecondary,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  slideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  illustration: {
    marginBottom: spacing.xl,
  },
  tile: {
    width: 140,
    height: 140,
    borderRadius: radius.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: colors.text,
  },
  cTL: {
    top: 8,
    left: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 3,
  },
  cTR: {
    top: 8,
    right: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 3,
  },
  cBL: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 3,
  },
  cBR: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 3,
  },
  copy: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  bodyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    padding: spacing.l,
    gap: spacing.l,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.s,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.text,
  },
  next: {},
});
