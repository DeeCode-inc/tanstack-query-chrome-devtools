// Clean content script implementation following the refactor plan
import {
  isUpdateMessage,
  isTanStackQueryEvent,
  isRequestImmediateUpdateMessage,
  isClearArtificialStatesMessage,
} from "../lib/message-validation";
import { EnhancedStorageManager, TabManager } from "../lib/enhanced-storage";
import { ActionProcessorFactory } from "../lib/action-processor";
import type {
  TanStackQueryEvent,
  UpdateMessage,
  RequestImmediateUpdateMessage,
} from "../types/messages";

// Import modular components
import { ContentScriptMessageRouter } from "./modules/message-router";
import { ContentScriptStorageManager } from "./modules/storage-manager";
import { ContentScriptActionProcessor } from "./modules/action-processor";
import { ContentScriptIconManager } from "./modules/icon-manager";
import { ContentScriptInjector } from "./modules/script-injector";
import { ContentScriptMessageCommunicator } from "./modules/message-communicator";

// Content script main class
class ContentScript {
  private enhancedStorage: EnhancedStorageManager | null = null;
  private storageManager = new ContentScriptStorageManager();
  private actionProcessor = new ContentScriptActionProcessor();
  private messageRouter = new ContentScriptMessageRouter();
  private iconManager = new ContentScriptIconManager();
  private scriptInjector = new ContentScriptInjector();
  private messageCommunicator = new ContentScriptMessageCommunicator();
  private isInitialized = false;

  // Initialize content script
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize enhanced storage manager
      this.enhancedStorage = await TabManager.createEnhancedStorage();
      if (!this.enhancedStorage) {
        throw new Error("Failed to initialize enhanced storage manager");
      }

      // Initialize modular storage manager
      this.storageManager.initialize(this.enhancedStorage);

      // Initialize action processor
      const actionProcessorInstance =
        await ActionProcessorFactory.createForCurrentTab({
          processingInterval: 100,
          maxRetries: 3,
          retryDelay: 500,
          batchSize: 10,
        });

      if (!actionProcessorInstance) {
        throw new Error("Failed to initialize action processor");
      }

      this.actionProcessor.initialize(actionProcessorInstance);

      // Initialize icon manager
      this.iconManager.initialize(this.storageManager);

      // Set up message handlers
      this.setupMessageHandlers();

      // Start components
      this.messageRouter.start();
      this.actionProcessor.start();
      await this.iconManager.start();

      // Inject the injected script
      await this.scriptInjector.injectScript();

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

    // Handle immediate update requests from injected script
    this.messageRouter.register("immediate-update", {
      validate: isRequestImmediateUpdateMessage,
      handle: async (message: RequestImmediateUpdateMessage) => {
        await this.handleImmediateUpdateRequest(message);
      },
    });

    // Handle clear artificial states from injected script
    this.messageRouter.register("clear-artificial", {
      validate: isClearArtificialStatesMessage,
      handle: async () => {
        await this.handleClearArtificialStates();
      },
    });
  }

  // Handle TanStack Query events
  private async handleTanStackQueryEvent(
    event: TanStackQueryEvent,
  ): Promise<void> {
    if (!this.storageManager) return;

    try {
      switch (event.subtype) {
        case "QUERY_CLIENT_DETECTED":
          await this.storageManager.setDetectionStatus(true);
          break;

        case "QUERY_CLIENT_NOT_FOUND":
          await this.storageManager.setDetectionStatus(false);
          break;

        case "QUERY_DATA_UPDATE":
          if (event.payload) {
            await this.storageManager.updateQueries(event.payload, {
              validate: true,
            });
          }
          break;

        case "MUTATION_DATA_UPDATE":
          if (event.payload) {
            await this.storageManager.updateMutations(event.payload, {
              validate: true,
            });
          }
          break;

        case "QUERY_STATE_UPDATE":
          // General state update - trigger a fresh data request
          this.requestImmediateUpdate();
          break;
      }
    } catch (error) {
      console.error("Error handling TanStack Query event:", error);
    }
  }

  // Handle update messages with mixed data
  private async handleUpdateMessage(message: UpdateMessage): Promise<void> {
    if (!this.storageManager) return;

    try {
      // No processing needed - postMessage uses structured clone
      // Data is already in correct format
      await this.storageManager.batchUpdate({
        queries: message.payload.queries,
        mutations: message.payload.mutations,
        tanStackQueryDetected: message.payload.tanStackQueryDetected,
      });
    } catch (error) {
      console.error("Error handling update message:", error);
    }
  }

  // Handle immediate update requests
  private async handleImmediateUpdateRequest(
    message: RequestImmediateUpdateMessage,
  ): Promise<void> {
    try {
      this.requestImmediateUpdate(message.preserveArtificialStates);
    } catch (error) {
      console.error("Error handling immediate update request:", error);
    }
  }

  // Handle clear artificial states
  private async handleClearArtificialStates(): Promise<void> {
    if (!this.storageManager || !this.enhancedStorage) return;

    try {
      // Clear artificial states from storage using the underlying storage
      const storage = this.enhancedStorage.getStorage();
      await storage.clearArtificialStates();

      // Send message to injected script to clear artificial states
      this.messageCommunicator.requestClearArtificialStates();
    } catch (error) {
      console.error("Error clearing artificial states:", error);
    }
  }

  // Request immediate data update from injected script
  private requestImmediateUpdate(preserveArtificialStates?: boolean): void {
    this.messageCommunicator.requestImmediateUpdate(preserveArtificialStates);
  }

  // Cleanup when content script is unloaded
  cleanup(): void {
    try {
      this.messageRouter.stop();
      this.actionProcessor.cleanup();
      this.iconManager.cleanup();
      this.storageManager.cleanup();

      if (this.enhancedStorage) {
        this.enhancedStorage.cleanup();
        this.enhancedStorage = null;
      }

      this.isInitialized = false;
      console.log("TanStack Query DevTools: Content script cleaned up");
    } catch (error) {
      console.error("Error during content script cleanup:", error);
    }
  } // Get current status
  get status() {
    return {
      initialized: this.isInitialized,
      injectedScriptLoaded: this.scriptInjector.isLoaded,
      storageReady: this.storageManager.isInitialized,
      actionProcessorReady: this.actionProcessor.isInitialized,
      messageRouterActive: this.messageRouter.active,
      actionProcessorRunning: this.actionProcessor.isRunning,
      iconManagerReady: this.iconManager.isInitialized,
    };
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

// Handle navigation events in SPAs
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Reinitialize on navigation
    setTimeout(initializeContentScript, 100);
  }
}).observe(document, { subtree: true, childList: true });

// Export for debugging
declare global {
  interface Window {
    __TANSTACK_QUERY_DEVTOOLS_CONTENT__?: {
      getInstance: () => ContentScript | null;
      getStatus: () => unknown;
      reinitialize: () => void;
    };
  }
}

window.__TANSTACK_QUERY_DEVTOOLS_CONTENT__ = {
  getInstance: () => contentScriptInstance,
  getStatus: () => contentScriptInstance?.status,
  reinitialize: () => {
    cleanupContentScript();
    initializeContentScript();
  },
};
