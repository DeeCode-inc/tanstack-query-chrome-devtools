// Background service worker - handles extension lifecycle and message routing

// Track which tabs have TanStack Query detected
const tabsWithTanStackQuery = new Set<number>();

// Tab-specific connection tracking
interface TabConnection {
  devtoolsPort: chrome.runtime.Port | null;
  inspectedTabId: number;
  connectionId: string;
  connectedAt: number;
  lastPing: number;
}

// Track DevTools connections per inspected tab
const tabConnections = new Map<number, TabConnection>();

// Message types
interface TanStackQueryMessage {
  type: "QEVENT";
  subtype:
    | "QUERY_CLIENT_DETECTED"
    | "QUERY_CLIENT_NOT_FOUND"
    | "QUERY_STATE_UPDATE"
    | "QUERY_DATA_UPDATE"
    | "MUTATION_DATA_UPDATE";
  payload?: unknown;
}

// Action result message
interface QueryActionResult {
  type: "QUERY_ACTION_RESULT";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET";
  queryKey: readonly unknown[];
  success: boolean;
  error?: string;
}

// Handle DevTools connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "devtools") {
    const connectionId = `devtools-${Date.now()}`;
    let inspectedTabId: number | null = null;

    port.onMessage.addListener(async (message) => {
      // Handle DevTools connection with inspected tab ID
      if (message.type === "DEVTOOLS_CONNECT") {
        inspectedTabId = message.inspectedTabId;

        // Validate that we have a valid tab ID
        if (!inspectedTabId) {
          console.error("Invalid inspected tab ID received");
          return;
        }

        // Store this connection for the inspected tab
        const connection: TabConnection = {
          devtoolsPort: port,
          inspectedTabId,
          connectionId,
          connectedAt: Date.now(),
          lastPing: Date.now(),
        };

        tabConnections.set(inspectedTabId, connection);

        // Send initial state for this specific tab
        port.postMessage({
          type: "INITIAL_STATE",
          hasTanStackQuery: tabsWithTanStackQuery.has(inspectedTabId),
        });

        // Request immediate update from the inspected tab
        try {
          await chrome.tabs.sendMessage(inspectedTabId, {
            type: "REQUEST_IMMEDIATE_UPDATE",
          });
        } catch (error: unknown) {
          console.warn("Failed to request immediate update:", error);
        }

        // Send connection confirmation
        port.postMessage({
          type: "CONNECTION_ESTABLISHED",
          connectionId,
          inspectedTabId,
          timestamp: Date.now(),
        });

        return;
      }

      // Handle ping messages for connection health
      if (message.type === "PING" && inspectedTabId) {
        const connection = tabConnections.get(inspectedTabId);
        if (connection) {
          connection.lastPing = Date.now();
          port.postMessage({
            type: "PONG",
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Forward other messages to the inspected tab's content script
      if (inspectedTabId && message.type) {
        chrome.tabs
          .sendMessage(inspectedTabId, message)
          .catch((error: unknown) => {
            console.warn("Failed to send message to content script:", error);
          });
      }
    });

    port.onDisconnect.addListener(() => {
      // Clean up this connection
      if (inspectedTabId) {
        tabConnections.delete(inspectedTabId);
      }
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (message: TanStackQueryMessage | QueryActionResult, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    // Get the DevTools connection for this specific tab
    const connection = tabConnections.get(tabId);

    if (message.type === "QEVENT") {
      switch (message.subtype) {
        case "QUERY_CLIENT_DETECTED":
          tabsWithTanStackQuery.add(tabId);

          // Forward to DevTools panel for this specific tab only
          connection?.devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_CLIENT_DETECTED",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_CLIENT_NOT_FOUND":
          tabsWithTanStackQuery.delete(tabId);

          // Forward to DevTools panel for this specific tab only
          connection?.devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_CLIENT_NOT_FOUND",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_STATE_UPDATE":
          // Forward to DevTools panel for this specific tab only
          connection?.devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_STATE_UPDATE",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_DATA_UPDATE":
          // Forward to DevTools panel for this specific tab only
          connection?.devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_DATA_UPDATE",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "MUTATION_DATA_UPDATE":
          // Forward to DevTools panel for this specific tab only
          connection?.devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "MUTATION_DATA_UPDATE",
            tabId: tabId,
            payload: message.payload,
          });
          break;
      }
    }

    // Handle query action results from content script
    if (message.type === "QUERY_ACTION_RESULT") {
      // Forward to DevTools panel for this specific tab only
      connection?.devtoolsPort?.postMessage({
        ...message,
        tabId: tabId,
      });
    }

    sendResponse({ received: true });
  },
);

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithTanStackQuery.delete(tabId);
  tabConnections.delete(tabId);
});

// Extension lifecycle
chrome.runtime.onStartup.addListener(() => {});

chrome.runtime.onInstalled.addListener(() => {});
