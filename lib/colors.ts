// ─── Primitive Color Tokens ───────────────────────────────────────────────────
// Based on the Finsepa design system color scale.
// Prefer semantic tokens below (or CSS `--fs-*` / Tailwind `bg-page`, `text-fg`) in UI.

export const primitives = {
  // ── Grey ──────────────────────────────────────────────────────────────────
  grey: {
    50: "#FAFAFA",
    100: "#F4F4F5", // surface-muted
    200: "#E4E4E7", // stroke
    300: "#D4D4D8",
    400: "#A1A1AA", // fg-subtle / placeholder
    500: "#5C5D5F", // fg-muted
    600: "#52525B",
    700: "#3F3F46",
    800: "#27272A",
    900: "#18181B",
    950: "#141414", // fg / icon
  },

  // ── Blue ──────────────────────────────────────────────────────────────────
  blue: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#364AFF", // accent
    700: "#1D40AF",
    800: "#1E40AF",
    900: "#1E3A8A",
    950: "#172554",
  },

  // ── Red ───────────────────────────────────────────────────────────────────
  red: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA", // down-soft
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626", // down
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
    950: "#450A0A",
  },

  // ── Orange ────────────────────────────────────────────────────────────────
  orange: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316",
    600: "#EA580C",
    700: "#C2410C",
    800: "#9A3412",
    900: "#7C2D12",
    950: "#431407",
  },

  // ── Green ─────────────────────────────────────────────────────────────────
  green: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",
    600: "#16A34A", // up
    700: "#15803D",
    800: "#166534",
    900: "#14532D",
    950: "#052E16",
  },

  // ── Yellow ────────────────────────────────────────────────────────────────
  yellow: {
    50: "#FEFCE8",
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
  purple: {
    50: "#FAF5FF",
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

  white: "#FFFFFF",
  black: "#000000",
} as const;

/**
 * Semantic colors for the **light** theme — keep in sync with `:root` `--fs-*` in `app/globals.css`.
 * For runtime theme-aware reads (charts), prefer `getComputedStyle` on these CSS vars once `.dark` exists.
 */
export const semantic = {
  /** App / body wash behind chrome (`--background`). */
  page: "#F3F3F4",
  /** Mobile grey behind elevated cards; blur wash base. */
  canvas: "#FAFAFA",
  /** Desktop shell panels (topbar, main, rails). */
  panel: "#FCFCFD",
  /** Left navigation rail fill. */
  nav: "#F3F3F4",
  /** Cards, menus, elevated surfaces. */
  surface: "#FFFFFF",
  /** Outline / white-chrome buttons (topbar, Customize, chips). */
  button: "#FFFFFF",
  /** Modal dialog fill. */
  modal: "#FCFCFD",
  /** Hover rows, grey fill buttons, selected menu rows. */
  surfaceMuted: "#F4F4F5",
  /** Segmented track, group fills. */
  surfaceSubtle: "#F1F1F2",
  /** Stronger grey button hover. */
  surfaceHover: "#EBEBEB",
  /** Text-entry field fill. */
  field: "#F1F1F2",
  /** Text-entry field border (transparent on light). */
  fieldStroke: "transparent",
  /** Text-entry field hover fill (menus / dropdowns). */
  fieldHover: "#EBEBEB",
  /** Text-entry idle hover stroke (transparent on light). */
  fieldStrokeHover: "transparent",
  /** Text-entry focus / open border (transparent on light). */
  fieldStrokeActive: "transparent",
  /** Text-entry focus outer ring (transparent on light). */
  fieldRing: "transparent",
  /** Primary UI text. */
  fg: "#141414",
  /** Secondary labels / section titles. */
  fgMuted: "#5C5D5F",
  /** Placeholders, muted icons, scrollbar thumb. */
  fgSubtle: "#A1A1AA",
  /** Default icon stroke/fill. */
  icon: "#141414",
  /** Primary stroke (menus, dividers). */
  stroke: "#E4E4E7",
  tableRowStroke: "#EFEFEF",
  /** Card / shell chrome stroke. */
  strokeSubtle: "#EBEBEC",
  /** White-surface button stroke. */
  strokeMuted: "#E8E8EB",
  up: "#16A34A",
  down: "#DC2626",
  accent: "#364AFF",
  accentHover: "#2B3FE6",
  accentSoft: "#DBEAFE",
  orange: "#F59E0B",
  orangeSoft: "#FFEDD5",
  tableRowHover: "#FAFAFA",
  upSoft: "#D1FAE5",
  downSoft: "#FECACA",
  alertBg: "#FEF2F2",
  alertBorder: "#FECACA",
  alertFg: "#B91C1C",
  /** Body copy on page (slightly softer than `fg`). */
  body: "#171717",
} as const;

export type Primitives = typeof primitives;
export type SemanticColors = typeof semantic;
export type ColorScale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;
