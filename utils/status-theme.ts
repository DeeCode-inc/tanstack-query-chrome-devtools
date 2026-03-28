import type { QueryDisplayStatus } from "@/types/ui";

export interface StatusTheme {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
  readonly dot: string;
}

export interface StatusDefinition {
  readonly key: string;
  readonly label: string;
  readonly theme: StatusTheme;
}

export const STATUS_THEMES: Record<QueryDisplayStatus | "error", StatusTheme> = {
  fresh: {
    bg: "bg-green-100 dark:bg-green-900/50",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    dot: "bg-green-500 dark:bg-green-400",
  },
  fetching: {
    bg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  paused: {
    bg: "bg-purple-100 dark:bg-purple-900/50",
    text: "text-purple-800 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
    dot: "bg-purple-500 dark:bg-purple-400",
  },
  stale: {
    bg: "bg-orange-100 dark:bg-orange-900/50",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  inactive: {
    bg: "bg-gray-200 dark:bg-gray-700",
    text: "text-gray-600 dark:text-gray-300",
    border: "border-gray-300 dark:border-gray-600",
    dot: "bg-gray-500 dark:bg-gray-400",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/50",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    dot: "bg-red-500 dark:bg-red-400",
  },
};

export const DISPLAY_STATUSES: readonly QueryDisplayStatus[] = [
  "fresh",
  "fetching",
  "paused",
  "stale",
  "inactive",
] as const;

export const QUERY_STATUS_DEFINITIONS: readonly StatusDefinition[] = [
  { key: "fresh", label: "Fresh", theme: STATUS_THEMES.fresh },
  { key: "fetching", label: "Fetching", theme: STATUS_THEMES.fetching },
  { key: "paused", label: "Paused", theme: STATUS_THEMES.paused },
  { key: "stale", label: "Stale", theme: STATUS_THEMES.stale },
  { key: "inactive", label: "Inactive", theme: STATUS_THEMES.inactive },
] as const;

export const MUTATION_STATUS_DEFINITIONS: readonly StatusDefinition[] = [
  { key: "idle", label: "Idle", theme: STATUS_THEMES.paused },
  { key: "pending", label: "Pending", theme: STATUS_THEMES.stale },
  { key: "success", label: "Success", theme: STATUS_THEMES.fresh },
  { key: "error", label: "Error", theme: STATUS_THEMES.error },
] as const;
