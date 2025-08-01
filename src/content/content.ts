// Content script - bridges between injected script and extension storage
import type {
  QueryActionMessage,
  QueryActionResult,
  UpdateMessage,
} from "../types/messages";

// Send message to background script for storage update
function sendToBackground(message: UpdateMessage | QueryActionResult) {
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

// Listen for messages from injected script via postMessage
window.addEventListener("message", (event) => {
  // Only accept messages from same origin and our injected script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== "tanstack-query-devtools-injected") return;

  // Forward state updates to background script for storage
  if (event.data.type === "QEVENT") {
    const payload: UpdateMessage["payload"] = {};

    switch (event.data.subtype) {
      case "QUERY_CLIENT_DETECTED":
        // Only send detection state change
        payload.tanStackQueryDetected = true;
        break;
      case "QUERY_CLIENT_NOT_FOUND":
        // Only send detection state change
        payload.tanStackQueryDetected = false;
        break;
      case "QUERY_DATA_UPDATE":
        if (event.data.payload) {
          // Only send query data, don't modify tanStackQueryDetected
          payload.queries = event.data.payload;
        }
        break;
      case "MUTATION_DATA_UPDATE":
        if (event.data.payload) {
          // Only send mutation data, don't modify tanStackQueryDetected
          payload.mutations = event.data.payload;
        }
        break;
    }

    // Only send message if we have something to update
    if (Object.keys(payload).length > 0) {
      sendToBackground({
        type: "UPDATE_QUERY_STATE",
        payload,
      });
    }
  }

  // Forward action results to background script for storage
  if (event.data.type === "QUERY_ACTION_RESULT") {
    sendToBackground(event.data);
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
