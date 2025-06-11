import { useState, useEffect, useRef, useCallback } from "react";
import type { QueryData, MutationData } from "../types/query";

interface UseConnectionReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  reconnectAttempts: number;
  artificialStates: Map<string, "loading" | "error">;

  // Actions
  sendMessage: (message: unknown) => void;
  setArtificialStates: React.Dispatch<React.SetStateAction<Map<string, "loading" | "error">>>;

  // Connection status (derived)
  isConnected: boolean;
}

export const useConnection = (): UseConnectionReturn => {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<boolean | null>(null);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  // Track artificial states triggered by DevTools
  const [artificialStates, setArtificialStates] = useState<Map<string, "loading" | "error">>(new Map());

  // Connection management
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      port.onMessage.addListener((message) => {
        if (message.type === "CONNECTION_ESTABLISHED") {
          setReconnectAttempts(0);

          // Start heartbeat
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          heartbeatIntervalRef.current = setInterval(() => {
            if (portRef.current) {
              try {
                portRef.current.postMessage({ type: "PING", timestamp: Date.now() });
              } catch (error) {
                console.warn("Failed to send ping:", error);
              }
            }
          }, 10000); // Ping every 10 seconds
        } else if (message.type === "PONG") {
          // Connection is healthy
        } else if (message.type === "INITIAL_STATE") {
          setTanStackQueryDetected(message.hasTanStackQuery);
        } else if (message.type === "QEVENT") {
          switch (message.subtype) {
            case "QUERY_CLIENT_DETECTED":
              setTanStackQueryDetected(true);
              break;
            case "QUERY_CLIENT_NOT_FOUND":
              setTanStackQueryDetected(false);
              break;
            case "QUERY_STATE_UPDATE":
              break;
            case "QUERY_DATA_UPDATE":
              if (Array.isArray(message.payload)) {
                setQueries(message.payload);
              }
              break;
            case "MUTATION_DATA_UPDATE":
              if (Array.isArray(message.payload)) {
                setMutations(message.payload);
              }
              break;
          }
        } else if (message.type === "QUERY_ACTION_RESULT") {
          // Update artificial states based on action results
          if (message.success && (message.action === "TRIGGER_LOADING" || message.action === "TRIGGER_ERROR")) {
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

      port.onDisconnect.addListener(() => {
        portRef.current = null;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection with exponential backoff
        const attempt = reconnectAttempts + 1;
        setReconnectAttempts(attempt);

        if (attempt <= 5) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay

          reconnectTimeoutRef.current = setTimeout(() => {
            connectToBackground();
          }, delay);
        } else {
          console.error("Failed to reconnect after 5 attempts");
        }
      });
    } catch (error) {
      console.error("Failed to connect to background script:", error);
    }
  }, [reconnectAttempts]);

  useEffect(() => {
    connectToBackground();

    // Cleanup function
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connectToBackground]);

  return {
    // State
    tanStackQueryDetected,
    queries,
    mutations,
    reconnectAttempts,
    artificialStates,

    // Actions
    sendMessage,
    setArtificialStates,

    // Connection status (derived)
    isConnected: portRef.current !== null,
  };
};
