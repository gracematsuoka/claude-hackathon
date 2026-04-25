import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme';

interface Props {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  style?: ViewStyle;
}

export const Field = ({ label, hint, error, children, style }: Props) => (
  <View style={[{ gap: 6 }, style]}>
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    {children}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: 'rgba(42, 36, 56, 0.8)',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.destructive,
  },
});
