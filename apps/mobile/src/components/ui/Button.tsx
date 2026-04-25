import { Pressable, StyleSheet, Text, ViewStyle, ActivityIndicator } from 'react-native';
import { colors, fonts, radius } from '../../theme';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'chip';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const Button = ({ title, onPress, variant = 'primary', disabled, loading, style }: Props) => {
  const isPrimary = variant === 'primary';
  const isChip = variant === 'chip';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'ghost' && styles.ghost,
        isChip && styles.chip,
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.background : colors.foreground} />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && { color: colors.background },
            isChip && styles.chipText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.foreground,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  chip: {
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(239, 233, 221, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.5)',
    paddingHorizontal: 14,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.foreground,
  },
  chipText: {
    fontSize: 13,
    color: 'rgba(42, 36, 56, 0.75)',
  },
});
