// Content script - bridges between injected script and extension

// Message types for communication with background script
interface TanStackQueryMessage {
  type: "QEVENT";
  subtype:
    | "QUERY_CLIENT_DETECTED"
    | "QUERY_CLIENT_NOT_FOUND"
    | "QUERY_STATE_UPDATE"
    | "QUERY_DATA_UPDATE";
  payload?: unknown;
}

// Query action message types
interface QueryActionMessage {
  type: "QUERY_ACTION";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET";
  queryKey: readonly unknown[];
}

// Action result message
interface QueryActionResult {
  type: "QUERY_ACTION_RESULT";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET";
  queryKey: readonly unknown[];
  success: boolean;
  error?: string;
}

// Send message to background script
function sendToBackground(message: TanStackQueryMessage) {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn(
      "TanStack Query DevTools: Failed to send message to background:",
      error,
    );
  });
}

// Send action to injected script
function sendActionToInjected(action: QueryActionMessage) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-content",
      ...action,
    },
    "*",
  );
}

// Send action result to background script
function sendActionResultToBackground(result: QueryActionResult) {
  chrome.runtime.sendMessage(result).catch((error) => {
    console.warn(
      "TanStack Query DevTools: Failed to send action result to background:",
      error,
    );
  });
}

// Listen for messages from injected script via postMessage
window.addEventListener("message", (event) => {
  // Only accept messages from same origin and our injected script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== "tanstack-query-devtools-injected") return;

  // Forward the QEVENT to background script
  if (event.data.type === "QEVENT") {
    sendToBackground({
      type: "QEVENT",
      subtype: event.data.subtype,
      payload: event.data.payload,
    });
  }

  // Forward action results to background script
  if (event.data.type === "QUERY_ACTION_RESULT") {
    sendActionResultToBackground(event.data);
  }
});

// Inject the injected script into the page context
function injectScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.type = "module";
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject script immediately or when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectScript);
} else {
  injectScript();
}

// Listen for messages from DevTools and background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle query actions from DevTools
  if (message.type === "QUERY_ACTION") {
    sendActionToInjected(message);
    sendResponse({ received: true });
    return true;
  }

  // Handle immediate update requests from background script
  if (message.type === "REQUEST_IMMEDIATE_UPDATE") {
    window.postMessage(
      {
        source: "tanstack-query-devtools-content",
        type: "REQUEST_IMMEDIATE_UPDATE",
      },
      "*",
    );
    sendResponse({ received: true });
    return true;
  }

  // For other messages, just acknowledge receipt
  sendResponse({ received: true });
  return true; // Keep message channel open for async response
});
