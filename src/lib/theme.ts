export const colors = {
  bg: '#FAFAF8',
  bgInset: '#F3F1EC',
  surface: '#FFFFFF',
  border: '#EDEBE6',
  text: '#141414',
  textSecondary: '#6B6B68',
  textTertiary: '#9C9A94',
  accent: '#141414',
  accentPressed: '#000000',
  accentSoft: '#EDEBE6',
  destructive: '#C6453D',
  destructiveSoft: '#FBEFEE',
  white: '#FFFFFF',
  cameraStage: '#0E0E0D',
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

// Sharp, scanner-app geometry: subtle rounding only, never bubbly.
export const radius = {
  s: 4,
  m: 8,
  l: 12,
  full: 999,
} as const;

export const fonts = {
  display: 'Geist_600SemiBold',
  heading: 'Geist_600SemiBold',
  medium: 'Geist_500Medium',
  body: 'Inter_400Regular',
  label: 'Inter_500Medium',
} as const;

// Typography tokens carry their family so every Text is consistent by default.
export const type = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.96,
    fontFamily: fonts.display,
    color: colors.text,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.36,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.text,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    fontFamily: fonts.label,
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    fontFamily: fonts.body,
    color: colors.text,
  },
} as const;
