// Background service worker - handles extension lifecycle and message routing

// Track which tabs have TanStack Query detected
const tabsWithTanStackQuery = new Set<number>();

// Connection health tracking
interface ConnectionInfo {
  port: chrome.runtime.Port;
  tabId: number | null;
  connectedAt: number;
  lastPing: number;
}

const activeConnections = new Map<string, ConnectionInfo>();

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

// Store DevTools port connection
let devtoolsPort: chrome.runtime.Port | null = null;

// Handle DevTools connections
chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name === "devtools") {
    const connectionId = `devtools-${Date.now()}`;
    devtoolsPort = port;

    // Get current tab ID asynchronously
    const currentTabId = await getCurrentTabId();

    if (currentTabId) {
      chrome.tabs
        .sendMessage(currentTabId, {
          type: "REQUEST_IMMEDIATE_UPDATE",
        })
        .catch((error: unknown) => {
          console.warn("Failed to request immediate update:", error);
        });
    }

    // Track this connection
    activeConnections.set(connectionId, {
      port,
      tabId: currentTabId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    });

    // Send initial state to DevTools
    if (currentTabId) {
      port.postMessage({
        type: "INITIAL_STATE",
        hasTanStackQuery: tabsWithTanStackQuery.has(currentTabId),
      });

      // If TanStack Query is already detected, request immediate data update
      if (tabsWithTanStackQuery.has(currentTabId)) {
        chrome.tabs
          .sendMessage(currentTabId, {
            type: "REQUEST_IMMEDIATE_UPDATE",
          })
          .catch((error: unknown) => {
            console.warn("Failed to request immediate update:", error);
          });
      }
    }

    // Send connection health info
    port.postMessage({
      type: "CONNECTION_ESTABLISHED",
      connectionId,
      timestamp: Date.now(),
    });

    port.onDisconnect.addListener(() => {
      devtoolsPort = null;
      activeConnections.delete(connectionId);
    });

    port.onMessage.addListener(async (message) => {
      // Handle ping messages for connection health
      if (message.type === "PING") {
        const connection = activeConnections.get(connectionId);
        if (connection) {
          connection.lastPing = Date.now();
          port.postMessage({
            type: "PONG",
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Forward messages to content script if needed
      const currentTabId = await getCurrentTabId();
      if (currentTabId && message.type) {
        chrome.tabs
          .sendMessage(currentTabId, message)
          .catch((error: unknown) => {
            console.warn("Failed to send message to content script:", error);
          });
      }
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (message: TanStackQueryMessage | QueryActionResult, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    if (message.type === "QEVENT") {
      switch (message.subtype) {
        case "QUERY_CLIENT_DETECTED":
          tabsWithTanStackQuery.add(tabId);

          // Forward to DevTools panel
          devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_CLIENT_DETECTED",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_CLIENT_NOT_FOUND":
          tabsWithTanStackQuery.delete(tabId);

          // Forward to DevTools panel
          devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_CLIENT_NOT_FOUND",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_STATE_UPDATE":
          // Forward to DevTools panel
          devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_STATE_UPDATE",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "QUERY_DATA_UPDATE":
          // Forward to DevTools panel
          devtoolsPort?.postMessage({
            type: "QEVENT",
            subtype: "QUERY_DATA_UPDATE",
            tabId: tabId,
            payload: message.payload,
          });
          break;

        case "MUTATION_DATA_UPDATE":
          // Forward to DevTools panel
          devtoolsPort?.postMessage({
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
      // Forward to DevTools panel
      devtoolsPort?.postMessage({
        ...message,
        tabId: tabId,
      });
    }

    sendResponse({ received: true });
  },
);

// Helper function to get current active tab ID
async function getCurrentTabId(): Promise<number | null> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id || null;
  } catch (error) {
    console.warn("Failed to get current tab ID:", error);
    return null;
  }
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithTanStackQuery.delete(tabId);
});

// Extension lifecycle
chrome.runtime.onStartup.addListener(() => {});

chrome.runtime.onInstalled.addListener(() => {});
