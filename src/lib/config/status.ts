import {
  BadgeCheck,
  CalendarRange,
  Circle,
  CircleCheck,
  CircleCheckBig,
  CircleSlash,
  Clock,
  GitCompareArrows,
  History,
  Info,
  Minus,
  MoveRight,
  OctagonAlert,
  PenLine,
  Plus,
  Ruler,
  Scale,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Type,
} from "lucide-react";
export const statusVocabulary = {
  changeKind: {
    added: { icon: Plus, tone: "added", labelKey: "changeKind.added" },
    removed: { icon: Minus, tone: "removed", labelKey: "changeKind.removed" },
    modified: {
      icon: PenLine,
      tone: "caution",
      labelKey: "changeKind.modified",
    },
    dimension: {
      icon: Ruler,
      tone: "caution",
      labelKey: "changeKind.dimension",
    },
    annotation: {
      icon: Type,
      tone: "muted",
      labelKey: "changeKind.annotation",
    },
  },
  changeStatus: {
    new: { icon: Circle, tone: "muted", labelKey: "changeStatus.new" },
    no_variation: {
      icon: CircleCheck,
      tone: "tolerance",
      labelKey: "changeStatus.no_variation",
    },
    potential_variation: {
      icon: TriangleAlert,
      tone: "caution",
      labelKey: "changeStatus.potential_variation",
    },
  },
  variationStatus: {
    potential: {
      icon: TriangleAlert,
      tone: "caution",
      labelKey: "variationStatus.potential",
    },
    under_review: {
      icon: Clock,
      tone: "muted",
      labelKey: "variationStatus.under_review",
    },
    confirmed: {
      icon: CircleCheckBig,
      tone: "ink",
      labelKey: "variationStatus.confirmed",
    },
    rejected: {
      icon: CircleSlash,
      tone: "muted",
      labelKey: "variationStatus.rejected",
    },
  },
  checkSeverity: {
    error: {
      icon: OctagonAlert,
      tone: "risk",
      labelKey: "checkSeverity.error",
    },
    warning: {
      icon: TriangleAlert,
      tone: "caution",
      labelKey: "checkSeverity.warning",
    },
    info: { icon: Info, tone: "muted", labelKey: "checkSeverity.info" },
  },
  versionStatus: {
    current: {
      icon: BadgeCheck,
      tone: "tolerance",
      labelKey: "versionStatus.current",
    },
    superseded: {
      icon: History,
      tone: "muted",
      labelKey: "versionStatus.superseded",
    },
    conflict: {
      icon: GitCompareArrows,
      tone: "risk",
      labelKey: "versionStatus.conflict",
    },
  },
  priceTrend: {
    rising: { icon: TrendingUp, tone: "risk", labelKey: "priceTrend.rising" },
    stable: { icon: MoveRight, tone: "muted", labelKey: "priceTrend.stable" },
    falling: {
      icon: TrendingDown,
      tone: "tolerance",
      labelKey: "priceTrend.falling",
    },
  },
  advice: {
    buy_now: { icon: ShoppingCart, tone: "clay", labelKey: "advice.buy_now" },
    buy_in_window: {
      icon: CalendarRange,
      tone: "tolerance",
      labelKey: "advice.buy_in_window",
    },
    no_clear_advantage: {
      icon: Scale,
      tone: "muted",
      labelKey: "advice.no_clear_advantage",
    },
  },
} as const;
export type StatusDomain = keyof typeof statusVocabulary;
export const confidenceThresholds = { change: 0.6, alignment: 0.8 } as const;
