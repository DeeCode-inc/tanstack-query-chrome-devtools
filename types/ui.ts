export type MutationStatus = "idle" | "pending" | "success" | "error";
export type ActiveTab = "queries" | "mutations";
export type LayoutVariant = "popup" | "panel";
export type QueryDisplayStatus = "fresh" | "fetching" | "paused" | "stale" | "inactive";

export interface QueryState {
  readonly data: unknown;
  readonly dataUpdateCount: number;
  readonly dataUpdatedAt: number;
  readonly error: unknown;
  readonly errorUpdateCount: number;
  readonly errorUpdatedAt: number;
  readonly fetchFailureCount: number;
  readonly fetchFailureReason: unknown;
  readonly fetchMeta: Record<string, unknown> | null;
  readonly isInvalidated: boolean;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface QueryEntry {
  readonly queryHash: string;
  readonly queryKey: readonly unknown[];
  readonly observerCount: number;
  readonly status: QueryDisplayStatus;
  readonly dataUpdatedAt: number;
  readonly data: unknown;
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly meta: Record<string, unknown> | undefined;
  readonly state: QueryState;
}

export interface MutationState {
  readonly status: MutationStatus;
  readonly variables: unknown;
  readonly context: unknown;
  readonly data: unknown;
  readonly error: unknown;
  readonly failureCount: number;
  readonly failureReason: unknown;
  readonly isPaused: boolean;
  readonly submittedAt: number;
}

export interface MutationEntry {
  readonly mutationId: number;
  readonly mutationKey: readonly unknown[] | null;
  readonly status: MutationStatus;
  readonly timestamp: number;
  readonly variables: unknown;
  readonly context: unknown;
  readonly data: unknown;
  readonly error: unknown;
  readonly state: MutationState;
}

export type SortDirection = "asc" | "desc";
export type QuerySortTerm = "status" | "queryHash" | "lastUpdated";
export type MutationSortTerm = "status" | "lastUpdated";

export interface QuerySortConfig {
  readonly term: QuerySortTerm;
  readonly direction: SortDirection;
}

export interface MutationSortConfig {
  readonly term: MutationSortTerm;
  readonly direction: SortDirection;
}
