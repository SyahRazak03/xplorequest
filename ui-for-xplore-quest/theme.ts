/**
 * theme.ts
 * Shared Design System Tokens for XploreQuest — "Field Journal" Theme
 * Created for Dapo Awoknyee Resources (KL Event Crew) client demo.
 */

export type UserRole = 'participant' | 'crew' | 'admin';

export const COLORS = {
  // ── Base Neutrals (Cream / Notebook-paper palette) ──────────────────────
  background: '#FAF9F6',         // Cream — notebook paper base
  card: '#FFFFFF',
  text: '#1C2E24',               // Dark charcoal — body text (legibility)
  textMuted: '#8A7F73',          // Warm grey — faded notebook ink
  textLight: '#FFFFFF',
  textDisplay: '#5B3A9E',        // Deep Purple — headings / display text
  textAccent: '#E8506B',         // Coral Pink — highlights, sub-labels (NOT body)
  border: '#E5E0D6',             // Warm grid-line grey
  shadow: '#2B1A40',             // Deep purple-black (used with alpha)
  overlay: 'rgba(43, 26, 64, 0.45)',

  // ── Status Indicators ────────────────────────────────────────────────────
  success: '#10B981',            // Emerald Green (unchanged — reads on cream)
  pending: '#F5C518',            // Notebook Yellow — skip / pending state
  warning: '#F5C518',            // Same as pending
  danger: '#E8506B',             // Coral Pink — danger / DNF (in-palette)

  // ── Role-Specific Palettes ───────────────────────────────────────────────
  participant: {
    primary: '#5B3A9E',          // Deep Purple — Explorer / journal-keeper
    primaryLight: '#EDE8FB',
    primaryDark: '#3D2270',
    accent: '#F5C518',           // Notebook Yellow — star-burst / reward
    accentLight: '#FFFBE8',
  },
  crew: {
    primary: '#E8506B',          // Coral Pink — Active, high-visibility
    primaryLight: '#FDE8EC',
    primaryDark: '#C0384F',
    accent: '#5B3A9E',           // Deep Purple — secondary accents
    accentLight: '#EDE8FB',
  },
  admin: {
    primary: '#2B1A40',          // Deep Purple-Navy — Control, oversight
    primaryLight: '#EAE5F5',
    primaryDark: '#1A0F28',
    accent: '#F5C518',           // Notebook Yellow — call-to-action accent
    accentLight: '#FFFBE8',
  },

  // ── Decorative / Motif palette ───────────────────────────────────────────
  decorative: {
    starBurst: '#F5C518',        // Yellow star-burst doodles
    routePath: '#5B3A9E',        // Purple dashed route lines
    gridLine: 'rgba(229, 224, 214, 0.5)', // Low-opacity grid paper
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const TYPOGRAPHY = {
  fontFamily: {
    display: 'Caveat_700Bold',   // Hand-drawn display font — headings/splash/celebration
    sans: 'System',              // Clean body font — buttons, inputs, lists
    monospace: 'Courier',
  },
  fontSize: {
    h1: 28,
    h2: 22,
    h3: 18,
    bodyLarge: 16,
    body: 14,
    caption: 12,
    button: 15,
  },
  fontWeight: {
    bold: '700' as const,
    semiBold: '600' as const,
    medium: '500' as const,
    regular: '400' as const,
  },
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};

/**
 * Returns a complete, unified theme configuration based on the user's active role.
 * Dynamically shifts primary brand colors for visual role differentiation.
 */
export const getThemeForRole = (role: UserRole = 'participant') => {
  const roleColors = COLORS[role];

  return {
    role,
    colors: {
      ...COLORS,
      primary: roleColors.primary,
      primaryLight: roleColors.primaryLight,
      primaryDark: roleColors.primaryDark,
      accent: roleColors.accent,
      accentLight: roleColors.accentLight,
    },
    spacing: SPACING,
    radius: RADIUS,
    typography: TYPOGRAPHY,
    shadows: SHADOWS,
  };
};

export const theme = getThemeForRole('participant'); // Default export/theme mapping

export type Theme = ReturnType<typeof getThemeForRole>;
