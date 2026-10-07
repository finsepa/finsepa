import { createElement, type FC, type SVGProps } from "react";

export type AppIcon = FC<SVGProps<SVGSVGElement> & { size?: number; color?: string }>;

/** Sidebar / mobile nav (native Untitled names). */
export {
  BarChartSquare01,
  BookOpen01,
  Briefcase01,
  Calendar,
  Globe01,
  Globe04,
  Grid01,
  Home01,
  IntersectCircle,
  NavigationPointer01,
  PieChart01,
  Rows01,
  Rows03,
  Users01,
  UsersPlus,
} from "@untitledui-pro/icons/line";

/** Inline — Turbopack can fail to load `@untitledui-pro/icons/line/Flag01` in dev. */
export const Flag01: AppIcon = ({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  ...props
}) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      width: size,
      height: size,
      color,
      "aria-hidden": true,
      ...props,
    },
    createElement("path", {
      d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v19",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );

/** Briefcase with a cog badge (Hugeicons NewJob) — Create portfolio, same glyph as iOS. */
export const BriefcaseCog: AppIcon = ({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  ...props
}) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      width: size,
      height: size,
      color,
      "aria-hidden": true,
      ...props,
    },
    createElement("path", {
      d: "M17.5 13L18.7503 14.1518L20.4372 14.0855L20.6658 15.7839L22 16.8342L21.1 18.2845L21.4572 19.9599L19.8497 20.4834L19.0628 22L17.5 21.3518L15.9372 22L15.1503 20.4834L13.5428 19.9599L13.9 18.2845L13 16.8342L14.3342 15.7839L14.5628 14.0855L16.2497 14.1518L17.5 13Z",
      stroke: "currentColor",
      strokeWidth,
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M21 10.5V8C21 6.89543 20.1046 6 19 6H4C2.89543 6 2 6.89543 2 8V19C2 20.1046 2.89543 21 4 21H10.5",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M15.5 5.5L14.7072 2.72528C14.5846 2.29598 14.1922 2 13.7457 2H9.2543C8.80782 2 8.41544 2.29598 8.29278 2.72528L7.5 5.5",
      stroke: "currentColor",
      strokeWidth,
      strokeLinejoin: "round",
    }),
  );

/** Party popper — goal-hit cells in the My Goal results table. */
export const Confetti: AppIcon = ({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  ...props
}) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      width: size,
      height: size,
      color,
      "aria-hidden": true,
      ...props,
    },
    createElement("path", {
      d: "M5.8 11.3 2 22l10.7-3.79",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M4 3h.01",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M22 8h.01",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M15 2h.01",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M22 20h.01",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    createElement("path", {
      d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );

/**
 * App-wide icons with Lucide-compatible aliases for incremental migration.
 * Import from `@/lib/icons` instead of `lucide-react`.
 */
export {
  ArrowBlockUp,
  ArrowCircleBrokenDownLeft,
  ArrowCircleBrokenDownRight,
  ArrowCircleBrokenUpLeft,
  ArrowCircleBrokenUpRight,
  ArrowDown,
  ArrowUp,
  Bank as Landmark,
  BarChart03 as BarChart3,
  BarLineChart as FileBarChart,
  Bell01 as Bell,
  BellMinus,
  BellPlus,
  Briefcase01 as Briefcase,
  Calendar as CalendarDays,
  Calendar as CalendarIcon,
  Check,
  CheckCircle as CircleCheck,
  Clock,
  ClockRewind as History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins01 as Coins,
  Compass,
  CreditCard01 as CreditCard,
  Dataflow03 as ChartSpline,
  DotsGrid as GripVertical,
  DotsHorizontal as MoreHorizontal,
  Download01 as Download,
  Eye,
  EyeOff,
  File02 as FileText,
  FileCode01 as FileCode,
  FileSearch01 as FileSearch,
  FilterLines as Filter,
  FlipBackward as RotateCcw,
  GitMerge,
  Globe01 as Globe,
  HelpCircle as CircleQuestionMark,
  InfoCircle as Info,
  Laptop01 as Laptop,
  LayersTwo01 as Layers2,
  LayoutLeft as PanelLeft,
  LayoutRight as PanelLeftOpen,
  LineChartUp01 as LineChart,
  LinkExternal01 as ExternalLink,
  List as LayoutList,
  Lock01 as Lock,
  LogOut01 as LogOut,
  Mail01 as Mail,
  Maximize01 as Maximize2,
  Menu01 as Menu,
  MessageCircle01 as MessageCircle,
  MessageSquare02 as MessagesSquare,
  Minimize01 as Minimize2,
  Minus,
  Moon01 as Moon,
  Pencil01 as Pencil,
  Phone01 as Smartphone,
  PieChart01 as PieChart,
  PlayCircle,
  PauseCircle,
  Plus,
  PresentationChart01 as Presentation,
  RefreshCcw01 as RefreshCcw,
  RefreshCw01 as RefreshCw,
  SearchMd as Search,
  Send01 as Send,
  Settings01 as Settings,
  Settings02 as Settings2,
  Share01 as Share2,
  ShoppingBag01 as ShoppingBag,
  SlashCircle01 as ListX,
  Sliders03 as SlidersHorizontal,
  Star01 as Star,
  Stars01 as Sparkles,
  Stop,
  Sun,
  SwitchHorizontal01 as ArrowLeftRight,
  Table as FileSpreadsheet,
  Trash01 as Trash2,
  TrendDown01 as TrendingDown,
  TrendUp01 as TrendingUp,
  Upload01 as Upload,
  User01 as User,
  UserCircle as UserRound,
  VideoRecorder as MonitorPlay,
  Wallet01 as Wallet,
  XClose as X,
} from "@untitledui-pro/icons/line";

/** Half-filled circle — Appearance / theme menu (Cursor-style contrast mark). */
export const Contrast: AppIcon = ({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  ...props
}) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      width: size,
      height: size,
      color,
      "aria-hidden": true,
      ...props,
    },
    createElement("circle", {
      cx: 12,
      cy: 12,
      r: 9,
      stroke: "currentColor",
      strokeWidth,
    }),
    createElement("path", {
      d: "M12 3a9 9 0 0 0 0 18V3Z",
      fill: "currentColor",
    }),
  );

export {
  CheckVerified02 as VerifiedBadge,
  Play as PlaySolid,
  Stop as StopSolid,
  XCircle,
} from "@untitledui-pro/icons/solid";

/** Solid pause bars — pairs with `PlaySolid` on filled circular controls. */
export const PauseSolid: AppIcon = ({
  size = 24,
  color = "currentColor",
  ...props
}) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      width: size,
      height: size,
      color,
      "aria-hidden": true,
      ...props,
    },
    createElement("rect", {
      x: 6,
      y: 5,
      width: 4,
      height: 14,
      rx: 1,
      fill: "currentColor",
    }),
    createElement("rect", {
      x: 14,
      y: 5,
      width: 4,
      height: 14,
      rx: 1,
      fill: "currentColor",
    }),
  );
