// Content script - bridges between injected script and extension
console.log('TanStack Query DevTools: Content script loaded');

// Message types for communication with background script
interface TanStackQueryMessage {
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE' | 'QUERY_DATA_UPDATE';
  payload?: unknown;
}

// Send message to background script
function sendToBackground(message: TanStackQueryMessage) {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn('TanStack Query DevTools: Failed to send message to background:', error);
  });
}

// Listen for messages from injected script via postMessage
window.addEventListener('message', (event) => {
  // Only accept messages from same origin and our injected script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== 'tanstack-query-devtools-injected') return;

  console.log('Content script received message from injected script:', event.data);

  // Forward the QEVENT to background script
  if (event.data.type === 'QEVENT') {
    sendToBackground({
      type: 'QEVENT',
      subtype: event.data.subtype,
      payload: event.data.payload
    });
  }
});

// Inject the injected script into the page context
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected/injected.js');
  script.onload = () => {
    console.log('TanStack Query DevTools: Injected script loaded into page context');
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject script immediately or when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectScript);
} else {
  injectScript();
}

// Listen for messages from DevTools (for future extension)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Content script received message from DevTools:", message);

  // For now, just acknowledge receipt
  sendResponse({ received: true });
  return true; // Keep message channel open for async response
});
