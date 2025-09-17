import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";

export interface ArtificialStateManager {
  getState(queryHash: string): "loading" | "error" | null;
  updateState(
    queryHash: string,
    state: "loading" | "error" | null,
  ): Promise<void>;
  clearState(queryHash: string): Promise<void>;
  subscribe(
    callback: (states: Record<string, "loading" | "error">) => void,
  ): () => void;
}

/**
 * Create an artificial state manager for a specific tab.
 * Provides centralized management of artificial loading/error states with proper reactivity.
 */
export function createArtificialStateManager(
  tabId: number,
): ArtificialStateManager {
  const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);

  return {
    getState(queryHash: string): "loading" | "error" | null {
      // Get current artificial states synchronously from storage snapshot
      const currentData = tabStorage.getSnapshot();
      if (!currentData?.artificialStates) return null;

      return currentData.artificialStates[queryHash] || null;
    },

    async updateState(
      queryHash: string,
      state: "loading" | "error" | null,
    ): Promise<void> {
      try {
        const currentData = await tabStorage.get();
        const newArtificialStates = { ...currentData.artificialStates };

        if (state === null) {
          // Remove the artificial state
          delete newArtificialStates[queryHash];
        } else {
          // Set the artificial state
          newArtificialStates[queryHash] = state;
        }

        await tabStorage.updateArtificialStates(newArtificialStates);
      } catch (error) {
        console.error("Failed to update artificial state:", error);
        throw error;
      }
    },

    async clearState(queryHash: string): Promise<void> {
      await this.updateState(queryHash, null);
    },

    subscribe(
      callback: (states: Record<string, "loading" | "error">) => void,
    ): () => void {
      // Subscribe to storage changes and notify when artificial states change
      return tabStorage.subscribe(() => {
        const currentData = tabStorage.getSnapshot();
        if (currentData?.artificialStates) {
          callback(currentData.artificialStates);
        }
      });
    },
  };
}
