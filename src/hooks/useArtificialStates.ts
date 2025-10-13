import { useState, useEffect, useMemo } from "react";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";

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

  // Get storage directly - no factory needed
  const storage = useMemo(
    () => tabScopedStorageManager.getStorageForTab(tabId),
    [tabId],
  );

  // Subscribe to artificial state changes
  useEffect(() => {
    // Subscribe to storage changes and update when artificial states change
    const unsubscribe = storage.subscribe(() => {
      const currentData = storage.getSnapshot();
      if (currentData?.artificialStates) {
        setArtificialStatesRecord(currentData.artificialStates);
      }
    });

    return unsubscribe;
  }, [storage]);

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
    try {
      const currentData = await storage.get();
      const currentState = currentData.artificialStates?.[queryHash];
      const newArtificialStates = { ...currentData.artificialStates };

      if (currentState === type) {
        // Remove the artificial state if it's currently active
        delete newArtificialStates[queryHash];
      } else {
        // Set the artificial state
        newArtificialStates[queryHash] = type;
      }

      await storage.updateArtificialStates(newArtificialStates);
    } catch (error) {
      console.error("Failed to toggle artificial state:", error);
      throw error;
    }
  };

  return {
    artificialStates: artificialStatesMap,
    isLoading,
    isError,
    handleToggle,
  };
}
