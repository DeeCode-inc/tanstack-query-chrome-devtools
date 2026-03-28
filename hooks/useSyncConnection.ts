import { useCallback, useEffect, useReducer, useRef } from "react";
import type { QueryEntry, MutationEntry, LayoutVariant } from "@/types/ui";
import type { PortMessage, ChangeEvent, ActionType, PathSegment } from "@/types/messages";
import { decodeBigInts } from "@/utils/serialization";

interface SyncState {
  queries: Map<string, QueryEntry>;
  mutations: Map<number, MutationEntry>;
  connected: boolean;
}

type SyncAction =
  | { type: "SNAPSHOT"; queries: readonly QueryEntry[]; mutations: readonly MutationEntry[] }
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
      const queries = new Map(state.queries);
      const mutations = new Map(state.mutations);
      for (const change of action.changes) {
        if (change.entityType === "query") {
          if (change.changeType === "removed") {
            queries.delete(change.queryHash);
          } else if (change.entry) {
            queries.set(change.queryHash, change.entry);
          }
        } else {
          if (change.changeType === "removed") {
            mutations.delete(change.mutationId);
          } else if (change.entry) {
            mutations.set(change.mutationId, change.entry);
          }
        }
      }
      return { queries, mutations, connected: true };
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

export function useSyncConnection({ tabId, variant }: UseSyncConnectionOptions) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const portRef = useRef<ReturnType<typeof browser.runtime.connect> | null>(null);

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
        port.postMessage({ type: "PANEL_CONNECT", tabId } as PortMessage);
      } else if (variant === "popup") {
        port.postMessage({ type: "POPUP_CONNECT" } as PortMessage);
      }

      port.onMessage.addListener((message: unknown) => {
        const msg = message as PortMessage;
        switch (msg.type) {
          case "SYNC_SNAPSHOT":
            dispatch({
              type: "SNAPSHOT",
              queries: decodeBigInts(msg.queries) as readonly QueryEntry[],
              mutations: decodeBigInts(msg.mutations) as readonly MutationEntry[],
            });
            break;
          case "SYNC_UPDATE":
            dispatch({ type: "UPDATE", changes: decodeBigInts(msg.changes) as readonly ChangeEvent[] });
            break;
          case "SYNC_DISCONNECTED":
            dispatch({ type: "DISCONNECTED" });
            break;
          case "SYNC_CLEAR":
            dispatch({ type: "CLEAR" });
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

      // Reset retries on successful message receipt
      retries = 0;
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
  }, [tabId, variant]);

  const sendAction = useCallback((action: ActionType, queryHash: string) => {
    portRef.current?.postMessage({
      type: "ACTION_REQUEST",
      action,
      queryHash,
    } as PortMessage);
  }, []);

  const sendSetData = useCallback((queryHash: string, path: readonly PathSegment[], value: string | number | boolean) => {
    portRef.current?.postMessage({
      type: "SET_DATA_REQUEST",
      queryHash,
      path,
      value,
    } as PortMessage);
  }, []);

  const sendDeleteData = useCallback((queryHash: string, path: readonly PathSegment[]) => {
    portRef.current?.postMessage({
      type: "DELETE_DATA_REQUEST",
      queryHash,
      path,
    } as PortMessage);
  }, []);

  const sendRemoveAllQueries = useCallback(() => {
    portRef.current?.postMessage({
      type: "REMOVE_ALL_QUERIES_REQUEST",
    } as PortMessage);
  }, []);

  const sendClearArray = useCallback((queryHash: string, path: readonly PathSegment[]) => {
    portRef.current?.postMessage({
      type: "CLEAR_ARRAY_REQUEST",
      queryHash,
      path,
    } as PortMessage);
  }, []);

  const sendClearMutationCache = useCallback(() => {
    portRef.current?.postMessage({
      type: "CLEAR_MUTATION_CACHE_REQUEST",
    } as PortMessage);
  }, []);

  return {
    queries: Array.from(state.queries.values()),
    mutations: Array.from(state.mutations.values()),
    connected: state.connected,
    sendAction,
    sendSetData,
    sendDeleteData,
    sendRemoveAllQueries,
    sendClearArray,
    sendClearMutationCache,
  };
}
