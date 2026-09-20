import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && !active && styles.optionPressed,
            ]}>
            <Text style={[type.label, active ? styles.labelActive : styles.label]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.bgInset,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  optionActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.text,
  },
});
