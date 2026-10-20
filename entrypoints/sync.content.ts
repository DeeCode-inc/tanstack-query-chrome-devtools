import type {
  Mutation,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from "@tanstack/query-core";
import type {
  ActionType,
  BridgeMessage,
  ChangeEvent,
  QueryObserversPatch,
} from "@/types/messages";
import { BRIDGE_SOURCE } from "@/types/messages";
import type {
  MutationEntry,
  MutationState,
  MutationStatus,
  QueryDisplayStatus,
  QueryEntry,
  QueryState,
} from "@/types/ui";
import { isPageRequestEnvelope } from "@/utils/guards";
import { clearAtPath, deleteAtPath, setAtPath } from "@/utils/set-at-path";
import {
  encodeChange,
  encodeMutationEntry,
  encodeQueryEntry,
} from "@/utils/wire-entities";

/**
 * Fallback detection interval, used only when the page shaped the global
 * itself (accessor, read-only or non-configurable) so it is not trapped.
 * Polls for the page's lifetime.
 */
const CLIENT_POLL_MS = 1000;

/**
 * This script runs in the page's MAIN world and QueryCache.notify iterates its
 * subscribers without catching, so an exception thrown here unwinds into the
 * inspected application's own render/commit and trips its error boundary.
 * Nothing the devtools do may escape into the page.
 */
function safely(label: string, fn: () => void): void {
  try {
    fn();
  } catch (error: unknown) {
    console.warn(`[tanstack-query-devtools] skipped ${label}:`, error);
  }
}

/** Wraps a callback so it is invoked through `safely` without re-indenting its body. */
function guarded<A extends readonly unknown[]>(
  label: string,
  fn: (...args: A) => void,
): (...args: A) => void {
  return (...args: A) => safely(label, () => fn(...args));
}

/**
 * Adapts a path edit to a `setQueryData` updater. Path edits return their input
 * by identity when nothing changed; the updater then returns `undefined`, which
 * makes TanStack Query skip the update instead of bumping `dataUpdatedAt` and
 * notifying every observer of the page.
 */
function skipUnchanged(
  edit: (old: unknown) => unknown,
): (old: unknown) => unknown {
  return (old) => {
    const next = edit(old);
    return next === old ? undefined : next;
  };
}

function deriveQueryStatus(query: Query): QueryDisplayStatus {
  if (query.state.fetchStatus === "fetching") return "fetching";
  if (query.getObserversCount() === 0) return "inactive";
  if (query.state.fetchStatus === "paused") return "paused";
  if (query.isStale()) return "stale";
  return "fresh";
}

function sanitizeFetchMeta(
  meta: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!meta) return null;
  const { __previousQueryOptions, ...rest } = meta;
  if (__previousQueryOptions !== undefined) {
    // First, so that the action buttons still see it when the rest of a large
    // `fetchMeta` is cut by the encoding budget.
    return { __previousQueryOptions: true, ...rest };
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
    observerCount: query.getObserversCount(),
    status: deriveQueryStatus(query),
    dataUpdatedAt: query.state.dataUpdatedAt,
    isActive: query.isActive(),
    isDisabled: query.isDisabled(),
    meta: query.meta,
    state: extractQueryState(query),
  };
}

/** The entry fields an observer mount or unmount can change. */
function extractObserversPatch(query: Query): QueryObserversPatch {
  return {
    observerCount: query.getObserversCount(),
    status: deriveQueryStatus(query),
    isActive: query.isActive(),
    isDisabled: query.isDisabled(),
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
    mutationKey: mutation.options.mutationKey
      ? [...mutation.options.mutationKey]
      : null,
    status: mutation.state.status as MutationEntry["status"],
    timestamp: mutation.state.submittedAt,
    state: extractMutationState(mutation),
  };
}

function postBridge(message: BridgeMessage): void {
  window.postMessage(message, "*");
}

/**
 * Encodes every entry on its own, under its own budgets (see
 * `utils/wire-entities.ts`). Extraction runs user code (`enabled` /
 * `staleTime` functions) and encoding walks user data, so either can throw;
 * a failure skips only that entity, like a failing change in `flush`.
 */
function postSnapshot(client: QueryClient): void {
  const queries: QueryEntry[] = [];
  for (const query of client.getQueryCache().getAll()) {
    safely("query snapshot", () => {
      queries.push(encodeQueryEntry(extractQuery(query)).value);
    });
  }
  const mutations: MutationEntry[] = [];
  for (const mutation of client.getMutationCache().getAll()) {
    safely("mutation snapshot", () => {
      mutations.push(encodeMutationEntry(extractMutation(mutation)).value);
    });
  }
  postBridge({
    source: BRIDGE_SOURCE,
    type: "SYNC_SNAPSHOT",
    payload: { queries, mutations },
  });
}

/** Delay between the first queued change and the SYNC_UPDATE that carries it. */
const BATCH_MS = 100;

type PendingKind = "added" | "updated" | "observers" | "removed";

interface PendingMutation {
  readonly kind: Exclude<PendingKind, "observers">;
  readonly mutation: Mutation;
}

/**
 * Precedence of queued change kinds for one entity within a batch: a full
 * entry covers an observer patch, "added" covers "updated", and a removal
 * covers everything queued before it.
 */
const KIND_RANK: Readonly<Record<PendingKind, number>> = {
  observers: 0,
  updated: 1,
  added: 2,
  removed: 3,
};

/**
 * Folds a new change into the one already queued for the same entity. A change
 * that follows a removal re-creates the entity, so it is sent as "added".
 */
function mergeKind<K extends PendingKind>(
  pending: K | undefined,
  incoming: K,
): K | "added" {
  if (pending === undefined) return incoming;
  if (pending === "removed" && incoming !== "removed") return "added";
  return KIND_RANK[incoming] >= KIND_RANK[pending] ? incoming : pending;
}

function queryEventKind(
  type: QueryCacheNotifyEvent["type"],
): PendingKind | null {
  switch (type) {
    case "added":
    case "updated":
    case "removed":
      return type;
    case "observerAdded":
    case "observerRemoved":
      return "observers";
    case "observerResultsUpdated":
    case "observerOptionsUpdated":
      return null;
  }
}

/**
 * Streams the page's caches to the extension only while a viewer is
 * connected: START_SYNC subscribes and posts a snapshot, STOP_SYNC
 * unsubscribes. Cache events are coalesced per query hash and mutation id and
 * flushed as one SYNC_UPDATE per BATCH_MS, so a busy page pays for at most one
 * extraction per changed entity per batch instead of one per cache event.
 */
function createSyncSession() {
  let streaming = false;
  let subscribedClient: QueryClient | null = null;
  let unsubscribe: (() => void) | null = null;
  let pendingQueries = new Map<string, PendingKind>();
  let pendingMutations = new Map<number, PendingMutation>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function discardPending(): void {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingQueries = new Map();
    pendingMutations = new Map();
  }

  function flush(): void {
    flushTimer = null;
    // Swap the batch out first so a failing extraction cannot leave it queued.
    const queries = pendingQueries;
    const mutations = pendingMutations;
    pendingQueries = new Map();
    pendingMutations = new Map();

    const client = subscribedClient;
    if (!client) return;
    const queryCache = client.getQueryCache();
    const changes: ChangeEvent[] = [];

    for (const [queryHash, kind] of queries) {
      // Extraction runs user code (`enabled` / `staleTime` functions) and
      // encoding walks user data, so either can throw. A failure skips only
      // this entity; the rest of the batch still reaches the viewer.
      safely("query change", () => {
        const live = queryCache.get(queryHash);
        let change: ChangeEvent;
        if (kind === "removed" || !live) {
          change = { entityType: "query", changeType: "removed", queryHash };
        } else if (kind === "observers") {
          change = {
            entityType: "query",
            changeType: "observers",
            queryHash,
            patch: extractObserversPatch(live),
          };
        } else {
          change = {
            entityType: "query",
            changeType: kind,
            queryHash,
            entry: extractQuery(live),
          };
        }
        changes.push(encodeChange(change).value);
      });
    }

    for (const [mutationId, { kind, mutation }] of mutations) {
      safely("mutation change", () => {
        const change: ChangeEvent =
          kind === "removed"
            ? { entityType: "mutation", changeType: "removed", mutationId }
            : {
                entityType: "mutation",
                changeType: kind,
                mutationId,
                entry: extractMutation(mutation),
              };
        changes.push(encodeChange(change).value);
      });
    }

    if (changes.length === 0) return;
    // Each change is already encoded, so the batch is not encoded again
    postBridge({
      source: BRIDGE_SOURCE,
      type: "SYNC_UPDATE",
      payload: { changes },
    });
  }

  function scheduleFlush(): void {
    if (flushTimer === null) {
      flushTimer = setTimeout(guarded("sync flush", flush), BATCH_MS);
    }
  }

  function queueQuery(queryHash: string, kind: PendingKind): void {
    pendingQueries.set(
      queryHash,
      mergeKind(pendingQueries.get(queryHash), kind),
    );
    scheduleFlush();
  }

  function queueMutation(
    mutation: Mutation,
    kind: PendingMutation["kind"],
  ): void {
    const pending = pendingMutations.get(mutation.mutationId);
    pendingMutations.set(mutation.mutationId, {
      kind: mergeKind(pending?.kind, kind),
      mutation,
    });
    scheduleFlush();
  }

  function subscribe(client: QueryClient): void {
    const unsubQuery = client.getQueryCache().subscribe(
      guarded("query cache update", (event) => {
        const kind = queryEventKind(event.type);
        if (kind) queueQuery(event.query.queryHash, kind);
      }),
    );
    const unsubMutation = client.getMutationCache().subscribe(
      guarded("mutation cache update", (event) => {
        // Observer events do not change what the devtools show for a mutation
        if (
          event.type === "added" ||
          event.type === "updated" ||
          event.type === "removed"
        ) {
          queueMutation(event.mutation, event.type);
        }
      }),
    );
    subscribedClient = client;
    unsubscribe = () => {
      unsubQuery();
      unsubMutation();
    };
  }

  function unsubscribeClient(): void {
    unsubscribe?.();
    unsubscribe = null;
    subscribedClient = null;
  }

  /** START_SYNC: subscribe to `client` and post a fresh snapshot. Idempotent. */
  function start(client: QueryClient | undefined): void {
    streaming = true;
    discardPending();
    if (!client) {
      unsubscribeClient();
      postBridge({
        source: BRIDGE_SOURCE,
        type: "SYNC_DISCONNECTED",
        payload: {},
      });
      return;
    }
    if (subscribedClient !== client) {
      unsubscribeClient();
      subscribe(client);
    }
    postSnapshot(client);
  }

  /** STOP_SYNC: unsubscribe and drop anything still queued. Idempotent. */
  function stop(): void {
    streaming = false;
    unsubscribeClient();
    discardPending();
  }

  /**
   * The page's client appeared, was replaced, or went away. A client is
   * announced with CLIENT_READY and streamed right away only if a viewer
   * already asked for changes; otherwise subscribing is left to START_SYNC.
   */
  function clientChanged(next: QueryClient | null): void {
    if (next === null) {
      unsubscribeClient();
      discardPending();
      postBridge({
        source: BRIDGE_SOURCE,
        type: "SYNC_DISCONNECTED",
        payload: {},
      });
      return;
    }
    postBridge({ source: BRIDGE_SOURCE, type: "CLIENT_READY", payload: {} });
    if (streaming) start(next);
  }

  return { start, stop, clientChanged };
}

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  main() {
    const session = createSyncSession();
    /** Latest value of the page's global, as seen by the trap or the poll. */
    let currentClient: QueryClient | undefined;
    /**
     * Client last announced with CLIENT_READY; `null` when none was announced
     * or SYNC_DISCONNECTED was posted since. Same-client checks compare against
     * this, never against `currentClient`, which the trap setter assigns first.
     */
    let announcedClient: QueryClient | null = null;
    /** The global is not trapped and is read every CLIENT_POLL_MS. */
    let polling = false;

    function onClientChanged(): void {
      const next = currentClient ?? null;
      if (next === announcedClient) return;
      announcedClient = next;
      session.clientChanged(next);
    }

    /** Poll mode: picks up whatever the page assigned since the last read. */
    function readGlobal(): void {
      const value = window.__TANSTACK_QUERY_CLIENT__;
      if (value !== currentClient) {
        currentClient = value;
        onClientChanged();
      }
    }

    function handleAction(action: ActionType, queryHash: string) {
      const client = currentClient;
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
        const previousOptions = meta?.__previousQueryOptions as
          | typeof query.options
          | undefined;
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

    // Listen for requests the relay forwards from the devtools panel. Any
    // script on the page can post on the window too, so the envelope and the
    // request are validated before anything is read from them.
    window.addEventListener(
      "message",
      guarded("panel request", (event: MessageEvent) => {
        const data: unknown = event.data;
        if (event.source !== window || !isPageRequestEnvelope(data)) return;
        const { request } = data;
        switch (request.type) {
          case "START_SYNC":
            // Poll mode: a swap the next tick would see goes through the same
            // path first, so `announcedClient` cannot go stale
            if (polling) readGlobal();
            session.start(currentClient);
            return;
          case "STOP_SYNC":
            session.stop();
            return;
          case "CLIENT_STATUS_REQUEST":
            // Answered even when already announced: a relay that started after
            // this script missed the startup announcement
            if (currentClient) {
              postBridge({
                source: BRIDGE_SOURCE,
                type: "CLIENT_READY",
                payload: {},
              });
            }
            return;
          case "SET_DATA_REQUEST": {
            const { queryHash, path, value } = request;
            const client = currentClient;
            if (!client) return;
            const query = client.getQueryCache().get(queryHash);
            if (!query) return;
            client.setQueryData(
              query.queryKey,
              skipUnchanged((old) => setAtPath(old, path, value)),
            );
            return;
          }
          case "DELETE_DATA_REQUEST": {
            const { queryHash, path } = request;
            const client = currentClient;
            if (!client) return;
            const query = client.getQueryCache().get(queryHash);
            if (!query) return;
            client.setQueryData(
              query.queryKey,
              skipUnchanged((old) => deleteAtPath(old, path)),
            );
            return;
          }
          case "REMOVE_ALL_QUERIES_REQUEST": {
            const client = currentClient;
            if (!client) return;
            client.getQueryCache().clear();
            return;
          }
          case "CLEAR_MUTATION_CACHE_REQUEST": {
            const client = currentClient;
            if (!client) return;
            client.getMutationCache().clear();
            return;
          }
          case "CLEAR_ARRAY_REQUEST": {
            const { queryHash, path } = request;
            const client = currentClient;
            if (!client) return;
            const query = client.getQueryCache().get(queryHash);
            if (!query) return;
            client.setQueryData(
              query.queryKey,
              skipUnchanged((old) => clearAtPath(old, path)),
            );
            return;
          }
          case "ACTION_REQUEST":
            handleAction(request.action, request.queryHash);
            return;
        }
      }),
    );

    // Track the page's client through its global: seed with the current
    // value, then trap later assignments. The trap only replaces a plain
    // assignable slot: no property at all, or the configurable writable data
    // property that `window.__TANSTACK_QUERY_CLIENT__ = client` creates.
    // Anything the page shaped itself (its own or an inherited accessor, a
    // read-only or non-configurable property) keeps the page's semantics and
    // is polled instead.
    currentClient = window.__TANSTACK_QUERY_CLIENT__;
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      "__TANSTACK_QUERY_CLIENT__",
    );
    const trappable =
      descriptor === undefined
        ? !("__TANSTACK_QUERY_CLIENT__" in window)
        : descriptor.configurable === true &&
          "value" in descriptor &&
          descriptor.writable === true;
    if (trappable) {
      Object.defineProperty(window, "__TANSTACK_QUERY_CLIENT__", {
        configurable: true,
        enumerable: true,
        get: () => currentClient,
        set: (value: QueryClient | undefined) => {
          currentClient = value;
          safely("client change", onClientChanged);
        },
      });
    } else {
      polling = true;
      setInterval(guarded("client detection", readGlobal), CLIENT_POLL_MS);
    }

    // The common case is an app that created its client before this script
    // was injected: announce it now. Streaming still waits for START_SYNC
    // from a connected viewer.
    safely("client startup", onClientChanged);
  },
});
