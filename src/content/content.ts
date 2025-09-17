// Content script - bridges between injected script and extension storage
import type {
  QueryActionMessage,
  QueryActionResult,
  UpdateMessage,
  BulkQueryActionMessage,
  RequestImmediateUpdateMessage,
  IconUpdateMessage,
} from "../types/messages";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";
import { safeDeserialize } from "../utils/serialization";
import { z } from "zod";

// Send icon update message to background script - fixes Chrome API constraint
function sendIconUpdateToBackground(
  tanStackQueryDetected: boolean,
  tabId: number,
) {
  const message: IconUpdateMessage = {
    type: "ICON_UPDATE",
    tanStackQueryDetected,
    tabId,
  };

  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn(
      "TanStack Query DevTools: Failed to send icon update to background:",
      error,
    );
  });
}

// Set up storage change listener for icon updates
async function setupIconManagement() {
  try {
    const tabId = await getTabId();
    if (!tabId) return;

    const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);
    let previousDetectionState: boolean | undefined = undefined;

    // Subscribe to storage changes and update icon when TanStack Query detection changes
    const unsubscribe = tabStorage.subscribe(async () => {
      try {
        const currentState = await tabStorage.get();

        // Only send icon update if tanStackQueryDetected changed
        if (currentState.tanStackQueryDetected !== previousDetectionState) {
          previousDetectionState = currentState.tanStackQueryDetected;
          sendIconUpdateToBackground(currentState.tanStackQueryDetected, tabId);
        }
      } catch (error) {
        console.warn(
          "TanStack Query DevTools: Failed to handle storage change for icon:",
          error,
        );
      }
    });

    // Clean up subscription when page unloads
    window.addEventListener("beforeunload", unsubscribe);

    // Set initial icon state for this tab
    const initialState = await tabStorage.get();
    sendIconUpdateToBackground(initialState.tanStackQueryDetected, tabId);
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Failed to setup icon management:",
      error,
    );
    // Send fallback icon update to background script
    const tabId = await getTabId();
    if (tabId) {
      sendIconUpdateToBackground(false, tabId);
    }
  }
}

// Zod schema for serialized payload validation
const SerializedPayloadSchema = z.object({
  serialized: z.string(),
  usedSuperjson: z.boolean(),
  isSerializedPayload: z.literal(true),
});

const getTabId = async () =>
  chrome.runtime.sendMessage({ type: "GET_TAB_ID" }).then((resp) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get tab ID:", chrome.runtime.lastError);
    }

    return resp?.tabId;
  });

// Direct storage update function - replaces sendToBackground
async function updateStorage(payload: UpdateMessage["payload"]) {
  try {
    const tabId = await getTabId();
    const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);

    // Process and deserialize payload before storing (same logic as background script)
    const processedPayload = { ...payload };

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
          "Failed to deserialize queries in content script:",
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
          "Failed to deserialize mutations in content script:",
          error,
        );
        // Keep original payload if deserialization fails
      }
    }

    // Update storage directly using batch update for efficiency
    const updates: Parameters<typeof tabStorage.batchUpdate>[0] = {};

    if (processedPayload.queries !== undefined) {
      updates.queries = processedPayload.queries;
    }

    if (processedPayload.mutations !== undefined) {
      updates.mutations = processedPayload.mutations;
    }

    if (processedPayload.tanStackQueryDetected !== undefined) {
      updates.tanStackQueryDetected = processedPayload.tanStackQueryDetected;

      // Clear artificial states when QueryClient is freshly detected (same logic as background)
      if (processedPayload.tanStackQueryDetected === true) {
        updates.clearArtificialStates = true;
      }
    }

    await tabStorage.batchUpdate(updates);
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Failed to update storage directly:",
      error,
    );
  }
}

// Send message to background script for action results (still needed for DevTools forwarding)
function sendActionResultToBackground(message: QueryActionResult) {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn(
      "TanStack Query DevTools: Failed to send action result to background:",
      error,
    );
  });
}

// Send action to injected script
function sendActionToInjected(
  action:
    | QueryActionMessage
    | BulkQueryActionMessage
    | RequestImmediateUpdateMessage,
) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-content",
      ...action,
    },
    "*",
  );
}

// Process actions from storage queue
async function processActionQueue() {
  try {
    const tabId = await getTabId();
    if (!tabId) return;

    const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);
    const pendingActions = await tabStorage.dequeueActions();

    for (const action of pendingActions) {
      // Send action to injected script
      sendActionToInjected(action.payload);

      // Mark action as processed
      await tabStorage.markActionProcessed(action.id);
    }

    // Clean up old processed actions periodically
    if (pendingActions.length > 0) {
      await tabStorage.clearProcessedActions();
    }
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Failed to process action queue:",
      error,
    );
  }
}

// Set up storage subscription to process actions when they are added
async function setupActionQueueSubscription() {
  try {
    const tabId = await getTabId();
    if (!tabId) return;

    const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);

    // Subscribe to action queue changes and process them
    let isProcessing = false;
    const unsubscribe = tabStorage.subscribe(async () => {
      if (isProcessing) return; // Prevent concurrent processing
      isProcessing = true;

      try {
        await processActionQueue();
      } finally {
        isProcessing = false;
      }
    });

    // Clean up subscription when page unloads
    window.addEventListener("beforeunload", unsubscribe);
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Failed to setup action queue subscription:",
      error,
    );
  }
}

// Listen for messages from injected script via postMessage
window.addEventListener("message", async (event) => {
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

    // Only update storage if we have something to update
    if (Object.keys(payload).length > 0) {
      updateStorage(payload);
    } else {
      console.warn(
        "⚠️ TanStack Query DevTools (Content): No payload to update storage",
      );
    }
  }

  // Handle action results from injected script
  if (event.data.type === "QUERY_ACTION_RESULT") {
    sendActionResultToBackground(event.data);
  }

  // Handle clear artificial states directly in storage
  if (event.data.type === "CLEAR_ARTIFICIAL_STATES") {
    const tabStorage = tabScopedStorageManager.getStorageForTab(
      await getTabId(),
    );
    tabStorage.clearArtificialStates().catch((error) => {
      console.error(
        "TanStack Query DevTools: Failed to clear artificial states:",
        error,
      );
    });
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
  document.addEventListener("load", injectScript);
} else {
  injectScript();
}

// Initialize action queue subscription after script injection
if (document.readyState === "loading") {
  document.addEventListener("load", setupActionQueueSubscription);
} else {
  setupActionQueueSubscription();
}

// Initialize icon management after script injection
if (document.readyState === "loading") {
  document.addEventListener("load", setupIconManagement);
} else {
  setupIconManagement();
}

// Listen for messages from DevTools and background script (legacy support during migration)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle query actions from DevTools (fallback - should now come through storage)
  if (message.type === "QUERY_ACTION" || message.type === "BULK_QUERY_ACTION") {
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
