// Action execution for DevTools commands
import type { Query } from "@tanstack/query-core";
import type {
  QueryActionMessage,
  QueryActionResult,
  BulkQueryActionMessage,
} from "../../types/messages";

export class TanStackQueryActionExecutor {
  // Store artificial states separately since fetchMeta gets cleared
  private artificialStates = new Map<
    string,
    {
      type: "loading" | "error";
      previousOptions: Record<string, unknown>;
      previousState: {
        status: string;
        fetchStatus: string;
        data: unknown;
        error: unknown;
      };
    }
  >();

  async executeQueryAction(
    action: QueryActionMessage,
  ): Promise<QueryActionResult | void> {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient) {
      return this.createErrorResult(action, "QueryClient not found");
    }

    try {
      const query = queryClient
        .getQueryCache()
        .getAll()
        .find((q) => q.queryHash === action.queryHash);

      if (!query) {
        return this.createErrorResult(
          action,
          `Query with hash ${action.queryHash} not found`,
        );
      }

      switch (action.action) {
        case "INVALIDATE":
          await queryClient.invalidateQueries({ queryKey: query.queryKey });
          break;

        case "REFETCH":
          await query.fetch();
          break;

        case "REMOVE":
          queryClient.removeQueries({ queryKey: query.queryKey });
          break;

        case "RESET":
          queryClient.resetQueries({ queryKey: query.queryKey });
          break;

        case "TRIGGER_LOADING":
          // Artificial state already updated by React - no result needed
          await this.triggerArtificialLoading(query);
          return; // Don't send result - nobody is listening
        case "TRIGGER_ERROR":
          // Artificial state already updated by React - no result needed
          await this.triggerArtificialError(query);
          return; // Don't send result - nobody is listening

        case "CANCEL_LOADING":
          // Artificial state already updated by React - no result needed
          await this.cancelArtificialLoading(query);
          return; // Don't send result - nobody is listening

        case "CANCEL_ERROR":
          // Artificial state already updated by React - no result needed
          await this.cancelArtificialError(query);
          return; // Don't send result - nobody is listening

        case "SET_QUERY_DATA":
          queryClient.setQueryData(query.queryKey, action.newData);
          break;

        default:
          return this.createErrorResult(
            action,
            `Unknown action: ${action.action}`,
          );
      }

      return this.createSuccessResult(action);
    } catch (error) {
      return this.createErrorResult(action, String(error));
    }
  }

  async executeBulkQueryAction(action: BulkQueryActionMessage): Promise<void> {
    const queryClient = window.__TANSTACK_QUERY_CLIENT__;
    if (!queryClient) {
      console.error("QueryClient not found for bulk action");
      return;
    }

    try {
      switch (action.action) {
        case "REMOVE_ALL_QUERIES": {
          queryClient.removeQueries();
          // Success - no result needed, subscriptions will update UI
          break;
        }

        default:
          console.error(`Unknown bulk action: ${action.action}`);
      }
    } catch (error) {
      console.error(`Bulk action ${action.action} failed:`, error);
    }
  }

  clearAllArtificialStates(): void {
    try {
      // Iterate through all artificial states and restore queries
      for (const [
        queryHash,
        artificialState,
      ] of this.artificialStates.entries()) {
        const queryClient = window.__TANSTACK_QUERY_CLIENT__;
        if (!queryClient) continue;

        const query = queryClient.getQueryCache().get(queryHash);
        if (query) {
          // Restore original options
          query.setOptions(artificialState.previousOptions);

          // Cancel any ongoing fetch for loading states
          if (artificialState.type === "loading") {
            query.cancel().catch(() => {
              // Ignore cancel errors
            });
          }
        }
      }

      // Clear all artificial states
      this.artificialStates.clear();
    } catch (error) {
      console.error("Error clearing artificial states:", error);
    }
  }

  private async triggerArtificialLoading(query: Query): Promise<void> {
    // Check if already in artificial loading state
    if (this.artificialStates.has(query.queryHash)) {
      return; // Already in artificial state
    }

    // Store original query options in our separate map
    const previousOptions = query.options;

    try {
      // Store artificial state info
      this.artificialStates.set(query.queryHash, {
        type: "loading",
        previousOptions: previousOptions as Record<string, unknown>,
        previousState: {
          status: query.state.status,
          fetchStatus: query.state.fetchStatus,
          data: query.state.data,
          error: query.state.error,
        },
      });

      // Override queryFn to return a never-resolving promise
      const newOptions = {
        ...previousOptions,
        queryFn: async () => {
          // Return a promise that never resolves but keeps the query in fetching state
          return new Promise((resolve, reject) => {
            // Store resolve/reject for potential future cleanup
            (globalThis as Record<string, unknown>).__artificialQueryPromise = {
              resolve,
              reject,
            };
            // Never call resolve() to keep it loading forever
          });
        },
        gcTime: -1, // Prevent garbage collection
        retry: false, // Don't retry on errors
        staleTime: 0, // Always consider stale so refetch is allowed
      };

      query.setOptions(newOptions);

      // Trigger fetch without awaiting (let it run in background)
      const fetchPromise = query.fetch();

      fetchPromise.catch(() => {
        // Expected for never-resolving promise, ignore
      });

      // Force update the query state if it's not in fetching state
      if (query.state.fetchStatus !== "fetching") {
        // Force the query into proper loading state (both status and fetchStatus)
        query.setState({
          ...query.state,
          status: "pending" as const,
          fetchStatus: "fetching" as const,
          fetchFailureCount: 0,
          fetchFailureReason: null,
          data: undefined, // Clear data to simulate initial loading
          error: null, // Clear any previous errors
        });
      } else {
        // Even if fetchStatus is fetching, ensure status is pending for proper loading simulation
        if (query.state.status !== "pending") {
          query.setState({
            ...query.state,
            status: "pending" as const,
            data: undefined, // Clear data to simulate initial loading
            error: null, // Clear any previous errors
          });
        }
      }
    } catch (error) {
      console.error("Error in triggerArtificialLoading:", error);
      throw error;
    }
  }

  private async triggerArtificialError(query: Query): Promise<void> {
    // Check if already in artificial error state
    if (this.artificialStates.has(query.queryHash)) {
      return; // Already in artificial state
    }

    // Store original query options in our separate map
    const previousOptions = query.options;

    try {
      // Store artificial state info
      this.artificialStates.set(query.queryHash, {
        type: "error",
        previousOptions: previousOptions as Record<string, unknown>,
        previousState: {
          status: query.state.status,
          fetchStatus: query.state.fetchStatus,
          data: query.state.data,
          error: query.state.error,
        },
      });

      // Override queryFn to throw an error
      query.setOptions({
        ...previousOptions,
        queryFn: () => {
          return Promise.reject(new Error("Artificial error for debugging"));
        },
        retry: false, // Don't retry artificial errors
        gcTime: -1, // Prevent garbage collection
      });

      // Trigger fetch
      try {
        await query.fetch();
      } catch {
        // Expected error, ignore
      }
    } catch (error) {
      console.error("Error setting up artificial error:", error);
      // Clean up if setup failed
      this.artificialStates.delete(query.queryHash);
    }
  }

  private async cancelArtificialLoading(query: Query): Promise<void> {
    const artificialState = this.artificialStates.get(query.queryHash);

    if (!artificialState || artificialState.type !== "loading") {
      return; // Not in artificial loading state
    }

    try {
      // Restore original options
      const originalOptions = artificialState.previousOptions as Record<
        string,
        unknown
      >;
      query.setOptions(originalOptions);

      // Set the state back to what it was before artificial loading
      const prevState = artificialState.previousState;
      query.setState({
        ...query.state,
        status: prevState.status as "pending" | "error" | "success",
        fetchStatus: prevState.fetchStatus as "fetching" | "paused" | "idle",
        data: prevState.data,
        error: prevState.error as Error | null,
      });

      // Clean up artificial state
      this.artificialStates.delete(query.queryHash);
    } catch (error) {
      console.error("Error canceling artificial loading:", error);
    }
  }

  private async cancelArtificialError(query: Query): Promise<void> {
    const artificialState = this.artificialStates.get(query.queryHash);

    if (!artificialState || artificialState.type !== "error") {
      return; // Not in artificial error state
    }

    try {
      // Restore original options
      query.setOptions(artificialState.previousOptions);

      // Set the state back to what it was before artificial error
      const prevState = artificialState.previousState;
      query.setState({
        ...query.state,
        status: prevState.status as "pending" | "error" | "success",
        fetchStatus: prevState.fetchStatus as "fetching" | "paused" | "idle",
        data: prevState.data,
        error: prevState.error as Error | null,
      });

      // Clear the artificial state
      this.artificialStates.delete(query.queryHash);
    } catch (error) {
      console.error("Error canceling artificial error:", error);
    }
  }

  private createSuccessResult(action: QueryActionMessage): QueryActionResult {
    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: true,
      ...(action.action === "SET_QUERY_DATA" && { newData: action.newData }),
    } as QueryActionResult;
  }

  private createErrorResult(
    action: QueryActionMessage,
    error: string,
  ): QueryActionResult {
    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: false,
      error,
    } as QueryActionResult;
  }
}
