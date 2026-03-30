import type { QueryEntry, MutationEntry, QueryDisplayStatus, QueryState, MutationState, MutationStatus } from "@/types/ui";
import type { BridgeMessage, ChangeEvent, ActionType, PathSegment } from "@/types/messages";
import { BRIDGE_SOURCE, BRIDGE_SOURCE_ACTION } from "@/types/messages";
import { encodeBigInts } from "@/utils/serialization";
import { setAtPath, deleteAtPath } from "@/utils/set-at-path";
import { Mutation, Query } from "@tanstack/query-core";

const POLL_INTERVAL_MS = 250;
const MAX_POLL_MS = 30_000;

function deriveQueryStatus(query: Query): QueryDisplayStatus {
  if (query.state.fetchStatus === "fetching") return "fetching";
  if (query.observers.length === 0) return "inactive";
  if (query.state.fetchStatus === "paused") return "paused";
  if (query.isStale()) return "stale";
  return "fresh";
}

function sanitizeFetchMeta(meta: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!meta) return null;
  const { __previousQueryOptions, ...rest } = meta;
  if (__previousQueryOptions !== undefined) {
    return { ...rest, __previousQueryOptions: true };
  }
  return Object.keys(rest).length > 0 ? rest : null;
}

function extractQueryState(query: Query): QueryState {
  const s = query.state;
  return {
    data: s.data,
    dataUpdateCount: s.dataUpdateCount,
    dataUpdatedAt: s.dataUpdatedAt,
    error: s.error,
    errorUpdateCount: s.errorUpdateCount,
    errorUpdatedAt: s.errorUpdatedAt,
    fetchFailureCount: s.fetchFailureCount,
    fetchFailureReason: s.fetchFailureReason,
    fetchMeta: sanitizeFetchMeta(s.fetchMeta as Record<string, unknown> | null),
    isInvalidated: s.isInvalidated,
    status: s.status,
    fetchStatus: s.fetchStatus,
  };
}

function extractQuery(query: Query): QueryEntry {
  return {
    queryHash: query.queryHash,
    queryKey: [...query.queryKey],
    observerCount: query.observers.length,
    status: deriveQueryStatus(query),
    dataUpdatedAt: query.state.dataUpdatedAt,
    data: query.state.data,
    isActive: query.isActive(),
    isDisabled: query.isDisabled(),
    meta: query.meta,
    state: extractQueryState(query),
  };
}

function extractMutationState(mutation: Mutation): MutationState {
  return {
    status: mutation.state.status as MutationStatus,
    variables: mutation.state.variables,
    context: mutation.state.context,
    data: mutation.state.data,
    error: mutation.state.error,
    failureCount: mutation.state.failureCount,
    failureReason: mutation.state.failureReason,
    isPaused: mutation.state.isPaused,
    submittedAt: mutation.state.submittedAt,
  };
}

function extractMutation(mutation: Mutation): MutationEntry {
  return {
    mutationId: mutation.mutationId,
    mutationKey: mutation.options.mutationKey ? [...mutation.options.mutationKey] : null,
    status: mutation.state.status as MutationEntry["status"],
    timestamp: mutation.state.submittedAt,
    variables: mutation.state.variables,
    context: mutation.state.context,
    data: mutation.state.data,
    error: mutation.state.error,
    state: extractMutationState(mutation),
  };
}

function postBridge<T extends BridgeMessage["type"]>(type: T, payload: BridgeMessage<T>["payload"]): void {
  const message: BridgeMessage<T> = { source: BRIDGE_SOURCE, type, payload };
  window.postMessage(message, "*");
}

function postChange(change: ChangeEvent): void {
  postBridge("SYNC_UPDATE", encodeBigInts({ changes: [change] }) as { changes: readonly ChangeEvent[] });
}

function startSync(client: NonNullable<Window["__TANSTACK_QUERY_CLIENT__"]>) {
  const queryCache = client.getQueryCache();
  const mutationCache = client.getMutationCache();

  // Build and send initial snapshot

  const queries = queryCache.getAll().map((q) => extractQuery(q));

  const mutations = mutationCache.getAll().map((m) => extractMutation(m));
  postBridge("SYNC_SNAPSHOT", encodeBigInts({ queries, mutations }) as { queries: QueryEntry[]; mutations: MutationEntry[] });

  // Subscribe to QueryCache
  const unsubQuery = queryCache.subscribe((event) => {
    const type = event.type;

    if (type === "observerResultsUpdated" || type === "observerOptionsUpdated") {
      return; // Ignored
    }

    const query = event.query;

    if (type === "removed") {
      postChange({
        entityType: "query",
        changeType: "removed",
        queryHash: query.queryHash,
        entry: undefined,
      });
      return;
    }

    // Skip events for queries that have been removed from the cache
    // (e.g., observerRemoved firing after removeQueries was called)
    if (!queryCache.get(query.queryHash)) {
      return;
    }

    // added, updated, observerAdded, observerRemoved all map to entry updates
    const changeType = type === "added" ? "added" : "updated";
    postChange({
      entityType: "query",
      changeType,
      queryHash: query.queryHash,
      entry: extractQuery(query),
    });
  });

  // Subscribe to MutationCache
  const unsubMutation = mutationCache.subscribe((event) => {
    const type = event.type;

    if (type === "observerAdded" || type === "observerRemoved" || type === "observerOptionsUpdated") {
      return; // Ignored
    }

    const mutation = event.mutation;

    if (type === "removed") {
      postChange({
        entityType: "mutation",
        changeType: "removed",
        mutationId: mutation.mutationId,
        entry: undefined,
      });
      return;
    }

    const changeType = type === "added" ? "added" : "updated";
    postChange({
      entityType: "mutation",
      changeType,
      mutationId: mutation.mutationId,
      entry: extractMutation(mutation),
    });
  });

  // Return cleanup function
  return () => {
    unsubQuery();
    unsubMutation();
  };
}

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  main() {
    let cleanup: (() => void) | null = null;
    let elapsed = 0;

    function handleAction(action: ActionType, queryHash: string) {
      const client = window.__TANSTACK_QUERY_CLIENT__;
      const query = client?.getQueryCache().get(queryHash);
      if (!client) return;
      if (!query) return;
      if (action === "invalidate") {
        void client.invalidateQueries({ queryKey: query.queryKey });
      } else if (action === "refetch") {
        void client.refetchQueries({ queryKey: query.queryKey });
      } else if (action === "reset") {
        void client.resetQueries({ queryKey: query.queryKey });
      } else if (action === "remove") {
        client.removeQueries({ queryKey: query.queryKey });
      } else if (action === "triggerError") {
        const __previousQueryOptions = query.options;
        query.setState({
          data: undefined,
          status: "error",
          error: new Error("Unknown error from devtools"),
          fetchMeta: {
            ...query.state.fetchMeta,
            __previousQueryOptions,
          } as Record<string, unknown>,
        });
      } else if (action === "restoreError") {
        void client.resetQueries({ queryKey: query.queryKey });
      } else if (action === "triggerLoading") {
        const __previousQueryOptions = query.options;
        void query.fetch({
          ...query.options,
          queryFn: () =>
            new Promise(() => {
              /* Never resolves */
            }),
          gcTime: -1,
        });
        query.setState({
          data: undefined,
          status: "pending",
          fetchMeta: {
            ...query.state.fetchMeta,
            __previousQueryOptions,
          } as Record<string, unknown>,
        });
      } else if (action === "restoreLoading") {
        const meta = query.state.fetchMeta as Record<string, unknown> | null;
        const previousOptions = meta?.__previousQueryOptions as typeof query.options | undefined;
        void query.cancel({ silent: true });
        query.setState({
          ...query.state,
          fetchStatus: "idle",
          fetchMeta: null,
        });
        if (previousOptions) {
          void query.fetch(previousOptions);
        }
      }
    }

    // Listen for reverse-direction action messages from the devtools panel
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== window || (event.data as Record<string, unknown>)?.source !== BRIDGE_SOURCE_ACTION) {
        return;
      }
      const data = event.data as { type?: string; payload: Record<string, unknown> };
      if (data.type === "RESYNC_REQUEST") {
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        const queryCache = client.getQueryCache();
        const mutationCache = client.getMutationCache();
        const queries = queryCache.getAll().map((q) => extractQuery(q));
        const mutations = mutationCache.getAll().map((m) => extractMutation(m));
        postBridge(
          "SYNC_SNAPSHOT",
          encodeBigInts({ queries, mutations }) as {
            queries: QueryEntry[];
            mutations: MutationEntry[];
          },
        );
        return;
      }
      if (data.type === "SET_DATA_REQUEST") {
        const { queryHash, path, value } = data.payload as { queryHash: string; path: readonly PathSegment[]; value: string | number | boolean };
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        const query = client.getQueryCache().get(queryHash);
        if (!query) return;
        client.setQueryData(query.queryKey, (old: unknown) => setAtPath(old, path, value));
        return;
      }
      if (data.type === "DELETE_DATA_REQUEST") {
        const { queryHash, path } = data.payload as { queryHash: string; path: readonly PathSegment[] };
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        const query = client.getQueryCache().get(queryHash);
        if (!query) return;
        client.setQueryData(query.queryKey, (old: unknown) => deleteAtPath(old, path));
        return;
      }
      if (data.type === "REMOVE_ALL_QUERIES_REQUEST") {
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        client.getQueryCache().clear();
        return;
      }
      if (data.type === "CLEAR_MUTATION_CACHE_REQUEST") {
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        client.getMutationCache().clear();
        return;
      }
      if (data.type === "CLEAR_ARRAY_REQUEST") {
        const { queryHash, path } = data.payload as { queryHash: string; path: readonly PathSegment[] };
        const client = window.__TANSTACK_QUERY_CLIENT__;
        if (!client) return;
        const query = client.getQueryCache().get(queryHash);
        if (!query) return;
        client.setQueryData(query.queryKey, (old: unknown) => {
          // Navigate to the target to check if it's a Set
          let target = old;
          for (const segment of path) {
            if (target == null || typeof target !== "object") return old;
            if (typeof segment === "object" && "mapKey" in segment) {
              if (target instanceof Map) target = target.get(segment.mapKey);
              else return old;
            } else if (target instanceof Set) {
              target = Array.from(target)[Number(segment)];
            } else {
              target = (target as Record<string, unknown>)[segment];
            }
          }
          const clearValue = target instanceof Set ? new Set() : [];
          return setAtPath(old, path, clearValue);
        });
        return;
      }
      const { payload } = data as { payload: { action: ActionType; queryHash: string } };
      handleAction(payload.action, payload.queryHash);
    });

    // Immediate check
    const client = window.__TANSTACK_QUERY_CLIENT__;
    if (client) {
      cleanup = startSync(client);
      return;
    }

    const timer = setInterval(() => {
      const c = window.__TANSTACK_QUERY_CLIENT__;
      if (c) {
        clearInterval(timer);
        cleanup = startSync(c);
        return;
      }
      elapsed += POLL_INTERVAL_MS;
      if (elapsed >= MAX_POLL_MS) {
        clearInterval(timer);
        postBridge("SYNC_DISCONNECTED", {} as Record<string, never>);
      }
    }, POLL_INTERVAL_MS);

    // Note: MAIN-world scripts don't have context for cleanup,
    // but if the page unloads the script is destroyed anyway.
    void cleanup;
  },
});
