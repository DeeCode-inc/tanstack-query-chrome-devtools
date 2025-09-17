import { useState, useEffect, useMemo } from "react";
import {
  createArtificialStateManager,
  type ArtificialStateManager,
} from "../utils/artificialStateManager";

export interface UIStateSync {
  artificialStates: Map<string, "loading" | "error">;
  isLoading: (queryHash: string) => boolean;
  isError: (queryHash: string) => boolean;
  handleToggle: (queryHash: string, type: "loading" | "error") => Promise<void>;
}

/**
 * Hook for managing artificial states with proper reactivity.
 * Provides centralized artificial state management that triggers component re-renders.
 */
export function useArtificialStates(tabId: number): UIStateSync {
  const [artificialStatesRecord, setArtificialStatesRecord] = useState<
    Record<string, "loading" | "error">
  >({});

  // Create stable artificial state manager instance
  const stateManager: ArtificialStateManager = useMemo(
    () => createArtificialStateManager(tabId),
    [tabId],
  );

  // Subscribe to artificial state changes
  useEffect(() => {
    // Subscribe to changes - the subscription callback will provide initial state
    const unsubscribe = stateManager.subscribe((states) => {
      setArtificialStatesRecord(states);
    });

    return unsubscribe;
  }, [stateManager]);

  // Convert to Map for component compatibility
  const artificialStatesMap = useMemo(
    () => new Map(Object.entries(artificialStatesRecord)),
    [artificialStatesRecord],
  );

  // Helper functions
  const isLoading = (queryHash: string): boolean => {
    return artificialStatesMap.get(queryHash) === "loading";
  };

  const isError = (queryHash: string): boolean => {
    return artificialStatesMap.get(queryHash) === "error";
  };

  const handleToggle = async (
    queryHash: string,
    type: "loading" | "error",
  ): Promise<void> => {
    const currentState = stateManager.getState(queryHash);

    if (currentState === type) {
      // Remove the artificial state if it's currently active
      await stateManager.clearState(queryHash);
    } else {
      // Set the artificial state
      await stateManager.updateState(queryHash, type);
    }
  };

  return {
    artificialStates: artificialStatesMap,
    isLoading,
    isError,
    handleToggle,
  };
}
