// Background service worker - handles extension lifecycle and message routing
console.log('TanStack Query DevTools: Background script loaded');

// Track which tabs have TanStack Query detected
const tabsWithTanStackQuery = new Set<number>();

// Keep-alive mechanism to prevent Chrome from terminating the service worker
// Chrome terminates inactive service workers after ~30 seconds
let keepAliveInterval: NodeJS.Timeout | null = null;

function startKeepAlive() {
  if (keepAliveInterval) return;

  console.log('Starting service worker keep-alive');
  keepAliveInterval = setInterval(() => {
    // Minimal activity to prevent Chrome timeout
    // Using setBadgeText as it's lightweight and doesn't affect users
    chrome.action.setBadgeText({ text: '' });
  }, 25000); // Every 25 seconds (before 30s timeout)
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    console.log('Stopping service worker keep-alive');
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

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
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE' | 'QUERY_DATA_UPDATE';
  payload?: unknown;
}

// Action result message
interface QueryActionResult {
  type: 'QUERY_ACTION_RESULT';
  action: 'INVALIDATE' | 'REFETCH' | 'REMOVE' | 'RESET';
  queryKey: readonly unknown[];
  success: boolean;
  error?: string;
}

// Store DevTools port connection
let devtoolsPort: chrome.runtime.Port | null = null;

// Handle DevTools connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools') {
    const connectionId = `devtools-${Date.now()}`;
    devtoolsPort = port;
    console.log('DevTools connected:', connectionId);

    // Start keep-alive when DevTools connects
    startKeepAlive();

    // Track this connection
    const currentTabId = getCurrentTabId();
    activeConnections.set(connectionId, {
      port,
      tabId: currentTabId,
      connectedAt: Date.now(),
      lastPing: Date.now()
    });

    // Send initial state to DevTools
    if (currentTabId) {
      port.postMessage({
        type: 'INITIAL_STATE',
        hasTanStackQuery: tabsWithTanStackQuery.has(currentTabId)
      });
    }

    // Send connection health info
    port.postMessage({
      type: 'CONNECTION_ESTABLISHED',
      connectionId,
      timestamp: Date.now()
    });

    port.onDisconnect.addListener(() => {
      devtoolsPort = null;
      activeConnections.delete(connectionId);
      console.log('DevTools disconnected:', connectionId);

      // Stop keep-alive if no active connections
      if (activeConnections.size === 0) {
        stopKeepAlive();
      }
    });

    port.onMessage.addListener((message) => {
      console.log('Message from DevTools:', message);

      // Handle ping messages for connection health
      if (message.type === 'PING') {
        const connection = activeConnections.get(connectionId);
        if (connection) {
          connection.lastPing = Date.now();
          port.postMessage({
            type: 'PONG',
            timestamp: Date.now()
          });
        }
        return;
      }

      // Forward messages to content script if needed
      const currentTabId = getCurrentTabId();
      if (currentTabId && message.type) {
        chrome.tabs.sendMessage(currentTabId, message).catch((error) => {
          console.warn('Failed to send message to content script:', error);
        });
      }
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: TanStackQueryMessage | QueryActionResult, sender, sendResponse) => {
  console.log('Background received message:', message, 'from tab:', sender.tab?.id);

  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === 'QEVENT') {
    switch (message.subtype) {
      case 'QUERY_CLIENT_DETECTED':
        tabsWithTanStackQuery.add(tabId);
        console.log('TanStack Query detected in tab:', tabId);

        // Forward to DevTools panel
        devtoolsPort?.postMessage({
          type: 'QEVENT',
          subtype: 'QUERY_CLIENT_DETECTED',
          tabId: tabId,
          payload: message.payload
        });
        break;

      case 'QUERY_CLIENT_NOT_FOUND':
        tabsWithTanStackQuery.delete(tabId);
        console.log('TanStack Query not found in tab:', tabId);

        // Forward to DevTools panel
        devtoolsPort?.postMessage({
          type: 'QEVENT',
          subtype: 'QUERY_CLIENT_NOT_FOUND',
          tabId: tabId,
          payload: message.payload
        });
        break;

      case 'QUERY_STATE_UPDATE':
        console.log('Query state update from tab:', tabId, message.payload);

        // Forward to DevTools panel
        devtoolsPort?.postMessage({
          type: 'QEVENT',
          subtype: 'QUERY_STATE_UPDATE',
          tabId: tabId,
          payload: message.payload
        });
        break;

      case 'QUERY_DATA_UPDATE':
        console.log('Query data update from tab:', tabId, 'queries:', Array.isArray(message.payload) ? message.payload.length : 'unknown');

        // Forward to DevTools panel
        devtoolsPort?.postMessage({
          type: 'QEVENT',
          subtype: 'QUERY_DATA_UPDATE',
          tabId: tabId,
          payload: message.payload
        });
        break;
    }
  }

  // Handle query action results from content script
  if (message.type === 'QUERY_ACTION_RESULT') {
    console.log('Query action result from tab:', tabId, message);

    // Forward to DevTools panel
    devtoolsPort?.postMessage({
      ...message,
      tabId: tabId
    });
  }

  sendResponse({ received: true });
});

// Helper function to get current tab ID (simplified for now)
function getCurrentTabId(): number | null {
  // In a real implementation, we'd get the active tab ID
  // For now, we'll use the first tab with TanStack Query
  return tabsWithTanStackQuery.values().next().value || null;
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithTanStackQuery.delete(tabId);
  console.log('Tab closed, removed from tracking:', tabId);
});

// Extension lifecycle
chrome.runtime.onStartup.addListener(() => {
  console.log('TanStack Query DevTools extension startup');
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('TanStack Query DevTools extension installed/updated:', details.reason);
});
