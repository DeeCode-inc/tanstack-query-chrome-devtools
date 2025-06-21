import type { QueryKey, QueryObserverBaseResult } from "@tanstack/query-core";

export interface QueryData {
  queryKey: QueryKey;
  queryHash: string;
  state: QueryObserverBaseResult<unknown, unknown>;
  meta?: Record<string, unknown>;
  isActive: boolean;
  observersCount: number;
}

export interface MutationData {
  mutationId: number;
  mutationKey?: string;
  state: "idle" | "pending" | "success" | "error" | "paused";
  variables?: unknown;
  context?: unknown;
  data?: unknown;
  error?: unknown;
  submittedAt: number;
  isPending: boolean;
}

export type ViewType = "queries" | "mutations";

export type IconName =
  | "CheckCircle"
  | "XCircle"
  | "Clock"
  | "RotateCw"
  | "HelpCircle"
  | "Pause"
  | "Moon"
  | "ChevronDown";

export interface StatusDisplay {
  icon: IconName;
  text: string;
  bgColor: string;
  textColor: string;
  variant: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
}
