import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: object;
  variant?: 'primary' | 'ghost';
};

// Primary = the one main action per screen (gray→white gradient, black text).
// Ghost = secondary actions (softer gradient, muted text, lighter border).
export function GradientButton({ label, onPress, disabled, busy, icon, style, variant = 'primary' }: Props) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        ghost && styles.baseGhost,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <LinearGradient
        colors={ghost ? ['#FBFAF8', '#F1EFEA'] : ['#FFFFFF', '#E9E7E2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}>
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={17} color={ghost ? colors.textSecondary : colors.text} /> : null}
            <Text style={[type.label, ghost ? styles.labelGhost : styles.label]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: '#D8D5CF',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#141414',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  baseGhost: {
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  fill: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: colors.text,
  },
  labelGhost: {
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
