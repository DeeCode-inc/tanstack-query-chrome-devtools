// Clean injected script implementation following the refactor plan
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
} from "../types/messages";
import type { Query, Mutation } from "@tanstack/query-core";
import type { QueryData, MutationData } from "../types/query";
import {
  isQueryActionMessage,
  isBulkQueryActionMessage,
} from "../lib/message-validation";
import { createPostMessageRouter } from "../lib/message-router";

// Import modular components
import {
  monitorQueryClientDetection,
  isQueryClientDetected,
} from "./modules/detection-monitor";
import { TanStackQueryActionExecutor } from "./modules/action-executor";
import { sendToContentScript } from "./modules/message-sender";

// Main injected script class
class InjectedScript {
  private detectionCleanup: (() => void) | null = null;
  private queryUnsubscribe: (() => void) | null = null;
  private mutationUnsubscribe: (() => void) | null = null;
  private actionExecutor = new TanStackQueryActionExecutor();
  private messageRouter = createPostMessageRouter({
    requireContentSource: true,
  });
  private isInitialized = false;

  // Debounce timers for observer count changes (to handle virtualized lists)
  private queryObserverDebounceTimer: ReturnType<typeof setTimeout> | null =
    null;
  private mutationObserverDebounceTimer: ReturnType<typeof setTimeout> | null =
    null;

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
        // Only send result if it exists (artificial state actions return void)
        if (result) {
          sendToContentScript(result);
        }
      },
    });

    // Handle bulk query actions
    this.messageRouter.register("bulk-query-action", {
      validate: isBulkQueryActionMessage,
      handle: async (message: BulkQueryActionMessage) => {
        await this.actionExecutor.executeBulkQueryAction(message);
        // No result sent - nobody is listening, subscriptions update UI
      },
    });
  }

  // Set up detection monitoring and callbacks
  private setupDetectionMonitoring(): void {
    this.detectionCleanup = monitorQueryClientDetection((detected) => {
      if (detected) {
        // TanStack Query detected
        sendToContentScript({
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
        this.subscribeToQueries();
        this.subscribeToMutations();

        // Send initial data
        this.sendImmediateUpdate();
      } else {
        // TanStack Query not found
        sendToContentScript({
          type: "QEVENT",
          subtype: "QUERY_CLIENT_NOT_FOUND",
        });

        // Clean up subscriptions
        this.cleanupSubscriptions();
      }
    });
  }

  // Subscribe to query cache for real-time updates
  private subscribeToQueries(): void {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getQueryCache) return;

    try {
      // Clean up existing subscription
      if (this.queryUnsubscribe) {
        this.queryUnsubscribe();
      }

      // Subscribe to cache changes
      // Filter events carefully to prevent infinite loops while still tracking subscriber count
      this.queryUnsubscribe = queryClient.getQueryCache().subscribe((event) => {
        // Ignore observer result/option updates as these can cause infinite loops
        // when storage updates trigger React component re-renders
        if (
          event.type === "observerResultsUpdated" ||
          event.type === "observerOptionsUpdated"
        ) {
          return;
        }

        // For observer add/remove events (e.g., virtualized lists scrolling),
        // debounce to avoid hundreds of updates per second
        if (
          event.type === "observerAdded" ||
          event.type === "observerRemoved"
        ) {
          // Clear existing timer
          if (this.queryObserverDebounceTimer) {
            clearTimeout(this.queryObserverDebounceTimer);
          }

          // Debounce: wait 150ms after last observer change before updating
          this.queryObserverDebounceTimer = setTimeout(() => {
            this.sendQueryDataUpdate();
            this.queryObserverDebounceTimer = null;
          }, 150);
          return;
        }

        // Send updates immediately for real cache changes: 'added', 'removed', 'updated'
        this.sendQueryDataUpdate();
      });
    } catch (error) {
      console.error("Error subscribing to query cache:", error);
    }
  }

  // Subscribe to mutation cache for real-time updates
  private subscribeToMutations(): void {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getMutationCache) return;

    try {
      // Clean up existing subscription
      if (this.mutationUnsubscribe) {
        this.mutationUnsubscribe();
      }

      // Subscribe to mutation cache changes
      // Filter events carefully to prevent infinite loops while still tracking subscriber count
      this.mutationUnsubscribe = queryClient
        .getMutationCache()
        .subscribe((event) => {
          // Ignore observer option updates as these can cause infinite loops
          // when storage updates trigger React component re-renders
          if (event.type === "observerOptionsUpdated") {
            return;
          }

          // For observer add/remove events, debounce to avoid excessive updates
          if (
            event.type === "observerAdded" ||
            event.type === "observerRemoved"
          ) {
            // Clear existing timer
            if (this.mutationObserverDebounceTimer) {
              clearTimeout(this.mutationObserverDebounceTimer);
            }

            // Debounce: wait 150ms after last observer change before updating
            this.mutationObserverDebounceTimer = setTimeout(() => {
              this.sendMutationDataUpdate();
              this.mutationObserverDebounceTimer = null;
            }, 150);
            return;
          }

          // Send updates immediately for real cache changes: 'added', 'removed', 'updated'
          this.sendMutationDataUpdate();
        });
    } catch (error) {
      console.error("Error subscribing to mutation cache:", error);
    }
  }

  // Send query data update to content script
  private sendQueryDataUpdate(): void {
    try {
      const queries = this.getQueryData();
      sendToContentScript({
        type: "QEVENT",
        subtype: "QUERY_DATA_UPDATE",
        payload: queries,
      });
    } catch (error) {
      console.error("Error sending query data update:", error);
    }
  }

  // Send mutation data update to content script
  private sendMutationDataUpdate(): void {
    try {
      const mutations = this.getMutationData();
      sendToContentScript({
        type: "QEVENT",
        subtype: "MUTATION_DATA_UPDATE",
        payload: mutations,
      });
    } catch (error) {
      console.error("Error sending mutation data update:", error);
    }
  }

  // Extract query data from QueryClient
  private getQueryData(): QueryData[] {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getQueryCache) return [];

    try {
      const queries = queryClient.getQueryCache().getAll();
      return queries.map(this.mapQueryToData.bind(this));
    } catch (error) {
      console.error("Error extracting query data:", error);
      return [];
    }
  }

  // Extract mutation data from QueryClient
  private getMutationData(): MutationData[] {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient?.getMutationCache) return [];

    try {
      const mutations = queryClient.getMutationCache().getAll();
      return mutations.map(this.mapMutationToData.bind(this));
    } catch (error) {
      console.error("Error extracting mutation data:", error);
      return [];
    }
  }

  // Map Query object to QueryData format
  private mapQueryToData(query: Query): QueryData {
    return {
      queryKey: query.queryKey,
      queryHash: query.queryHash,
      state: {
        data: query.state.data,
        error: query.state.error,
        status: query.state.status,
        isFetching: query.state.fetchStatus === "fetching",
        isPending: query.state.status === "pending",
        isLoading:
          query.state.fetchStatus === "fetching" &&
          query.state.status === "pending",
        isStale: query.isStale(),
        dataUpdatedAt: query.state.dataUpdatedAt,
        errorUpdatedAt: query.state.errorUpdatedAt,
        fetchStatus: query.state.fetchStatus,
      },
      meta: query.meta || {},
      isActive: query.getObserversCount() > 0,
      observersCount: query.getObserversCount(),
    };
  }

  // Map Mutation object to MutationData format
  private mapMutationToData(mutation: Mutation): MutationData {
    return {
      mutationId: mutation.mutationId,
      state: mutation.state.status,
      variables: mutation.state.variables,
      context: mutation.state.context,
      data: mutation.state.data,
      error: mutation.state.error,
      submittedAt: mutation.state.submittedAt,
      isPending: mutation.state.status === "pending",
    };
  }

  // Send immediate data update
  private sendImmediateUpdate(): void {
    try {
      const queries = this.getQueryData();
      const mutations = this.getMutationData();

      sendToContentScript({
        type: "UPDATE_QUERY_STATE",
        payload: {
          queries,
          mutations,
          tanStackQueryDetected: isQueryClientDetected(),
        },
      });
    } catch (error) {
      console.error("Error sending immediate update:", error);
    }
  }

  // Cleanup subscriptions
  private cleanupSubscriptions(): void {
    // Clear any pending debounce timers
    if (this.queryObserverDebounceTimer) {
      clearTimeout(this.queryObserverDebounceTimer);
      this.queryObserverDebounceTimer = null;
    }

    if (this.mutationObserverDebounceTimer) {
      clearTimeout(this.mutationObserverDebounceTimer);
      this.mutationObserverDebounceTimer = null;
    }

    if (this.queryUnsubscribe) {
      try {
        this.queryUnsubscribe();
      } catch (error) {
        console.warn("Error cleaning up query subscription:", error);
      }
      this.queryUnsubscribe = null;
    }

    if (this.mutationUnsubscribe) {
      try {
        this.mutationUnsubscribe();
      } catch (error) {
        console.warn("Error cleaning up mutation subscription:", error);
      }
      this.mutationUnsubscribe = null;
    }
  }

  // Cleanup when script is unloaded
  cleanup(): void {
    try {
      this.messageRouter.stop();
      if (this.detectionCleanup) {
        this.detectionCleanup();
        this.detectionCleanup = null;
      }
      this.cleanupSubscriptions();

      this.isInitialized = false;
    } catch (error) {
      console.error("Error during injected script cleanup:", error);
    }
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
