// Injected script - runs in the webpage context for deeper TanStack Query integration
import type { Query, Mutation } from "@tanstack/query-core";

// Message types for communication
interface TanStackQueryEvent {
  type: "QEVENT";
  subtype: "QUERY_CLIENT_DETECTED" | "QUERY_CLIENT_NOT_FOUND" | "QUERY_STATE_UPDATE" | "QUERY_DATA_UPDATE" | "MUTATION_DATA_UPDATE";
  payload?: unknown;
}

// Action message types
interface QueryActionMessage {
  type: "QUERY_ACTION";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET" | "TRIGGER_LOADING" | "TRIGGER_ERROR" | "CANCEL_LOADING" | "CANCEL_ERROR";
  queryKey: readonly unknown[];
}

// Action result message
interface QueryActionResult {
  type: "QUERY_ACTION_RESULT";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET" | "TRIGGER_LOADING" | "TRIGGER_ERROR" | "CANCEL_LOADING" | "CANCEL_ERROR";
  queryKey: readonly unknown[];
  success: boolean;
  error?: string;
}

// Query data interface
interface QueryData {
  queryKey: readonly unknown[];
  state: {
    data?: unknown;
    error?: unknown;
    status: "idle" | "pending" | "success" | "error";
    isFetching: boolean;
    isPending: boolean;
    isLoading: boolean;
    isStale: boolean;
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    fetchStatus: "idle" | "fetching" | "paused";
  };
  meta?: Record<string, unknown>;
  isActive: boolean;
  observersCount: number;
}

// Mutation data interface
interface MutationData {
  mutationId: number;
  mutationKey?: string;
  state: "idle" | "pending" | "success" | "error" | "paused";
  variables?: unknown;
  context?: unknown;
  data?: unknown;
  error?: unknown;
  submittedAt: number;
  isPending: boolean;
}

// Check for TanStack Query in the application's window context
function detectTanStackQuery(): boolean {
  // Only check for __TANSTACK_QUERY_CLIENT__
  if (window.__TANSTACK_QUERY_CLIENT__) {
    return true;
  }

  return false;
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
        state: {
          data: query.state.data,
          error: query.state.error,
          status: query.state.status,
          isFetching: query.state.fetchStatus === "fetching",
          isPending: query.state.status === "pending",
          isLoading: query.state.fetchStatus === "fetching" && query.state.status === "pending",
          isStale: query.isStale(),
          dataUpdatedAt: query.state.dataUpdatedAt,
          errorUpdatedAt: query.state.errorUpdatedAt,
          fetchStatus: query.state.fetchStatus,
        },
        meta: query.meta || {},
        isActive: query.getObserversCount() > 0,
        observersCount: query.getObserversCount(),
      })
    );
  } catch (error) {
    console.error("TanStack Query DevTools: Error collecting query data:", error);
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
        mutationKey: mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : undefined,
        state: mutation.state.status,
        variables: mutation.state.variables,
        context: mutation.state.context,
        data: mutation.state.data,
        error: mutation.state.error,
        submittedAt: mutation.state.submittedAt || Date.now(),
        isPending: mutation.state.status === "pending",
      })
    );
  } catch (error) {
    console.error("TanStack Query DevTools: Error collecting mutation data:", error);
    return [];
  }
}

// Send message to content script via postMessage
function sendToContentScript(event: TanStackQueryEvent) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-injected",
      ...event,
    },
    "*"
  );
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
      // Subscribe to cache changes
      queryCache.subscribe(() => {
        sendQueryDataUpdate();
      });

      // Send initial query data
      sendQueryDataUpdate();
    }
  } catch (error) {
    console.error("TanStack Query DevTools: Error setting up subscription:", error);
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
      // Subscribe to mutation cache changes
      mutationCache.subscribe(() => {
        sendMutationDataUpdate();
      });

      // Send initial mutation data
      sendMutationDataUpdate();
    }
  } catch (error) {
    console.error("TanStack Query DevTools: Error setting up mutation subscription:", error);
  }
}

// Storage for tracking artificial states triggered by DevTools
const artificialStates = new Map<
  string,
  {
    type: "loading" | "error";
    controller?: AbortController;
    originalData?: unknown;
  }
>();

// Helper function to create a query key string for tracking
function getQueryKeyString(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}

// Enhanced detection that also sets up subscription
function performEnhancedDetection() {
  const detected = detectTanStackQuery();

  if (detected) {
    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_DETECTED",
    });

    // Set up subscriptions for real-time updates
    setupQuerySubscription();
    setupMutationSubscription();
  } else {
    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_NOT_FOUND",
    });
  }
}

// Query action handlers
async function handleQueryAction(action: QueryActionMessage): Promise<QueryActionResult> {
  const queryClient = getQueryClient();

  if (!queryClient) {
    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryKey: action.queryKey,
      success: false,
      error: "QueryClient not found",
    };
  }

  try {
    switch (action.action) {
      case "INVALIDATE":
        await queryClient.invalidateQueries({ queryKey: action.queryKey });
        break;

      case "REFETCH":
        await queryClient.refetchQueries({ queryKey: action.queryKey });
        break;

      case "REMOVE":
        queryClient.removeQueries({ queryKey: action.queryKey });
        break;

      case "RESET":
        queryClient.resetQueries({ queryKey: action.queryKey });
        break;

      case "TRIGGER_LOADING": {
        const keyString = getQueryKeyString(action.queryKey);

        // If already in artificial loading state, this becomes a cancel operation
        if (artificialStates.has(keyString) && artificialStates.get(keyString)?.type === "loading") {
          // Cancel the loading state
          const state = artificialStates.get(keyString);
          if (state?.controller) {
            state.controller.abort();
          }
          artificialStates.delete(keyString);
        } else {
          // Start artificial loading state
          const controller = new AbortController();
          artificialStates.set(keyString, { type: "loading", controller });

          // Trigger a fetch that will keep loading until cancelled
          queryClient
            .fetchQuery({
              queryKey: action.queryKey,
              queryFn: () =>
                new Promise((resolve) => {
                  // This promise will only resolve when cancelled
                  controller.signal.addEventListener("abort", () => {
                    // Restore to success state with existing data or default
                    const existingData = queryClient.getQueryData(action.queryKey);
                    resolve(existingData || { message: "Loading state was cancelled" });
                  });

                  // Never reject or resolve naturally - only when cancelled
                }),
              staleTime: 0,
            })
            .catch(() => {
              // Handle any errors gracefully
              artificialStates.delete(keyString);
            });
        }
        break;
      }

      case "TRIGGER_ERROR": {
        const keyString = getQueryKeyString(action.queryKey);

        // If already in artificial error state, this becomes a cancel operation
        if (artificialStates.has(keyString) && artificialStates.get(keyString)?.type === "error") {
          // Cancel the error state - restore original data
          const state = artificialStates.get(keyString);
          if (state?.originalData !== undefined) {
            queryClient.setQueryData(action.queryKey, state.originalData);
          }
          artificialStates.delete(keyString);
        } else {
          // Store original data before triggering error
          const originalData = queryClient.getQueryData(action.queryKey);
          artificialStates.set(keyString, { type: "error", originalData });

          // Trigger an error state
          queryClient
            .fetchQuery({
              queryKey: action.queryKey,
              queryFn: () => Promise.reject(new Error("Error state triggered by TanStack Query DevTools for testing purposes")),
              retry: false,
              staleTime: 0,
            })
            .catch(() => {
              // Error is expected, this is the desired behavior
            });
        }
        break;
      }

      case "CANCEL_LOADING": {
        const keyString = getQueryKeyString(action.queryKey);
        const state = artificialStates.get(keyString);

        if (state?.type === "loading" && state.controller) {
          state.controller.abort();
          artificialStates.delete(keyString);
        }
        break;
      }

      case "CANCEL_ERROR": {
        const keyString = getQueryKeyString(action.queryKey);
        const state = artificialStates.get(keyString);

        if (state?.type === "error") {
          if (state.originalData !== undefined) {
            queryClient.setQueryData(action.queryKey, state.originalData);
          }
          artificialStates.delete(keyString);
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryKey: action.queryKey,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("TanStack Query DevTools: Action failed:", error);

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryKey: action.queryKey,
      success: false,
      error: errorMessage,
    };
  }
}

// Send action result to content script
function sendActionResult(result: QueryActionResult) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-injected",
      ...result,
    },
    "*"
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

    // Trigger query data update after action
    setTimeout(sendQueryDataUpdate, 100);
  }

  // Handle immediate update requests from DevTools
  if (event.data.type === "REQUEST_IMMEDIATE_UPDATE") {
    if (detectTanStackQuery()) {
      sendQueryDataUpdate();
      sendMutationDataUpdate();
    } else {
    }
  }
});

// Check if we're in a valid context
if (typeof window !== "undefined") {
  // Mark that our injected script is present
  window.__TANSTACK_QUERY_DEVTOOLS_INJECTED__ = true;

  // Perform initial detection
  performEnhancedDetection();

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
