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

export { CheckVerified02 as VerifiedBadge, Stop as StopSolid, XCircle } from "@untitledui-pro/icons/solid";
