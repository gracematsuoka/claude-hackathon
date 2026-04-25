import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';

export const StyledInput = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={colors.mutedForeground}
    {...props}
    style={[styles.input, props.style]}
  />
);

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.6)',
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.foreground,
  },
});
