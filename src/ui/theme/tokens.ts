/**
 * Design tokens — the single source of truth for colors, spacing, radii,
 * shadows, typography and motion. UI code must import from here (via
 * `@/ui/theme`) instead of hard-coding values.
 */

export const palette = {
  // Brand
  grape: '#5B3FD9',
  grapeDark: '#3E24A8',
  grapeLight: '#8B73FF',
  sky: '#178ED3',
  skyDark: '#0D689F',
  sun: '#FFC83D',
  sunDark: '#E09A00',
  sunInk: '#5C3B00',
  mint: '#3DDC97',
  mintDark: '#1FA56C',
  coral: '#F2476F',
  coralDark: '#C2294F',
  tangerine: '#EC6A10',
  tangerineDark: '#B54E04',

  // Neutrals
  white: '#FFFFFF',
  cream: '#FFF8EC',
  cloud: '#F1EEFF',
  mist: '#D9D3F5',
  slate: '#7A7299',
  ink: '#2B2152',
  black: '#000000',
} as const;

export const colors = {
  /** Soft gradient used behind every screen (top → bottom). */
  backgroundGradient: ['#7B5CFF', '#5B3FD9', '#2A82CC'] as const,
  surface: palette.white,
  surfaceAlt: palette.cloud,
  text: palette.ink,
  textMuted: palette.slate,
  textOnDark: palette.white,
  textOnDarkMuted: 'rgba(255,255,255,0.9)',
  border: palette.mist,
  focus: palette.sun,
  overlay: 'rgba(30, 18, 80, 0.55)',
  /** Light green background for "all done" hints. */
  successSoft: '#E2F8EE',

  card: {
    face: palette.white,
    border: palette.cream,
    backGradient: [palette.grapeLight, palette.grape] as const,
    backPattern: 'rgba(255,255,255,0.18)',
  },

  /**
   * Button variants. `face` is the top surface, `edge` the darker "3D" lip
   * underneath, `text` the label color (chosen for ≥ 4.5:1 contrast).
   */
  button: {
    primary: { face: palette.sun, edge: palette.sunDark, text: palette.sunInk },
    secondary: { face: palette.white, edge: palette.mist, text: palette.grape },
    success: { face: palette.mint, edge: palette.mintDark, text: '#063D27' },
    danger: { face: palette.coral, edge: palette.coralDark, text: palette.white },
    info: { face: palette.sky, edge: palette.skyDark, text: palette.white },
    accent: { face: palette.tangerine, edge: palette.tangerineDark, text: palette.white },
  },

  /** Preset player colors for pass-and-play (never used as the only cue). */
  players: [
    { id: 'coral', main: palette.coral, dark: palette.coralDark },
    { id: 'sky', main: palette.sky, dark: palette.skyDark },
    { id: 'mint', main: palette.mint, dark: palette.mintDark },
    { id: 'tangerine', main: palette.tangerine, dark: palette.tangerineDark },
    { id: 'grape', main: palette.grapeLight, dark: palette.grape },
    { id: 'sun', main: palette.sun, dark: palette.sunDark },
  ],
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  card: 18,
  pill: 999,
} as const;

/**
 * Cross-platform shadows using the `boxShadow` style prop
 * (supported on iOS and Android with the New Architecture).
 */
export const shadows = {
  none: undefined,
  sm: '0px 2px 4px rgba(30, 18, 80, 0.18)',
  md: '0px 6px 12px rgba(30, 18, 80, 0.22)',
  lg: '0px 12px 24px rgba(30, 18, 80, 0.28)',
  card: '0px 4px 8px rgba(30, 18, 80, 0.25)',
} as const;

export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 50 },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
  heading: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  button: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24 },
  caption: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  /** Card flip duration (ms). */
  flip: 320,
  /** Mismatch reveal delay before flipping back (ms). */
  mismatchDelay: { normal: 900, kids: 1700 },
  /** Delay between cards during the deal-in (ms). */
  dealStagger: 35,
  buttonPressDepth: 5,
  /**
   * "Noa's turn!" banner (ms): pop in, stay, fade out — ~1.4 s in total, so it
   * never sits on the board while the player is already choosing cards.
   */
  turnBanner: { in: 240, hold: 700, out: 450 },
  /** Timed "pop" (overshoot then settle) for a pair match and the pile counter (ms). */
  pop: 260,
} as const;

/** Minimum comfortable touch target (dp), per Android/iOS guidelines. */
export const minTouchTarget = 48;

export const theme = {
  palette,
  colors,
  spacing,
  radii,
  shadows,
  fonts,
  typography,
  motion,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
