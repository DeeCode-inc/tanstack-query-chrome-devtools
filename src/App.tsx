import { useState, useEffect, useRef, useCallback } from "react";
import JsonView from "@microlink/react-json-view";
import type { QueryKey, QueryObserverBaseResult } from "@tanstack/query-core";

// Query data interface using TanStack Query types
interface QueryData {
  queryKey: QueryKey;
  state: QueryObserverBaseResult<unknown, unknown>;
  meta?: Record<string, unknown>;
  isActive: boolean;
  observersCount: number;
}

// Helper function to get status icon and color
function getStatusDisplay(query: QueryData) {
  if (query.state.isFetching) {
    return { icon: "🔄", color: "#007bff", text: "Fetching" };
  }

  switch (query.state.status) {
    case "success":
      return { icon: "✅", color: "#28a745", text: "Success" };
    case "error":
      return { icon: "❌", color: "#dc3545", text: "Error" };
    case "pending":
      return { icon: "⏳", color: "#ffc107", text: "Pending" };
    default:
      return { icon: "❓", color: "#6c757d", text: "Unknown" };
  }
}

// Helper function to format query key
function formatQueryKey(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey).replace(/"/g, "");
  } catch {
    return String(queryKey);
  }
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// QueryItem component with expandable details
function QueryItem({ query, onAction }: { query: QueryData; onAction: (action: string, queryKey: QueryKey) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const status = getStatusDisplay(query);
  const lastUpdated = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await onAction(action, query.queryKey);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      style={{
        borderBottom: "1px solid #e9ecef",
      }}
    >
      {/* Query header - clickable */}
      <div
        onClick={toggleExpanded}
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "14px",
          cursor: "pointer",
          backgroundColor: isExpanded ? "#f8f9fa" : "transparent",
          transition: "background-color 0.2s ease",
        }}
      >
        {/* Expand/collapse indicator */}
        <div
          style={{
            fontSize: "12px",
            color: "#6c757d",
            minWidth: "16px",
          }}
        >
          {isExpanded ? "▼" : "▶"}
        </div>

        {/* Status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: "100px",
          }}
        >
          <span style={{ fontSize: "16px" }}>{status.icon}</span>
          <span style={{ color: status.color, fontWeight: "500" }}>{status.text}</span>
        </div>

        {/* Query key */}
        <div
          style={{
            flex: 1,
            fontFamily: "monospace",
            backgroundColor: "#f8f9fa",
            padding: "4px 8px",
            borderRadius: "3px",
            fontSize: "13px",
          }}
        >
          {formatQueryKey(query.queryKey)}
        </div>

        {/* Active indicator */}
        {query.isActive && (
          <div
            style={{
              fontSize: "12px",
              backgroundColor: "#007bff",
              color: "white",
              padding: "2px 6px",
              borderRadius: "10px",
            }}
          >
            Active ({query.observersCount})
          </div>
        )}

        {/* Stale indicator */}
        {query.state.isStale && (
          <div
            style={{
              fontSize: "12px",
              backgroundColor: "#ffc107",
              color: "#212529",
              padding: "2px 6px",
              borderRadius: "10px",
            }}
          >
            Stale
          </div>
        )}

        {/* Last updated */}
        <div
          style={{
            fontSize: "12px",
            color: "#6c757d",
            minWidth: "60px",
            textAlign: "right",
          }}
        >
          {lastUpdated > 0 ? formatRelativeTime(lastUpdated) : "-"}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: "0 16px 16px 44px", // Align with content, account for arrow
            backgroundColor: "#f8f9fa",
            borderTop: "1px solid #e9ecef",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
              }}
            >
              Data
            </h4>
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                padding: "12px",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {query.state.data !== undefined && query.state.data !== null ? (
                <JsonView
                  src={query.state.data}
                  collapsed={2}
                  displayDataTypes={false}
                  displayObjectSize={true}
                  enableClipboard={true}
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
              ) : (
                <div
                  style={{
                    color: "#6c757d",
                    fontStyle: "italic",
                    fontSize: "12px",
                  }}
                >
                  No data available
                </div>
              )}
            </div>
          </div>

          {query.state.error ? (
            <div style={{ marginBottom: "16px" }}>
              <h4
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#dc3545",
                }}
              >
                Error
              </h4>
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #f5c6cb",
                  borderRadius: "4px",
                  padding: "12px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                <JsonView
                  src={query.state.error}
                  collapsed={1}
                  displayDataTypes={false}
                  displayObjectSize={true}
                  enableClipboard={true}
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
              </div>
            </div>
          ) : undefined}

          <div style={{ marginBottom: "16px" }}>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
              }}
            >
              Actions
            </h4>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction("REFETCH");
                }}
                disabled={actionLoading !== null}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  border: "1px solid #007bff",
                  backgroundColor: actionLoading === "REFETCH" ? "#f8f9fa" : "#007bff",
                  color: actionLoading === "REFETCH" ? "#6c757d" : "#fff",
                  borderRadius: "4px",
                  cursor: actionLoading !== null ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {actionLoading === "REFETCH" ? "🔄" : "🔄"}
                {actionLoading === "REFETCH" ? "Refetching..." : "Refetch"}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction("INVALIDATE");
                }}
                disabled={actionLoading !== null}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  border: "1px solid #ffc107",
                  backgroundColor: actionLoading === "INVALIDATE" ? "#f8f9fa" : "#ffc107",
                  color: actionLoading === "INVALIDATE" ? "#6c757d" : "#212529",
                  borderRadius: "4px",
                  cursor: actionLoading !== null ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {actionLoading === "INVALIDATE" ? "🔄" : "❌"}
                {actionLoading === "INVALIDATE" ? "Invalidating..." : "Invalidate"}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to remove this query from cache?\n\nQuery: ${formatQueryKey(query.queryKey)}`)) {
                    handleAction("REMOVE");
                  }
                }}
                disabled={actionLoading !== null}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  border: "1px solid #dc3545",
                  backgroundColor: actionLoading === "REMOVE" ? "#f8f9fa" : "#dc3545",
                  color: actionLoading === "REMOVE" ? "#6c757d" : "#fff",
                  borderRadius: "4px",
                  cursor: actionLoading !== null ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {actionLoading === "REMOVE" ? "🔄" : "🗑️"}
                {actionLoading === "REMOVE" ? "Removing..." : "Remove"}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (query.isActive && confirm(`This query has ${query.observersCount} active observers. Are you sure you want to reset it?\n\nQuery: ${formatQueryKey(query.queryKey)}`)) {
                    handleAction("RESET");
                  } else if (!query.isActive) {
                    handleAction("RESET");
                  }
                }}
                disabled={actionLoading !== null}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  border: "1px solid #6c757d",
                  backgroundColor: actionLoading === "RESET" ? "#f8f9fa" : "#6c757d",
                  color: actionLoading === "RESET" ? "#6c757d" : "#fff",
                  borderRadius: "4px",
                  cursor: actionLoading !== null ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {actionLoading === "RESET" ? "🔄" : "↩️"}
                {actionLoading === "RESET" ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>

          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
              }}
            >
              Metadata
            </h4>
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                padding: "12px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
                <strong>Status:</strong>
                <span style={{ color: status.color }}>{query.state.status}</span>

                <strong>Fetching:</strong>
                <span>{query.state.isFetching ? "Yes" : "No"}</span>

                <strong>Stale:</strong>
                <span>{query.state.isStale ? "Yes" : "No"}</span>

                <strong>Active:</strong>
                <span>{query.isActive ? `Yes (${query.observersCount} observers)` : "No"}</span>

                <strong>Data Updated:</strong>
                <span>{query.state.dataUpdatedAt > 0 ? new Date(query.state.dataUpdatedAt).toLocaleString() : "Never"}</span>

                <strong>Error Updated:</strong>
                <span>{query.state.errorUpdatedAt > 0 ? new Date(query.state.errorUpdatedAt).toLocaleString() : "Never"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<boolean | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("connecting");
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Connection management
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle query actions
  const handleQueryAction = useCallback(async (action: string, queryKey: QueryKey) => {
    if (!portRef.current) {
      setActionFeedback({
        message: "Not connected to background script",
        type: "error"
      });
      return;
    }

    console.log("Sending query action:", action, queryKey);

    try {
      portRef.current.postMessage({
        type: "QUERY_ACTION",
        action: action,
        queryKey: queryKey
      });
    } catch (error) {
      console.error("Failed to send action:", error);
      setActionFeedback({
        message: `Failed to send ${action.toLowerCase()} action`,
        type: "error"
      });
    }
  }, []);

  // Clear action feedback after delay
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const connectToBackground = useCallback(() => {
    try {
      console.log("Attempting to connect to background script...");
      const port = chrome.runtime.connect({ name: "devtools" });
      portRef.current = port;

      setConnectionStatus("connecting");

      port.onMessage.addListener((message) => {
        console.log("DevTools panel received message:", message);

        if (message.type === "CONNECTION_ESTABLISHED") {
          setConnectionId(message.connectionId);
          setConnectionStatus("connected");
          setReconnectAttempts(0);
          console.log("Connection established:", message.connectionId);

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
          console.log("Received pong, connection healthy");
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
              console.log("Query state update:", message.payload);
              break;
            case "QUERY_DATA_UPDATE":
              console.log("Query data update:", message.payload);
              if (Array.isArray(message.payload)) {
                setQueries(message.payload);
              }
              break;
          }
        } else if (message.type === "QUERY_ACTION_RESULT") {
          console.log("Query action result:", message);
          if (message.success) {
            setActionFeedback({
              message: `${message.action.toLowerCase()} completed successfully`,
              type: "success"
            });
          } else {
            setActionFeedback({
              message: `${message.action.toLowerCase()} failed: ${message.error || "Unknown error"}`,
              type: "error"
            });
          }
        }
      });

      port.onDisconnect.addListener(() => {
        console.log("Port disconnected");
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
          setConnectionStatus("reconnecting");
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
          console.log(`Reconnecting in ${delay}ms (attempt ${attempt}/5)`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectToBackground();
          }, delay);
        } else {
          setConnectionStatus("disconnected");
          console.error("Failed to reconnect after 5 attempts");
        }
      });
    } catch (error) {
      console.error("Failed to connect to background script:", error);
      setConnectionStatus("disconnected");
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

  return (
    <div className="p-5 font-sans text-sm">
      <h1 className="text-lg font-semibold mb-5">🏠 TanStack Query DevTools</h1>

      <div className="mb-5">
        <h3 className="text-base font-medium mb-2">Connection Status</h3>
        <div
          className={`
            p-2.5 rounded border
            ${connectionStatus === "connected"
              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700"
              : connectionStatus === "reconnecting"
              ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700"
              : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-700"
            }
          `}
        >
          {connectionStatus === "connecting" && "🔄 Connecting..."}
          {connectionStatus === "connected" && `✅ Connected to background script${connectionId ? ` (${connectionId})` : ""}`}
          {connectionStatus === "reconnecting" && `🔄 Reconnecting... (attempt ${reconnectAttempts}/5)`}
          {connectionStatus === "disconnected" && "❌ Disconnected - Failed to reconnect after 5 attempts"}
        </div>
      </div>

      <div className="mb-5">
        <h3 className="text-base font-medium mb-2">TanStack Query Detection</h3>
        <div
          className={`
            p-2.5 rounded border
            ${tanStackQueryDetected === true
              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700"
              : tanStackQueryDetected === false
              ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700"
              : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            }
          `}
        >
          {tanStackQueryDetected === null && "🔍 Checking for TanStack Query..."}
          {tanStackQueryDetected === true && "🎉 TanStack Query detected on this page!"}
          {tanStackQueryDetected === false && "⚠️ TanStack Query not found on this page"}
        </div>
      </div>

      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="mb-5">
          <div
            className={`
              p-2.5 rounded border flex items-center justify-between
              ${actionFeedback.type === "success"
                ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700"
                : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-700"
              }
            `}
          >
            <span>
              {actionFeedback.type === "success" ? "✅" : "❌"} {actionFeedback.message}
            </span>
            <button
              onClick={() => setActionFeedback(null)}
              className={`
                bg-transparent border-none text-base cursor-pointer px-1
                ${actionFeedback.type === "success"
                  ? "text-green-800 dark:text-green-100"
                  : "text-red-800 dark:text-red-100"
                }
              `}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {tanStackQueryDetected === true && (
        <div className="mb-5">
          <h3 className="text-base font-medium mb-4">Queries ({queries.length})</h3>

          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* Query list */}
          <div className="border border-gray-200 rounded bg-white dark:border-gray-600 dark:bg-gray-800">
            {queries.length === 0 ? (
              <div className="p-5 text-center text-gray-500 dark:text-gray-400">
                No queries found. Make sure window.queryClient is set in your application.
              </div>
            ) : (
              queries
                .filter((query) => {
                  if (!searchTerm) return true;
                  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
                  return queryKeyStr.includes(searchTerm.toLowerCase());
                })
                .map((query, index) => <QueryItem key={index} query={query} onAction={handleQueryAction} />)
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-10 dark:text-gray-400">
        <p>TanStack Query Chrome DevTools v0.1.0</p>
        <p>Extension context: DevTools Panel</p>
      </div>
    </div>
  );
}

export default App;
