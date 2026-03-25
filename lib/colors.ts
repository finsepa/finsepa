// ─── Primitive Color Tokens ───────────────────────────────────────────────────
// Based on the Finsepa design system color scale.
// These are raw values only — do not use directly in components.
// Use semantic tokens (colors.ts semantic layer) instead.

export const primitives = {

  // ── Grey ──────────────────────────────────────────────────────────────────
  // Foundation for text, backgrounds, strokes, and UI surfaces.
  grey: {
    50:  "#FAFAFA",
    100: "#F4F4F5",  // background
    200: "#E4E4E7",  // stroke
    300: "#D4D4D8",
    400: "#A1A1AA",
    500: "#71717A",  // secondary
    600: "#52525B",
    700: "#3F3F46",
    800: "#27272A",
    900: "#18181B",
    950: "#09090B",  // primary
  },

  // ── Blue ──────────────────────────────────────────────────────────────────
  // Brand / interactive color. Used for buttons, links, and inputs.
  blue: {
    50:  "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",  // primary
    700: "#1D40AF",  // secondary
    800: "#1E40AF",
    900: "#1E3A8A",
    950: "#172554",
  },

  // ── Red ───────────────────────────────────────────────────────────────────
  // Error states and destructive actions.
  red: {
    50:  "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626",  // primary
    700: "#B91C1C",  // secondary
    800: "#991B1B",
    900: "#7F1D1D",
    950: "#450A0A",
  },

  // ── Orange ────────────────────────────────────────────────────────────────
  // Warnings, confirmations, and attention-grabbing UI.
  orange: {
    50:  "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316",
    600: "#EA580C",  // primary
    700: "#C2410C",  // secondary
    800: "#9A3412",
    900: "#7C2D12",
    950: "#431407",
  },

  // ── Green ─────────────────────────────────────────────────────────────────
  // Success states, positive values, and confirmations.
  green: {
    50:  "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",
    600: "#16A34A",  // primary
    700: "#15803D",
    800: "#166534",
    900: "#14532D",
    950: "#052E16",
  },

  // ── Yellow ────────────────────────────────────────────────────────────────
  // Secondary accent. Use sparingly for labels and pills.
  yellow: {
    50:  "#FEFCE8",
    100: "#FEF9C3",
    200: "#FEF08A",
    300: "#FDE047",
    400: "#FACC15",
    500: "#EAB308",
    600: "#CA8A04",
    700: "#A16207",
    800: "#854D0E",
    900: "#713F12",
    950: "#422006",
  },

  // ── Purple ────────────────────────────────────────────────────────────────
  // Secondary accent. Use sparingly for labels and pills.
  purple: {
    50:  "#FAF5FF",
    100: "#F3E8FF",
    200: "#E9D5FF",
    300: "#D8B4FE",
    400: "#C084FC",
    500: "#A855F7",
    600: "#9333EA",
    700: "#7E22CE",
    800: "#6B21A8",
    900: "#581C87",
    950: "#3B0764",
  },

  // ── Basics ────────────────────────────────────────────────────────────────
  white: "#FFFFFF",
  black: "#000000",

} as const;

// Type helpers
export type Primitives = typeof primitives;
export type ColorScale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;
