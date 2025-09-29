// Clean injected script implementation following the refactor plan
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
} from "../types/messages";
import {
  isQueryActionMessage,
  isBulkQueryActionMessage,
  isRequestImmediateUpdateMessage,
  isClearArtificialStatesMessage,
} from "../lib/message-validation";
import { createPostMessageRouter } from "../lib/message-router";

// Import modular components
import { TanStackQueryDetectionManager } from "./modules/detection-manager";
import { TanStackQueryDataExtractor } from "./modules/data-extractor";
import { TanStackQuerySubscriptionManager } from "./modules/subscription-manager";
import { TanStackQueryActionExecutor } from "./modules/action-executor";
import { InjectedScriptMessageCommunicator } from "./modules/message-communicator";

// Main injected script class
class InjectedScript {
  private detectionManager = new TanStackQueryDetectionManager();
  private dataExtractor = new TanStackQueryDataExtractor();
  private subscriptionManager: TanStackQuerySubscriptionManager;
  private actionExecutor = new TanStackQueryActionExecutor();
  private messageCommunicator = new InjectedScriptMessageCommunicator();
  private messageRouter = createPostMessageRouter({
    requireContentSource: true,
  });
  private isInitialized = false;

  constructor() {
    this.subscriptionManager = new TanStackQuerySubscriptionManager(
      this.dataExtractor,
      this.messageCommunicator,
    );
  }

  // Initialize injected script
  initialize(): void {
    if (this.isInitialized) return;

    try {
      // Set up message handlers
      this.setupMessageHandlers();

      // Start message router
      this.messageRouter.start();

      // Set up detection monitoring
      this.setupDetectionMonitoring();

      // Start monitoring
      this.detectionManager.startMonitoring();

      this.isInitialized = true;
    } catch (error) {
      console.error(
        "TanStack Query DevTools: Failed to initialize injected script:",
        error,
      );
    }
  }

  // Set up message handlers for communication with content script
  private setupMessageHandlers(): void {
    // Handle query actions
    this.messageRouter.register("query-action", {
      validate: isQueryActionMessage,
      handle: async (message: QueryActionMessage) => {
        const result = await this.actionExecutor.executeQueryAction(message);
        this.messageCommunicator.sendActionResult(result);
      },
    });

    // Handle bulk query actions
    this.messageRouter.register("bulk-query-action", {
      validate: isBulkQueryActionMessage,
      handle: async (message: BulkQueryActionMessage) => {
        const result =
          await this.actionExecutor.executeBulkQueryAction(message);
        this.messageCommunicator.sendActionResult(result);
      },
    });

    // Handle immediate update requests
    this.messageRouter.register("immediate-update", {
      validate: isRequestImmediateUpdateMessage,
      handle: () => {
        this.sendImmediateUpdate();
      },
    });

    // Handle clear artificial states
    this.messageRouter.register("clear-artificial", {
      validate: isClearArtificialStatesMessage,
      handle: () => {
        this.clearAllArtificialStates();
      },
    });
  }

  // Set up detection monitoring and callbacks
  private setupDetectionMonitoring(): void {
    this.detectionManager.onDetectionChange((detected) => {
      if (detected) {
        // TanStack Query detected
        this.messageCommunicator.sendEvent({
          type: "QEVENT",
          subtype: "QUERY_CLIENT_DETECTED",
        });

        // Clear artificial states when TanStack Query is freshly detected
        // This handles page refresh scenarios where storage has stale artificial states
        this.actionExecutor.clearAllArtificialStates();

        // Also clear artificial states from storage by sending message to content script
        window.postMessage(
          {
            type: "CLEAR_ARTIFICIAL_STATES",
            source: "tanstack-query-devtools-injected",
          },
          window.location.origin,
        );

        // Set up subscriptions
        this.subscriptionManager.subscribeToQueries();
        this.subscriptionManager.subscribeToMutations();

        // Send initial data
        this.sendImmediateUpdate();
      } else {
        // TanStack Query not found
        this.messageCommunicator.sendEvent({
          type: "QEVENT",
          subtype: "QUERY_CLIENT_NOT_FOUND",
        });

        // Clean up subscriptions
        this.subscriptionManager.cleanup();
      }
    });
  }

  // Send immediate data update
  private sendImmediateUpdate(): void {
    try {
      const queries = this.dataExtractor.getQueryData();
      const mutations = this.dataExtractor.getMutationData();

      this.messageCommunicator.sendUpdate({
        queries,
        mutations,
        tanStackQueryDetected: this.detectionManager.isDetected,
      });
    } catch (error) {
      console.error("Error sending immediate update:", error);
    }
  }

  // Clear all artificial states
  private clearAllArtificialStates(): void {
    try {
      this.actionExecutor.clearAllArtificialStates();
      // Send updated data
      this.sendImmediateUpdate();
    } catch (error) {
      console.error("Error clearing artificial states:", error);
    }
  }

  // Cleanup when script is unloaded
  cleanup(): void {
    try {
      this.messageRouter.stop();
      this.detectionManager.cleanup();
      this.subscriptionManager.cleanup();

      this.isInitialized = false;
    } catch (error) {
      console.error("Error during injected script cleanup:", error);
    }
  }

  // Get current status
  get status() {
    return {
      initialized: this.isInitialized,
      tanStackQueryDetected: this.detectionManager.isDetected,
      messageRouterActive: this.messageRouter.active,
    };
  }
}

// Global injected script instance
let injectedScriptInstance: InjectedScript | null = null;

// Initialize injected script
function initializeInjectedScript() {
  if (injectedScriptInstance) return;

  injectedScriptInstance = new InjectedScript();
  injectedScriptInstance.initialize();
}

// Cleanup on page unload
function cleanupInjectedScript() {
  if (injectedScriptInstance) {
    injectedScriptInstance.cleanup();
    injectedScriptInstance = null;
  }
}

// Auto-initialize
initializeInjectedScript();

// Cleanup on page unload
window.addEventListener("beforeunload", cleanupInjectedScript);
