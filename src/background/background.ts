import "webextension-polyfill";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";
import type { QueryActionResult, IconUpdateMessage } from "../types/messages";

// Track preservation flags per tab
const preserveArtificialStatesForTab = new Map<number, boolean>();

// Define possible background messages - simplified for essential functionality only
type BackgroundMessage =
  | QueryActionResult
  | IconUpdateMessage
  | { type: "GET_TAB_ID" };

// Handle all essential messages - simplified for minimal background script
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    // Handle GET_TAB_ID requests
    if (message?.type === "GET_TAB_ID") {
      // sender.tab may be undefined for some callers — check
      sendResponse({ tabId: sender.tab ? sender.tab.id : null });
      return;
    }

    // Handle Content Script messages (have sender.tab.id)
    const tabId = sender.tab?.id;
    if (tabId) {
      // Storage updates are now handled directly by content script
      // This section has been simplified as part of Session 1 migration

      // Handle icon update messages from content scripts
      if (message.type === "ICON_UPDATE") {
        handleIconUpdateMessage(message);
        sendResponse({ received: true });
        return true;
      }

      // Handle action results from content scripts - update artificial states in storage
      if (message.type === "QUERY_ACTION_RESULT") {
        // Update artificial states in storage for TRIGGER_LOADING and TRIGGER_ERROR
        if (
          message.success &&
          (message.action === "TRIGGER_LOADING" ||
            message.action === "TRIGGER_ERROR") &&
          message.queryHash
        ) {
          (async () => {
            try {
              const tabStorage =
                tabScopedStorageManager.getStorageForTab(tabId);
              const queryHash = message.queryHash as string;

              // Get current artificial states
              const currentData = await tabStorage.get();
              const artificialStates = { ...currentData.artificialStates };

              if (message.action === "TRIGGER_LOADING") {
                if (artificialStates[queryHash] === "loading") {
                  // Cancel loading state
                  delete artificialStates[queryHash];
                } else {
                  // Start loading state
                  artificialStates[queryHash] = "loading";
                }
              } else if (message.action === "TRIGGER_ERROR") {
                if (artificialStates[queryHash] === "error") {
                  // Cancel error state
                  delete artificialStates[queryHash];
                } else {
                  // Start error state
                  artificialStates[queryHash] = "error";
                }
              }

              // Update storage with new artificial states
              await tabStorage.updateArtificialStates(artificialStates);
            } catch (error) {
              console.error("Failed to update artificial states:", error);
            }
          })();
        }

        sendResponse({ received: true });
        return true;
      }

      sendResponse({ received: true });
      return true;
    }

    // Fallback for unhandled messages
    sendResponse({ received: false, error: "Invalid message source" });
    return true;
  },
);

// Icon management functions - restored to background script to fix Chrome API constraint
let iconUpdateTimeout: NodeJS.Timeout | null = null;

// Update extension icon based on TanStack Query detection - only callable from background script
function updateExtensionIcon(tanStackQueryDetected: boolean, tabId?: number) {
  const iconPath = tanStackQueryDetected
    ? {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-128.png",
      }
    : {
        "16": "icon-16-gray.png",
        "48": "icon-48-gray.png",
        "128": "icon-128-gray.png",
      };

  const iconOptions = tabId ? { tabId, path: iconPath } : { path: iconPath };

  chrome.action.setIcon(iconOptions).catch((error) => {
    console.warn(
      "TanStack Query DevTools: Failed to update extension icon:",
      error,
    );
  });
}

// Handle icon update messages from content scripts
function handleIconUpdateMessage(message: IconUpdateMessage) {
  // Clear any pending icon updates to prevent race conditions
  if (iconUpdateTimeout) {
    clearTimeout(iconUpdateTimeout);
    iconUpdateTimeout = null;
  }

  // Debounce rapid updates to prevent flickering
  iconUpdateTimeout = setTimeout(() => {
    updateExtensionIcon(message.tanStackQueryDetected, message.tabId);
  }, 100); // 100ms debounce to prevent rapid updates
}

// Clean up storage when tabs are closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    // Clean up tab-scoped storage for this tab
    await tabScopedStorageManager.cleanupTab(tabId);

    // Clean up preservation flag for closed tab
    preserveArtificialStatesForTab.delete(tabId);
  } catch (error) {
    console.error("Failed to clean up state for closed tab:", error);
  }
});
