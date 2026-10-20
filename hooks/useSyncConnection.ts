import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  ChangeEvent,
  DevtoolsActions,
  ViewerToBackgroundMessage,
} from "@/types/messages";
import type { LayoutVariant, MutationEntry, QueryEntry } from "@/types/ui";
import { applyChanges } from "@/utils/apply-changes";
import { isBackgroundToViewerMessage } from "@/utils/guards";
import { decodeBigInts } from "@/utils/serialization";

/**
 * Reverses the wire encoding of a payload that passed the viewer guard.
 * `decodeBigInts` reverses exactly the sentinels the page's encoder writes,
 * so the payload keeps its static type. This is the only cast on decoder
 * output.
 */
function decodeWire<T>(value: T): T {
  return decodeBigInts(value) as T;
}

interface SyncState {
  queries: Map<string, QueryEntry>;
  mutations: Map<number, MutationEntry>;
  connected: boolean;
}

type SyncAction =
  | {
      type: "SNAPSHOT";
      queries: readonly QueryEntry[];
      mutations: readonly MutationEntry[];
    }
  | { type: "UPDATE"; changes: readonly ChangeEvent[] }
  | { type: "DISCONNECTED" }
  | { type: "CLEAR" };

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case "SNAPSHOT": {
      const queries = new Map<string, QueryEntry>();
      for (const q of action.queries) queries.set(q.queryHash, q);
      const mutations = new Map<number, MutationEntry>();
      for (const m of action.mutations) mutations.set(m.mutationId, m);
      return { queries, mutations, connected: true };
    }
    case "UPDATE": {
      // Changes only apply on top of a snapshot; before one (or after a
      // disconnect) there is nothing consistent to patch.
      if (!state.connected) return state;
      // Copy only a map the batch can touch; an untouched map keeps its
      // identity so the memoized list built from it is reused.
      const queries = action.changes.some((c) => c.entityType === "query")
        ? new Map(state.queries)
        : state.queries;
      const mutations = action.changes.some((c) => c.entityType === "mutation")
        ? new Map(state.mutations)
        : state.mutations;
      const { queriesChanged, mutationsChanged } = applyChanges(
        queries,
        mutations,
        action.changes,
      );
      if (!queriesChanged && !mutationsChanged) return state;
      return {
        queries: queriesChanged ? queries : state.queries,
        mutations: mutationsChanged ? mutations : state.mutations,
        connected: true,
      };
    }
    case "DISCONNECTED":
    case "CLEAR":
      return { queries: new Map(), mutations: new Map(), connected: false };
  }
}

const initialState: SyncState = {
  queries: new Map(),
  mutations: new Map(),
  connected: false,
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

interface UseSyncConnectionOptions {
  tabId?: number;
  variant: LayoutVariant;
}

export function useSyncConnection({
  tabId,
  variant,
}: UseSyncConnectionOptions) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const portRef = useRef<ReturnType<typeof browser.runtime.connect> | null>(
    null,
  );

  const post = useCallback((message: ViewerToBackgroundMessage) => {
    portRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    let retries = 0;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (disposed) return;

      const portName = variant === "panel" ? "panel" : "popup";
      const port = browser.runtime.connect({ name: portName });
      portRef.current = port;

      // Send init message
      if (variant === "panel" && tabId !== undefined) {
        post({ type: "PANEL_CONNECT", tabId });
      } else if (variant === "popup") {
        post({ type: "POPUP_CONNECT" });
      }

      port.onMessage.addListener((message: unknown) => {
        // Any message proves the connection works, so later losses get the
        // full retry budget again.
        retries = 0;
        // Checked on the encoded form; decoding never throws and keeps the
        // checked structure
        if (!isBackgroundToViewerMessage(message)) return;
        switch (message.type) {
          case "SYNC_SNAPSHOT":
            dispatch({
              type: "SNAPSHOT",
              queries: decodeWire(message.queries),
              mutations: decodeWire(message.mutations),
            });
            break;
          case "SYNC_UPDATE":
            dispatch({
              type: "UPDATE",
              changes: decodeWire(message.changes),
            });
            break;
          case "SYNC_DISCONNECTED":
            dispatch({ type: "DISCONNECTED" });
            break;
          case "SYNC_CLEAR":
            dispatch({ type: "CLEAR" });
            break;
          case "CONNECT_ACK":
            // Only resets the retry budget (above); carries no state
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        portRef.current = null;
        if (disposed) return;

        if (retries < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retries];
          if (delay === undefined) return;
          retries++;
          retryTimer = setTimeout(connect, delay);
        } else {
          dispatch({ type: "DISCONNECTED" });
        }
      });
    }

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [tabId, variant, post]);

  // `post` only reads the ref, so it and `actions` keep one identity for the
  // lifetime of the hook.
  const actions = useMemo<DevtoolsActions>(
    () => ({
      sendAction: (action, queryHash) => {
        post({ type: "ACTION_REQUEST", action, queryHash });
      },
      sendSetData: (queryHash, path, value) => {
        post({ type: "SET_DATA_REQUEST", queryHash, path, value });
      },
      sendDeleteData: (queryHash, path) => {
        post({ type: "DELETE_DATA_REQUEST", queryHash, path });
      },
      sendRemoveAllQueries: () => {
        post({ type: "REMOVE_ALL_QUERIES_REQUEST" });
      },
      sendClearArray: (queryHash, path) => {
        post({ type: "CLEAR_ARRAY_REQUEST", queryHash, path });
      },
      sendClearMutationCache: () => {
        post({ type: "CLEAR_MUTATION_CACHE_REQUEST" });
      },
    }),
    [post],
  );

  // New arrays only when the underlying map changed, so list components
  // memoized on them skip sorting and filtering for unrelated updates.
  const queries = useMemo(
    () => Array.from(state.queries.values()),
    [state.queries],
  );
  const mutations = useMemo(
    () => Array.from(state.mutations.values()),
    [state.mutations],
  );

  return {
    queries,
    mutations,
    connected: state.connected,
    actions,
  };
}
