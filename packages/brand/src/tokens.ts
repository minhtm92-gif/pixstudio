/**
 * PixStudio brand design tokens — chốt 2026-04-30 D39.
 * Blue gradient (PXL signature): navy → sky → royal.
 * Inter + Lora fonts.
 */

export const colors = {
  // Primary brand gradient (D39)
  navy: "#1E40AF",
  royal: "#3B82F6",
  sky: "#3DA8F5",
  // Gradient variants
  gradientPrimary: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #3DA8F5 100%)",
  gradientHero: "linear-gradient(180deg, #1E40AF 0%, #3DA8F5 100%)",
  // Accent (sparingly)
  amber: "#F59E0B",
  rose: "#F43F5E",
  emerald: "#10B981",
  // Neutral scale (Tailwind-aligned)
  neutral: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0A0A0A",
  },
  // Semantic
  bgCanvas: "#FAFAFA",
  bgPanel: "#FFFFFF",
  bgInverse: "#171717",
  textPrimary: "#171717",
  textSecondary: "#525252",
  textInverse: "#FAFAFA",
  border: "#E5E5E5",
} as const;

export const fonts = {
  heading: "'Lora', Georgia, serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
} as const;

export const radii = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const space = {
  px: "1px",
  0.5: "0.125rem",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
  16: "4rem",
  24: "6rem",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 12px rgba(30,64,175,0.1)",
  lg: "0 12px 32px rgba(30,64,175,0.15)",
  glow: "0 0 24px rgba(61,168,245,0.3)",
} as const;

export const transitions = {
  fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// Track type colors (timeline strips per CTO §1.1)
export const trackColors = {
  v3_text: "#A78BFA",     // violet 400
  v2_video: "#3DA8F5",    // PXL sky
  v1_base: "#1E40AF",     // PXL navy
  a2_tts: "#F59E0B",      // amber
  a1_music: "#10B981",    // emerald
  imageToVideo: "#EC4899", // pink (Seedance / Kling)
  textToVideo: "#8B5CF6",  // violet (Veo 3 / Seedance)
  aiVoiceover: "#F97316",  // orange (ElevenLabs)
  aiCharacter: "#06B6D4",  // cyan (Seedream / DreamActor)
  subtitle: "#64748B",     // slate
  mask: "#9CA3AF",         // gray
} as const;

export type Tokens = {
  colors: typeof colors;
  fonts: typeof fonts;
  radii: typeof radii;
  space: typeof space;
  shadows: typeof shadows;
  transitions: typeof transitions;
  breakpoints: typeof breakpoints;
  trackColors: typeof trackColors;
};

export const tokens: Tokens = {
  colors,
  fonts,
  radii,
  space,
  shadows,
  transitions,
  breakpoints,
  trackColors,
};
