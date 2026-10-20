import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  DevtoolsActions,
  ViewerToBackgroundMessage,
} from "@/types/messages";
import type { LayoutVariant } from "@/types/ui";
import {
  createViewerStream,
  initialSyncState,
  syncReducer,
} from "@/utils/viewer-sync";

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
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
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

      const handleMessage = createViewerStream(dispatch);
      port.onMessage.addListener((message: unknown) => {
        // Any message proves the connection works, so later losses get the
        // full retry budget again.
        retries = 0;
        handleMessage(message);
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
    status: state.status,
    actions,
  };
}
