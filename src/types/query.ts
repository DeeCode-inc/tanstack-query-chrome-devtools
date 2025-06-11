import type { QueryKey, QueryObserverBaseResult } from "@tanstack/query-core";

export interface QueryData {
  queryKey: QueryKey;
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

export type LayoutMode = "list" | "grid";

export interface StatusDisplay {
  icon: string;
  text: string;
  bgColor: string;
  textColor: string;
}

export interface ActionFeedback {
  message: string;
  type: "success" | "error";
}
