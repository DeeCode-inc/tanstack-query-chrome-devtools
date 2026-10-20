import type { MutationEntry, MutationStatus, QueryEntry } from "@/types/ui";

/**
 * A settled query entry with neutral defaults. `overrides` replaces top-level
 * fields; `state.dataUpdatedAt` follows `dataUpdatedAt`.
 */
export function makeQuery(
  queryHash: string,
  overrides: Partial<QueryEntry> = {},
): QueryEntry {
  const dataUpdatedAt = overrides.dataUpdatedAt ?? 0;
  return {
    queryHash,
    queryKey: [queryHash],
    observerCount: 0,
    status: "fresh",
    dataUpdatedAt,
    isActive: false,
    isDisabled: false,
    meta: undefined,
    state: {
      data: undefined,
      dataUpdateCount: 0,
      dataUpdatedAt,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: "success",
      fetchStatus: "idle",
    },
    ...overrides,
  };
}

/** A mutation entry whose top-level and `state` status agree. */
export function makeMutation(
  mutationId: number,
  {
    status = "success",
    submittedAt = 0,
  }: { status?: MutationStatus; submittedAt?: number } = {},
): MutationEntry {
  return {
    mutationId,
    mutationKey: null,
    status,
    timestamp: submittedAt,
    state: {
      status,
      variables: undefined,
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt,
    },
  };
}
