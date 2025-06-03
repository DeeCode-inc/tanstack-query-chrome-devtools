// Background service worker - handles extension lifecycle and message routing
console.log('TanStack Query DevTools: Background script loaded');

// Track which tabs have TanStack Query detected
const tabsWithTanStackQuery = new Set<number>();

// Message types
interface TanStackQueryMessage {
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE' | 'QUERY_DATA_UPDATE';
  payload?: unknown;
}

// Store DevTools port connection
let devtoolsPort: chrome.runtime.Port | null = null;

// Handle DevTools connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools') {
    devtoolsPort = port;
    console.log('DevTools connected');

    // Send initial state to DevTools
    const currentTabId = getCurrentTabId();
    if (currentTabId) {
      port.postMessage({
        type: 'INITIAL_STATE',
        hasTanStackQuery: tabsWithTanStackQuery.has(currentTabId)
      });
    }

    port.onDisconnect.addListener(() => {
      devtoolsPort = null;
      console.log('DevTools disconnected');
    });

    port.onMessage.addListener((message) => {
      console.log('Message from DevTools:', message);
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
chrome.runtime.onMessage.addListener((message: TanStackQueryMessage, sender, sendResponse) => {
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
