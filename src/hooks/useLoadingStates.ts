import { useState, useEffect } from "react";
import type { QueryData, MutationData } from "../types/query";

interface LoadingStates {
  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasInitialData: boolean;
}

interface UseLoadingStatesProps {
  queries: QueryData[];
  mutations: MutationData[];
  tanStackQueryDetected: boolean;
}

export function useLoadingStates({ queries, mutations, tanStackQueryDetected }: UseLoadingStatesProps) {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    isInitialLoading: true,
    isRefreshing: false,
    hasInitialData: false,
  });

  useEffect(() => {
    // Initial loading logic
    if (tanStackQueryDetected && (queries.length > 0 || mutations.length > 0)) {
      // First data received - transition from skeleton to content
      if (loadingStates.isInitialLoading) {
        setLoadingStates(prev => ({
          ...prev,
          isInitialLoading: false,
          hasInitialData: true,
        }));
      }
    }
  }, [queries.length, mutations.length, tanStackQueryDetected, loadingStates.isInitialLoading]);

  // Detect if any queries are currently fetching (for refresh indicators)
  const isRefreshing = queries.some(query =>
    query.state.isFetching && !loadingStates.isInitialLoading
  );

  useEffect(() => {
    setLoadingStates(prev => ({
      ...prev,
      isRefreshing,
    }));
  }, [isRefreshing]);

  // Helper function to determine if we should show skeleton for specific items
  const shouldShowSkeleton = (items: unknown[]) => {
    return loadingStates.isInitialLoading && items.length === 0;
  };

  // Helper function to get loading state for specific query
  const getQueryLoadingState = (query: QueryData) => {
    if (query.state.isFetching && query.state.data === undefined) {
      return 'initial';
    } else if (query.state.isFetching && query.state.data !== undefined) {
      return 'refresh';
    } else if (query.state.isError) {
      return 'error';
    }
    return 'idle';
  };

  // Helper function to get loading state for mutations
  const getMutationLoadingState = (mutation: MutationData) => {
    if (mutation.isPending) {
      return 'pending';
    } else if (mutation.state === 'error') {
      return 'error';
    } else if (mutation.state === 'success') {
      return 'success';
    }
    return 'idle';
  };

  return {
    ...loadingStates,
    shouldShowSkeleton,
    getQueryLoadingState,
    getMutationLoadingState,
  };
}

export default useLoadingStates;
