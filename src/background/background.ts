import "webextension-polyfill";
import { z } from "zod";
import { StorageManager } from "../shared/storage-manager";
import { safeDeserialize } from "../utils/serialization";
import type { QueryState } from "../types/storage";
import type {
  UpdateMessage,
  QueryActionResult,
  RequestImmediateUpdateMessage,
  BulkQueryActionMessage,
  ClearArtificialStatesMessage,
} from "../types/messages";

// Zod schema for serialized payload validation
const SerializedPayloadSchema = z.object({
  serialized: z.string(),
  usedSuperjson: z.boolean(),
  isSerializedPayload: z.literal(true),
});

// Track preservation flags per tab
const preserveArtificialStatesForTab = new Map<number, boolean>();

// Define possible background messages
type BackgroundMessage =
  | UpdateMessage
  | QueryActionResult
  | (RequestImmediateUpdateMessage & { inspectedTabId?: number })
  | (BulkQueryActionMessage & { inspectedTabId?: number })
  | ClearArtificialStatesMessage
  | {
      type: "QUERY_ACTION";
      inspectedTabId?: number;
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
      if (
        message.type === "QUERY_ACTION" ||
        message.type === "BULK_QUERY_ACTION" ||
        message.type === "REQUEST_IMMEDIATE_UPDATE"
      ) {
        // Track preservation flag for REQUEST_IMMEDIATE_UPDATE messages
        if (
          message.type === "REQUEST_IMMEDIATE_UPDATE" &&
          message.preserveArtificialStates
        ) {
          preserveArtificialStatesForTab.set(message.inspectedTabId, true);
        }

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
          // Only clear if this tab doesn't have preservation flag set
          if (processedPayload.tanStackQueryDetected === true) {
            const shouldPreserve = preserveArtificialStatesForTab.get(tabId);
            if (!shouldPreserve) {
              // Clear artificial states for this tab only on fresh page loads/navigations
              StorageManager.getState()
                .then((currentState) => {
                  const artificialStates = {
                    ...(currentState.artificialStates || {}),
                  };
                  delete artificialStates[tabId];
                  return StorageManager.updatePartialState({
                    ...updateData,
                    artificialStates,
                  });
                })
                .then(() => {
                  sendResponse({ received: true });
                })
                .catch((error) => {
                  console.error("Failed to update storage:", error);
                  sendResponse({ received: false, error: error.message });
                });
              return true;
            } else {
              // Clear the preservation flag after using it
              preserveArtificialStatesForTab.delete(tabId);
            }
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

      // Handle clear artificial states message from content script
      if (message.type === "CLEAR_ARTIFICIAL_STATES") {
        StorageManager.getState()
          .then((currentState) => {
            const artificialStates = {
              ...(currentState.artificialStates || {}),
            };
            // Clear artificial states for this tab only
            delete artificialStates[tabId];
            return StorageManager.updatePartialState({
              artificialStates,
              lastUpdated: Date.now(),
            });
          })
          .then(() => {
            sendResponse({ received: true });
          })
          .catch((error) => {
            console.error("Failed to clear artificial states:", error);
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

              // Ensure this tab has an entry in artificial states
              if (!artificialStates[tabId]) {
                artificialStates[tabId] = {};
              }

              if (message.action === "TRIGGER_LOADING") {
                if (artificialStates[tabId][queryHash] === "loading") {
                  // Cancel loading state
                  delete artificialStates[tabId][queryHash];
                } else {
                  // Start loading state
                  artificialStates[tabId][queryHash] = "loading";
                }
              } else if (message.action === "TRIGGER_ERROR") {
                if (artificialStates[tabId][queryHash] === "error") {
                  // Cancel error state
                  delete artificialStates[tabId][queryHash];
                } else {
                  // Start error state
                  artificialStates[tabId][queryHash] = "error";
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
  // First update icon based on current storage (may be stale)
  await updateIconForActiveTab(activeInfo.tabId);

  // Set preservation flag and request immediate update from the newly active tab
  preserveArtificialStatesForTab.set(activeInfo.tabId, true);
  try {
    await chrome.tabs.sendMessage(activeInfo.tabId, {
      type: "REQUEST_IMMEDIATE_UPDATE",
      preserveArtificialStates: true,
    });
  } catch (error) {
    // Tab might not have the content script loaded, that's fine
    console.warn(
      "Could not request immediate update for tab",
      activeInfo.tabId,
      error,
    );
  }
});

// Listen to window focus changes (when user switches between browser windows)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs[0]?.id) {
        // First update icon based on current storage (may be stale)
        await updateIconForActiveTab(tabs[0].id);

        // Set preservation flag and request immediate update from the newly focused tab
        preserveArtificialStatesForTab.set(tabs[0].id, true);
        try {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: "REQUEST_IMMEDIATE_UPDATE",
            preserveArtificialStates: true,
          });
        } catch (error) {
          // Tab might not have the content script loaded, that's fine
          console.warn(
            "Could not request immediate update for focused tab",
            tabs[0].id,
            error,
          );
        }
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

    // Clean up artificial states for closed tab
    if (currentState.artificialStates && currentState.artificialStates[tabId]) {
      const artificialStates = { ...currentState.artificialStates };
      delete artificialStates[tabId];
      await StorageManager.updatePartialState({ artificialStates });
    }

    if (currentState.tabId === tabId) {
      // Clear state if it was from the closed tab
      await StorageManager.setState({
        queries: [],
        mutations: [],
        tanStackQueryDetected: false,
        lastUpdated: Date.now(),
      });
    }

    // Clean up preservation flag for closed tab
    preserveArtificialStatesForTab.delete(tabId);
  } catch (error) {
    console.error("Failed to clean up state for closed tab:", error);
  }
});
