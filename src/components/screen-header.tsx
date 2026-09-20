import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type } from '@/lib/theme';

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  left?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
};

export function ScreenHeader({ title, onBack, right, left, style, titleStyle }: Props) {
  return (
    <View style={[styles.row, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        left
      )}
      <Text style={[type.h2, { flex: 1 }, titleStyle]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  pressed: {
    opacity: 0.5,
  },
});
