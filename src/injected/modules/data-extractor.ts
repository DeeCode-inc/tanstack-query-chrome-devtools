// Data extraction from TanStack Query
import type { Query, Mutation } from "@tanstack/query-core";
import type { QueryData, MutationData } from "../../types/query";

export class TanStackQueryDataExtractor {
  getQueryData(): QueryData[] {
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

  getMutationData(): MutationData[] {
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
}
