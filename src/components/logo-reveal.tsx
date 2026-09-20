import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '@/lib/theme';

type Props = {
  animate?: boolean;
  size?: number;
};

// Brand reveal: scanner-tile icon springs in, the wordmark fades with
// letter-tracking settling, then a scan line sweeps underneath.
export function LogoReveal({ animate = true, size = 64 }: Props) {
  const iconScale = useSharedValue(animate ? 0.5 : 1);
  const iconOpacity = useSharedValue(animate ? 0 : 1);
  const textOpacity = useSharedValue(animate ? 0 : 1);
  const tracking = useSharedValue(animate ? 6 : -0.96);
  const line = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    iconOpacity.value = withTiming(1, { duration: 320 });
    iconScale.value = withSpring(1, { damping: 14, stiffness: 170 });
    textOpacity.value = withDelay(200, withTiming(1, { duration: 420 }));
    tracking.value = withDelay(200, withTiming(-0.96, { duration: 560 }));
    line.value = withDelay(480, withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) }));
  }, [animate, iconOpacity, iconScale, textOpacity, tracking, line]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    letterSpacing: tracking.value,
  }));
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: line.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.tile, { width: size, height: size }, iconStyle]}>
        <View style={[styles.cornerTL, { width: size * 0.24, height: size * 0.24 }]} />
        <View style={[styles.cornerTR, { width: size * 0.24, height: size * 0.24 }]} />
        <View style={[styles.cornerBL, { width: size * 0.24, height: size * 0.24 }]} />
        <View style={[styles.cornerBR, { width: size * 0.24, height: size * 0.24 }]} />
        <Ionicons name="scan-outline" size={size * 0.5} color={colors.text} />
      </Animated.View>
      <View style={styles.wordmarkWrap}>
        <Animated.Text style={[styles.wordmark, textStyle]}>ScanCraft</Animated.Text>
        <Animated.View style={[styles.scanLine, lineStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  tile: {
    borderRadius: radius.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  cornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 3,
    borderColor: colors.text,
  },
  cornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 3,
    borderColor: colors.text,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 3,
    borderColor: colors.text,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 3,
    borderColor: colors.text,
  },
  wordmarkWrap: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: 'Geist_600SemiBold',
    color: colors.text,
  },
  scanLine: {
    width: '100%',
    height: 2,
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
});
