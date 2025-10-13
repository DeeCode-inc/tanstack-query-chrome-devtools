// Clean content script implementation following the refactor plan
import {
  isUpdateMessage,
  isTanStackQueryEvent,
} from "../lib/message-validation";
import { EnhancedStorageManager, TabManager } from "../lib/enhanced-storage";
import type {
  TanStackQueryEvent,
  UpdateMessage,
  QueryActionMessage,
  BulkQueryActionMessage,
} from "../types/messages";
import { createPostMessageRouter } from "../lib/message-router";

// Import modular components
import { ContentScriptIconManager } from "./modules/icon-manager";
import { injectScript } from "./modules/inject-script";

// Content script main class
class ContentScript {
  private storage: EnhancedStorageManager | null = null;
  private messageRouter = createPostMessageRouter({
    requireInjectedSource: true,
  });
  private iconManager = new ContentScriptIconManager();
  private isInitialized = false;

  // Initialize content script
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize enhanced storage manager
      this.storage = await TabManager.createEnhancedStorage();
      if (!this.storage) {
        throw new Error("Failed to initialize enhanced storage manager");
      }

      // Initialize icon manager
      this.iconManager.initialize(this.storage);

      // Set up message handlers
      this.setupMessageHandlers();

      // Start components
      this.messageRouter.start();
      await this.iconManager.start();

      // Inject the injected script
      await injectScript(chrome.runtime.getURL("injected.js"));

      this.isInitialized = true;
    } catch (error) {
      console.error(
        "TanStack Query DevTools: Failed to initialize content script:",
        error,
      );
    }
  }

  // Set up message handlers for different message types
  private setupMessageHandlers(): void {
    // Handle TanStack Query events from injected script
    this.messageRouter.register("qevent", {
      validate: isTanStackQueryEvent,
      handle: async (event: TanStackQueryEvent) => {
        await this.handleTanStackQueryEvent(event);
      },
    });

    // Handle update messages from injected script
    this.messageRouter.register("update", {
      validate: isUpdateMessage,
      handle: async (message: UpdateMessage) => {
        await this.handleUpdateMessage(message);
      },
    });

    // Handle one-way notification to clear artificial states from injected script
    this.messageRouter.register("clear-artificial", {
      validate: (
        message: unknown,
      ): message is { type: "CLEAR_ARTIFICIAL_STATES" } => {
        return (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "CLEAR_ARTIFICIAL_STATES"
        );
      },
      handle: async () => {
        await this.handleClearArtificialStates();
      },
    });

    // Handle QUERY_ACTION messages from background script (DevTools/Popup → Background → here)
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "QUERY_ACTION" && message?.action) {
        this.handleQueryAction(message.action)
          .then(() => sendResponse({ success: true }))
          .catch((error: Error) => {
            console.error("Error handling query action:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async response
      }
    });
  }

  // Inject the injected script into the page
  // Handle TanStack Query events
  private async handleTanStackQueryEvent(
    event: TanStackQueryEvent,
  ): Promise<void> {
    if (!this.storage) return;

    try {
      switch (event.subtype) {
        case "QUERY_CLIENT_DETECTED":
          await this.storage.setDetectionStatus(true);
          break;

        case "QUERY_CLIENT_NOT_FOUND":
          await this.storage.setDetectionStatus(false);
          break;

        case "QUERY_DATA_UPDATE":
          if (event.payload) {
            await this.storage.updateQueries(event.payload, {
              validate: true,
            });
          }
          break;

        case "MUTATION_DATA_UPDATE":
          if (event.payload) {
            await this.storage.updateMutations(event.payload, {
              validate: true,
            });
          }
          break;

        case "QUERY_STATE_UPDATE":
          // General state update - data will be updated via subscriptions
          // No need to request immediate update with reactive storage
          break;
      }
    } catch (error) {
      console.error("Error handling TanStack Query event:", error);
    }
  }

  // Handle update messages with mixed data
  private async handleUpdateMessage(message: UpdateMessage): Promise<void> {
    if (!this.storage) return;

    try {
      // No processing needed - postMessage uses structured clone
      // Data is already in correct format
      await this.storage.batchUpdate({
        queries: message.payload.queries,
        mutations: message.payload.mutations,
        tanStackQueryDetected: message.payload.tanStackQueryDetected,
      });
    } catch (error) {
      console.error("Error handling update message:", error);
    }
  }

  // Handle one-way notification to clear artificial states from storage
  // (No response needed - injected script already cleared its local state)
  private async handleClearArtificialStates(): Promise<void> {
    if (!this.storage) return;

    try {
      // Clear artificial states from storage
      const tabStorage = this.storage.getStorage();
      await tabStorage.clearArtificialStates();
    } catch (error) {
      console.error("Error clearing artificial states from storage:", error);
    }
  }

  // Handle query actions from DevTools/Popup via background script
  private async handleQueryAction(
    action: QueryActionMessage | BulkQueryActionMessage,
  ): Promise<void> {
    try {
      // Forward action directly to injected script with source marker
      window.postMessage(
        {
          ...action, // Spread the QueryActionMessage/BulkQueryActionMessage
          source: "tanstack-query-devtools-content", // Add source for validation
        },
        window.location.origin,
      );
    } catch (error) {
      console.error("Error forwarding query action to injected script:", error);
      throw error;
    }
  }

  // Cleanup when content script is unloaded
  cleanup(): void {
    try {
      this.messageRouter.stop();
      this.iconManager.cleanup();

      if (this.storage) {
        this.storage.cleanup();
        this.storage = null;
      }

      this.isInitialized = false;
      console.log("TanStack Query DevTools: Content script cleaned up");
    } catch (error) {
      console.error("Error during content script cleanup:", error);
    }
  }
}

// Global content script instance
let contentScriptInstance: ContentScript | null = null;

// Initialize content script when DOM is ready
function initializeContentScript() {
  if (contentScriptInstance) return;

  contentScriptInstance = new ContentScript();
  contentScriptInstance.initialize();
}

// Cleanup on page unload
function cleanupContentScript() {
  if (contentScriptInstance) {
    contentScriptInstance.cleanup();
    contentScriptInstance = null;
  }
}

// Auto-initialize when script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}

// Cleanup on page unload
window.addEventListener("beforeunload", cleanupContentScript);
