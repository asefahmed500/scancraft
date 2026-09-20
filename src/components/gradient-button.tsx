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
};

// The one primary action per screen: gray→white gradient, black text,
// hairline border — the monochrome "chrome" button.
export function GradientButton({ label, onPress, disabled, busy, icon, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.base, (disabled || busy) && styles.disabled, pressed && styles.pressed, style]}>
      <LinearGradient
        colors={['#FFFFFF', '#E9E7E2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}>
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={17} color={colors.text} /> : null}
            <Text style={[type.label, styles.label]}>{label}</Text>
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
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
