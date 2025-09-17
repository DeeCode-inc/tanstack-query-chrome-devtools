// Injected script - runs in the webpage context for deeper TanStack Query integration
import type { Query, Mutation, QueryState } from "@tanstack/query-core";
import { safeSerialize } from "../utils/serialization";
import type {
  TanStackQueryEvent,
  QueryActionMessage,
  QueryActionResult,
  BulkQueryActionMessage,
  BulkQueryActionResult,
} from "../types/messages";
import type { QueryData, MutationData } from "../types/query";

// Global subscription tracking for cleanup
let querySubscriptionCleanup: (() => void) | null = null;
let mutationSubscriptionCleanup: (() => void) | null = null;

// Cleanup all active subscriptions
function cleanupSubscriptions() {
  if (querySubscriptionCleanup) {
    try {
      querySubscriptionCleanup();
      querySubscriptionCleanup = null;
    } catch (error) {
      console.warn(
        "TanStack Query DevTools: Error cleaning up query subscription:",
        error,
      );
    }
  }

  if (mutationSubscriptionCleanup) {
    try {
      mutationSubscriptionCleanup();
      mutationSubscriptionCleanup = null;
    } catch (error) {
      console.warn(
        "TanStack Query DevTools: Error cleaning up mutation subscription:",
        error,
      );
    }
  }
}

// Check for TanStack Query in the application's window context
function detectTanStackQuery(): boolean {
  return !!window.__TANSTACK_QUERY_CLIENT__;
}

// Get the active QueryClient
function getQueryClient() {
  return window.__TANSTACK_QUERY_CLIENT__ || null;
}

// Extract query data from QueryClient
function getQueryData(): QueryData[] {
  const queryClient = getQueryClient();
  if (!queryClient || !queryClient.getQueryCache) {
    return [];
  }

  try {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    return queries.map(
      (query: Query): QueryData => ({
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
      }),
    );
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Error collecting query data:",
      error,
    );
    return [];
  }
}

// Extract mutation data from QueryClient
function getMutationData(): MutationData[] {
  const queryClient = getQueryClient();
  if (!queryClient || !queryClient.getMutationCache) {
    return [];
  }

  try {
    const mutationCache = queryClient.getMutationCache();
    const mutations = mutationCache.getAll();

    return mutations.map(
      (mutation: Mutation): MutationData => ({
        mutationId: mutation.mutationId,
        mutationKey: mutation.options.mutationKey
          ? JSON.stringify(mutation.options.mutationKey)
          : undefined,
        state: mutation.state.status,
        variables: mutation.state.variables,
        context: mutation.state.context,
        data: mutation.state.data,
        error: mutation.state.error,
        submittedAt: mutation.state.submittedAt || Date.now(),
        isPending: mutation.state.status === "pending",
      }),
    );
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Error collecting mutation data:",
      error,
    );
    return [];
  }
}

// Send message to content script via postMessage
function sendToContentScript(event: TanStackQueryEvent) {
  // Serialize the payload if it exists
  const serializedEvent: {
    source: string;
    type: string;
    subtype: string;
    payload?: {
      serialized: string;
      usedSuperjson: boolean;
      isSerializedPayload: boolean;
    };
  } = {
    source: "tanstack-query-devtools-injected",
    type: event.type,
    subtype: event.subtype,
  };

  if ("payload" in event && event.payload !== undefined) {
    const serialized = safeSerialize(event.payload);
    serializedEvent.payload = {
      serialized,
      usedSuperjson: true, // Using custom serialization
      isSerializedPayload: true,
    };
  }

  window.postMessage(serializedEvent, "*");
}

// Send query data update
function sendQueryDataUpdate() {
  const queryData = getQueryData();

  sendToContentScript({
    type: "QEVENT",
    subtype: "QUERY_DATA_UPDATE",
    payload: queryData,
  });
}

// Send mutation data update
function sendMutationDataUpdate() {
  const mutationData = getMutationData();

  sendToContentScript({
    type: "QEVENT",
    subtype: "MUTATION_DATA_UPDATE",
    payload: mutationData,
  });
}

// Setup query cache subscription
function setupQuerySubscription() {
  const queryClient = getQueryClient();
  if (!queryClient || typeof queryClient.getQueryCache !== "function") {
    return;
  }

  try {
    const queryCache = queryClient.getQueryCache();
    if (typeof queryCache.subscribe === "function") {
      // Clean up existing subscription before creating a new one
      if (querySubscriptionCleanup) {
        querySubscriptionCleanup();
        querySubscriptionCleanup = null;
      }

      // Subscribe to cache changes and store cleanup function
      querySubscriptionCleanup = queryCache.subscribe(() => {
        sendQueryDataUpdate();
      });

      // Send initial query data
      sendQueryDataUpdate();
    }
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Error setting up subscription:",
      error,
    );
  }
}

// Setup mutation cache subscription
function setupMutationSubscription() {
  const queryClient = getQueryClient();
  if (!queryClient || typeof queryClient.getMutationCache !== "function") {
    return;
  }

  try {
    const mutationCache = queryClient.getMutationCache();
    if (typeof mutationCache.subscribe === "function") {
      // Clean up existing subscription before creating a new one
      if (mutationSubscriptionCleanup) {
        mutationSubscriptionCleanup();
        mutationSubscriptionCleanup = null;
      }

      // Subscribe to mutation cache changes and store cleanup function
      mutationSubscriptionCleanup = mutationCache.subscribe(() => {
        sendMutationDataUpdate();
      });

      // Send initial mutation data
      sendMutationDataUpdate();
    }
  } catch (error) {
    console.error(
      "TanStack Query DevTools: Error setting up mutation subscription:",
      error,
    );
  }
}

// Enhanced detection that also sets up subscription
function performEnhancedDetection() {
  const detected = detectTanStackQuery();

  if (detected) {
    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_DETECTED",
    });

    // Clean up any existing subscriptions before setting up new ones
    // This is handled within setupQuerySubscription and setupMutationSubscription
    // but we call it here for completeness in case of detection changes
    setupQuerySubscription();
    setupMutationSubscription();

    // Add a small delay to ensure subscription setup completes, then send immediate data
    // This fixes the race condition where queries exist in cache before subscription setup
    setTimeout(() => {
      sendQueryDataUpdate();
      sendMutationDataUpdate();
    }, 0);
  } else {
    // Clean up subscriptions when TanStack Query is not found
    cleanupSubscriptions();

    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_NOT_FOUND",
    });
  }

  return detected;
}

// Query action handlers
async function handleQueryAction(
  action: QueryActionMessage,
): Promise<QueryActionResult> {
  const queryClient = getQueryClient();

  if (!queryClient) {
    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: false,
      error: "QueryClient not found",
    };
  }

  try {
    // Find the active query using queryHash
    const activeQuery = queryClient
      .getQueryCache()
      .getAll()
      .find((query) => query.queryHash === action.queryHash);

    if (!activeQuery) {
      return {
        type: "QUERY_ACTION_RESULT",
        action: action.action,
        queryHash: action.queryHash,
        success: false,
        error: "Query not found",
      };
    }

    switch (action.action) {
      case "INVALIDATE":
        await queryClient.invalidateQueries(activeQuery);
        break;

      case "REFETCH":
        await queryClient.refetchQueries(activeQuery);
        break;

      case "REMOVE":
        queryClient.removeQueries(activeQuery);
        break;

      case "RESET":
        queryClient.resetQueries(activeQuery);
        break;

      case "TRIGGER_LOADING": {
        // Check if already in artificial loading state by checking fetchMeta
        if (
          activeQuery.state.fetchMeta &&
          "__previousQueryOptions" in activeQuery.state.fetchMeta
        ) {
          // Cancel the loading state - restore previous state
          const previousState = activeQuery.state;
          const previousOptions =
            activeQuery.state.fetchMeta.__previousQueryOptions;

          activeQuery.cancel({ silent: true });
          activeQuery.setState({
            ...previousState,
            fetchStatus: "idle",
            fetchMeta: null,
          });

          if (previousOptions) {
            activeQuery.fetch(previousOptions);
          }
        } else {
          // Start artificial loading state
          const __previousQueryOptions = activeQuery.options;

          // Trigger a fetch with never-resolving promise
          activeQuery.fetch({
            ...__previousQueryOptions,
            queryFn: () => {
              return new Promise(() => {
                // Never resolve
              });
            },
            gcTime: -1,
          });

          // Force the state to pending
          activeQuery.setState({
            data: undefined,
            status: "pending",
            fetchMeta: {
              ...activeQuery.state.fetchMeta,
              __previousQueryOptions,
            } as QueryState["fetchMeta"],
          });
        }
        break;
      }

      case "TRIGGER_ERROR": {
        // Check if already in artificial error state by checking fetchMeta
        if (
          activeQuery.state.fetchMeta &&
          "__previousQueryState" in activeQuery.state.fetchMeta
        ) {
          // Cancel the error state - restore previous state
          const previousState =
            activeQuery.state.fetchMeta.__previousQueryState;

          if (previousState) {
            activeQuery.setState({
              ...previousState,
              fetchMeta: null,
            });
          }
        } else {
          // Start artificial error state
          // Store the current state before triggering error
          const currentState = {
            data: activeQuery.state.data,
            error: activeQuery.state.error,
            status: activeQuery.state.status,
            dataUpdatedAt: activeQuery.state.dataUpdatedAt,
            errorUpdatedAt: activeQuery.state.errorUpdatedAt,
            fetchStatus: activeQuery.state.fetchStatus,
          };

          // Trigger an error state
          queryClient
            .fetchQuery({
              queryKey: activeQuery.queryKey,
              queryFn: () =>
                Promise.reject(
                  new Error(
                    "Error state triggered by TanStack Query DevTools for testing purposes",
                  ),
                ),
              retry: false,
              staleTime: 0,
            })
            .catch(() => {
              // Error is expected, this is the desired behavior
              // After error is set, store the previous state in fetchMeta for restoration
              activeQuery.setState({
                ...activeQuery.state,
                fetchMeta: {
                  ...activeQuery.state.fetchMeta,
                  __previousQueryState: currentState,
                } as QueryState["fetchMeta"],
              });
            });
        }
        break;
      }

      case "SET_QUERY_DATA": {
        if (!action.newData) {
          return {
            type: "QUERY_ACTION_RESULT",
            action: action.action,
            queryHash: action.queryHash,
            success: false,
            error: "No data provided for SET_QUERY_DATA action",
          };
        }

        // Update query data using queryClient.setQueryData
        queryClient.setQueryData(activeQuery.queryKey, action.newData);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("TanStack Query DevTools: Action failed:", error);

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: false,
      error: errorMessage,
    };
  }
}

// Bulk query action handlers
async function handleBulkQueryAction(
  action: BulkQueryActionMessage,
): Promise<BulkQueryActionResult> {
  const queryClient = getQueryClient();

  if (!queryClient) {
    return {
      type: "BULK_QUERY_ACTION_RESULT",
      action: action.action,
      success: false,
      error: "QueryClient not found",
    };
  }

  try {
    switch (action.action) {
      case "REMOVE_ALL_QUERIES": {
        // Get all queries from the cache
        const queryCache = queryClient.getQueryCache();
        const allQueries = queryCache.getAll();
        const queryCount = allQueries.length;

        // Remove all queries
        queryClient.removeQueries();

        // Also clear artificial states for this tab
        window.postMessage(
          {
            source: "tanstack-query-devtools-injected",
            type: "CLEAR_ARTIFICIAL_STATES",
          },
          "*",
        );

        return {
          type: "BULK_QUERY_ACTION_RESULT",
          action: action.action,
          success: true,
          affectedCount: queryCount,
        };
      }

      default:
        throw new Error(`Unknown bulk action: ${action.action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("TanStack Query DevTools: Bulk action failed:", error);

    return {
      type: "BULK_QUERY_ACTION_RESULT",
      action: action.action,
      success: false,
      error: errorMessage,
    };
  }
}

// Send action result to content script
function sendActionResult(result: QueryActionResult | BulkQueryActionResult) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-injected",
      ...result,
    },
    "*",
  );
}

// Listen for action messages from content script
window.addEventListener("message", async (event) => {
  // Only accept messages from same origin and our content script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== "tanstack-query-devtools-content") return;

  if (event.data.type === "QUERY_ACTION") {
    const result = await handleQueryAction(event.data);
    sendActionResult(result);
  }

  if (event.data.type === "BULK_QUERY_ACTION") {
    const result = await handleBulkQueryAction(event.data);
    sendActionResult(result);
  }

  // Handle immediate update requests from DevTools
  if (event.data.type === "REQUEST_IMMEDIATE_UPDATE") {
    if (performEnhancedDetection()) {
      sendQueryDataUpdate();
      sendMutationDataUpdate();
    }
  }
});

// Check if we're in a valid context
if (typeof window !== "undefined") {
  // Perform initial detection
  if (!performEnhancedDetection()) {
    // Also check periodically in case TanStack Query is loaded dynamically
    // Continue checking until TanStack Query is found (no artificial limit)
    let detectionFound = false;
    const interval = setInterval(() => {
      if (!detectionFound && detectTanStackQuery()) {
        detectionFound = true;
        performEnhancedDetection();
        clearInterval(interval);
      }
    }, 1000);

    // Stop checking after 2 minutes to avoid infinite polling
    setTimeout(() => {
      if (!detectionFound) {
        clearInterval(interval);
      }
    }, 120000);
  }
  // Note: Data updates are now handled within setupQuerySubscription() and setupMutationSubscription()
  // when called from performEnhancedDetection(), eliminating duplicate sends

  // Clean up subscriptions on page unload to prevent memory leaks
  window.addEventListener("beforeunload", () => {
    cleanupSubscriptions();
  });

  // Clean up subscriptions on page visibility change (when tab becomes hidden)
  // This helps with cleanup in some edge cases where beforeunload might not fire
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Don't cleanup on visibility change as it's too aggressive
      // Page might become visible again. Only cleanup on actual unload.
    }
  });

  // Clean up subscriptions when the page is about to be unloaded (pagehide event)
  // This is more reliable than beforeunload in some browsers
  window.addEventListener("pagehide", () => {
    cleanupSubscriptions();
  });
}
