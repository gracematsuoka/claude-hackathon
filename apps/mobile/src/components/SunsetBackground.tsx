import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

interface Props {
  variant?: 'soft' | 'full';
  style?: ViewStyle;
}

/**
 * Approximation of the multi-radial CSS sunset gradient using stacked LinearGradients.
 * RN doesn't support radial gradients natively; this layered approach gives a close feel.
 */
export const SunsetBackground = ({ variant = 'soft', style }: Props) => {
  const stops = variant === 'soft' ? colors.sunsetSoft : colors.sunset;
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={stops as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Warm bottom glow */}
      <LinearGradient
        colors={['rgba(252, 200, 144, 0)', 'rgba(252, 200, 144, 0.55)']}
        style={[StyleSheet.absoluteFill, { top: '55%' }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
};
