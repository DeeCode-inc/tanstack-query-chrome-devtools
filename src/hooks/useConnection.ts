import { useState, useEffect, useRef, useCallback } from "react";
import type { QueryData, MutationData } from "../types/query";
import { safeDeserialize } from "../utils/serialization";

interface UseConnectionReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  artificialStates: Map<string, "loading" | "error">;

  // Actions
  sendMessage: (message: unknown) => void;
}

export const useConnection = (): UseConnectionReturn => {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<
    boolean | null
  >(null);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  // Track artificial states triggered by DevTools
  const [artificialStates, setArtificialStates] = useState<
    Map<string, "loading" | "error">
  >(new Map());

  // Connection management
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send message function
  const sendMessage = useCallback((message: unknown) => {
    if (portRef.current) {
      try {
        portRef.current.postMessage(message);
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    } else {
      throw new Error("Not connected to background script");
    }
  }, []);

  const connectToBackground = useCallback(() => {
    try {
      const port = chrome.runtime.connect({ name: "devtools" });
      portRef.current = port;

      // Send the inspected tab ID immediately after connection
      const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
      port.postMessage({
        type: "DEVTOOLS_CONNECT",
        inspectedTabId: inspectedTabId,
        timestamp: Date.now(),
      });

      port.onMessage.addListener((message) => {
        if (message.type === "INITIAL_STATE") {
          // Clear previous data when connecting to a different tab
          setQueries([]);
          setMutations([]);
          setArtificialStates(new Map());
          setTanStackQueryDetected(message.hasTanStackQuery);
        } else if (message.type === "QEVENT") {
          // Deserialize payload if it was serialized
          let payload = message.payload;
          if (
            payload &&
            typeof payload === "object" &&
            payload.isSerializedPayload
          ) {
            try {
              payload = safeDeserialize(payload.serialized);
            } catch (error) {
              console.error(
                "Failed to deserialize payload in DevTools:",
                error,
              );
              payload = {
                error: "Deserialization failed",
                originalPayload: payload,
              };
            }
          }

          switch (message.subtype) {
            case "QUERY_CLIENT_DETECTED":
              setTanStackQueryDetected(true);
              // Clear artificial states when TanStack Query is detected (page refresh/reload)
              setArtificialStates(new Map());
              break;
            case "QUERY_CLIENT_NOT_FOUND":
              setTanStackQueryDetected(false);
              // Clear artificial states when TanStack Query is not found
              setArtificialStates(new Map());
              break;
            case "QUERY_STATE_UPDATE":
              break;
            case "QUERY_DATA_UPDATE":
              if (Array.isArray(payload)) {
                setQueries(payload);
              }
              break;
            case "MUTATION_DATA_UPDATE":
              if (Array.isArray(payload)) {
                setMutations(payload);
              }
              break;
          }
        } else if (message.type === "QUERY_ACTION_RESULT") {
          // Update artificial states based on action results
          if (
            message.success &&
            (message.action === "TRIGGER_LOADING" ||
              message.action === "TRIGGER_ERROR")
          ) {
            setArtificialStates((prev) => {
              const newStates = new Map(prev);
              const queryHash = message.queryHash;

              if (message.action === "TRIGGER_LOADING") {
                if (newStates.get(queryHash) === "loading") {
                  // Cancel loading state
                  newStates.delete(queryHash);
                } else {
                  // Start loading state
                  newStates.set(queryHash, "loading");
                }
              } else if (message.action === "TRIGGER_ERROR") {
                if (newStates.get(queryHash) === "error") {
                  // Cancel error state
                  newStates.delete(queryHash);
                } else {
                  // Start error state
                  newStates.set(queryHash, "error");
                }
              }

              return newStates;
            });
          }
        }
      });
    } catch (error) {
      console.error("Failed to connect to background script:", error);
    }
  }, []);

  useEffect(() => {
    connectToBackground();

    const reconnectTimeout = reconnectTimeoutRef.current;

    // Cleanup function
    return () => {
      portRef.current?.disconnect();
      portRef.current = null;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [connectToBackground]);

  return {
    // State
    tanStackQueryDetected,
    queries,
    mutations,
    artificialStates,

    // Actions
    sendMessage,
  };
};
