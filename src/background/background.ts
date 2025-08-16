import "webextension-polyfill";
import { z } from "zod";
import { StorageManager } from "../shared/storage-manager";
import { safeDeserialize } from "../utils/serialization";
import type { QueryState } from "../types/storage";
import type { UpdateMessage, QueryActionResult } from "../types/messages";

// Zod schema for serialized payload validation
const SerializedPayloadSchema = z.object({
  serialized: z.string(),
  usedSuperjson: z.boolean(),
  isSerializedPayload: z.literal(true),
});

// Define possible background messages
type BackgroundMessage =
  | UpdateMessage
  | QueryActionResult
  | {
      type: "QUERY_ACTION";
      inspectedTabId?: number;
      [key: string]: unknown;
    }
  | {
      type: "REQUEST_IMMEDIATE_UPDATE";
      [key: string]: unknown;
    };

// Handle messages from both content scripts and DevTools
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    // Handle DevTools messages (have inspectedTabId but no sender.tab.id)
    if (
      "inspectedTabId" in message &&
      message.inspectedTabId &&
      !sender.tab?.id
    ) {
      // Forward DevTools actions to content script of the specified tab
      if (message.type === "QUERY_ACTION") {
        chrome.tabs
          .sendMessage(message.inspectedTabId, message)
          .then(() => {
            sendResponse({ received: true });
          })
          .catch((error) => {
            console.warn("Failed to send message to content script:", error);
            sendResponse({ received: false, error: error.message });
          });
        return true;
      }

      // Handle other DevTools messages
      sendResponse({ received: true });
      return true;
    }

    // Handle Content Script messages (have sender.tab.id)
    const tabId = sender.tab?.id;
    if (tabId) {
      if (message.type === "UPDATE_QUERY_STATE") {
        // Process and deserialize payload before storing
        const processedPayload = { ...message.payload };

        // Deserialize queries if they are serialized
        if (processedPayload.queries) {
          try {
            const parseResult = SerializedPayloadSchema.safeParse(
              processedPayload.queries,
            );
            if (parseResult.success) {
              const deserializedQueries = safeDeserialize(
                parseResult.data.serialized,
              );
              if (Array.isArray(deserializedQueries)) {
                processedPayload.queries = deserializedQueries;
              }
            }
          } catch (error) {
            console.error(
              "Failed to deserialize queries in background script:",
              error,
            );
            // Keep original payload if deserialization fails
          }
        }

        // Deserialize mutations if they are serialized
        if (processedPayload.mutations) {
          try {
            const parseResult = SerializedPayloadSchema.safeParse(
              processedPayload.mutations,
            );
            if (parseResult.success) {
              const deserializedMutations = safeDeserialize(
                parseResult.data.serialized,
              );
              if (Array.isArray(deserializedMutations)) {
                processedPayload.mutations = deserializedMutations;
              }
            }
          } catch (error) {
            console.error(
              "Failed to deserialize mutations in background script:",
              error,
            );
            // Keep original payload if deserialization fails
          }
        }

        // Update storage with the processed (deserialized) state
        // Only include fields that are actually provided to avoid overwriting
        const updateData: Partial<QueryState> = { tabId: tabId };

        if (processedPayload.queries !== undefined) {
          updateData.queries =
            processedPayload.queries as QueryState["queries"];
        }
        if (processedPayload.mutations !== undefined) {
          updateData.mutations =
            processedPayload.mutations as QueryState["mutations"];
        }
        if (processedPayload.tanStackQueryDetected !== undefined) {
          updateData.tanStackQueryDetected =
            processedPayload.tanStackQueryDetected;

          // Clear artificial states when QueryClient is freshly detected
          // This handles page refreshes and navigations
          if (processedPayload.tanStackQueryDetected === true) {
            updateData.artificialStates = {};
          }
        }

        StorageManager.updatePartialState(updateData)
          .then(() => {
            sendResponse({ received: true });
          })
          .catch((error) => {
            console.error("Failed to update storage:", error);
            sendResponse({ received: false, error: error.message });
          });
        return true;
      }

      // Handle action results from content scripts and forward to DevTools
      if (message.type === "QUERY_ACTION_RESULT") {
        // Update artificial states in storage for TRIGGER_LOADING and TRIGGER_ERROR
        if (
          message.success &&
          (message.action === "TRIGGER_LOADING" ||
            message.action === "TRIGGER_ERROR") &&
          message.queryHash
        ) {
          StorageManager.getState()
            .then((currentState) => {
              const artificialStates = {
                ...(currentState.artificialStates || {}),
              };
              const queryHash = message.queryHash as string;

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
              return StorageManager.updatePartialState({
                artificialStates,
                lastUpdated: Date.now(),
              });
            })
            .catch((error) => {
              console.error("Failed to update artificial states:", error);
            });
        }

        // Forward to DevTools - they listen for these via chrome.runtime.onMessage
        chrome.runtime.sendMessage(message).catch(() => {
          // DevTools might not be open, that's fine
        });
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

// Update extension icon based on TanStack Query detection
function updateExtensionIcon(tanStackQueryDetected: boolean) {
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

  chrome.action.setIcon({ path: iconPath }).catch((error) => {
    console.warn("Failed to update extension icon:", error);
  });
}

// Update icon based on specific tab's TanStack Query status
async function updateIconForActiveTab(tabId?: number): Promise<void> {
  try {
    // If no tabId provided, get the currently active tab
    if (!tabId) {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]?.id) {
        updateExtensionIcon(false);
        return;
      }
      tabId = tabs[0].id;
    }

    const state = await StorageManager.getState();

    // Check if the current tab has TanStack Query detected
    const hasQueryForThisTab =
      state.tabId === tabId && state.tanStackQueryDetected;
    updateExtensionIcon(hasQueryForThisTab);
  } catch (error) {
    console.warn("Failed to update icon for active tab:", error);
    updateExtensionIcon(false);
  }
}

// Listen to storage changes and update icon for the currently active tab
StorageManager.onStateChange(async () => {
  await updateIconForActiveTab();
});

// Listen to tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateIconForActiveTab(activeInfo.tabId);
});

// Listen to window focus changes (when user switches between browser windows)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs[0]?.id) {
        await updateIconForActiveTab(tabs[0].id);
      }
    } catch (error) {
      console.warn("Failed to handle window focus change:", error);
    }
  }
});

// Set initial icon state on startup for the currently active tab
updateIconForActiveTab().catch((error) => {
  console.warn("Failed to set initial icon state:", error);
  // Default to grayscale icon on error
  updateExtensionIcon(false);
});

// Clean up storage when tabs are closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const currentState = await StorageManager.getState();
    if (currentState.tabId === tabId) {
      // Clear state if it was from the closed tab
      await StorageManager.setState({
        queries: [],
        mutations: [],
        tanStackQueryDetected: false,
        lastUpdated: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to clean up state for closed tab:", error);
  }
});
