// Haven design tokens — ported from src/index.css.
// Colors are hex/rgba (RN doesn't support CSS HSL vars).

export const colors = {
  background: '#FAF7F2',       // hsl(36 38% 97%)
  foreground: '#2A2438',       // hsl(250 25% 18%)
  card: '#FFFFFF',
  popover: '#FFFFFF',

  primary: '#5A3D8E',           // hsl(260 45% 38%)
  primaryForeground: '#FAF7F2',

  accent: '#F77B3D',            // hsl(22 95% 62%)
  accentForeground: '#FFFFFF',

  secondary: '#EFE9DD',         // hsl(36 30% 92%)
  secondaryForeground: '#2A2438',

  muted: '#F1ECE2',
  mutedForeground: '#6B6580',   // hsl(250 12% 45%)

  destructive: '#D94343',
  border: '#E4DDD0',
  input: '#E4DDD0',
  ring: '#5A3D8E',

  // Sunset gradient stops (top → bottom)
  sunsetSoft: ['#DDE5FA', '#E6D9F2', '#FCE4D5', '#FCE0C9'],
  sunset: ['#A8B8F0', '#B8A8E0', '#E8B898', '#FCC890', '#FCD68C'],

  // User chat bubble gradient
  bubbleUser: ['#F77B3D', '#FFB85C'],

  // Translucent overlays
  overlay: 'rgba(42, 36, 56, 0.30)',
  inputBg: 'rgba(239, 233, 221, 0.6)',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayBold: 'CormorantGaramond_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
};

export const shadow = {
  soft: {
    shadowColor: '#5A3D8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  modal: {
    shadowColor: '#2A1F4A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.30,
    shadowRadius: 40,
    elevation: 12,
  },
};
