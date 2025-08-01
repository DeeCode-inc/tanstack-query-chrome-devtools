import "webextension-polyfill";
import { StorageManager } from "../shared/storage-manager";
import { safeDeserialize } from "../utils/serialization";
import type { QueryState } from "../types/storage";
import type { UpdateMessage, QueryActionResult } from "../types/messages";

// Define serialized payload type
interface SerializedPayload {
  serialized: string;
  usedSuperjson: boolean;
  isSerializedPayload: boolean;
}

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
            if (
              typeof processedPayload.queries === "object" &&
              processedPayload.queries !== null &&
              "isSerializedPayload" in processedPayload.queries &&
              (processedPayload.queries as SerializedPayload)
                .isSerializedPayload
            ) {
              const serializedData =
                processedPayload.queries as SerializedPayload;
              const deserializedQueries = safeDeserialize(
                serializedData.serialized,
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
            if (
              typeof processedPayload.mutations === "object" &&
              processedPayload.mutations !== null &&
              "isSerializedPayload" in processedPayload.mutations &&
              (processedPayload.mutations as SerializedPayload)
                .isSerializedPayload
            ) {
              const serializedData =
                processedPayload.mutations as SerializedPayload;
              const deserializedMutations = safeDeserialize(
                serializedData.serialized,
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
