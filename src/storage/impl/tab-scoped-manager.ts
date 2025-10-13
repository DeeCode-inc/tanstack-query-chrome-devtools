import { createStorage, StorageEnum } from "../base";
import type {
  TanstackQueryStorageType,
  TanstackQueryStateType,
  TabScopedStorageManager,
} from "../base/types";
import type { QueryData, MutationData } from "../../types/query";

/**
 * Tab-scoped storage manager that creates individual storage instances for each tab.
 * This ensures complete isolation between tabs and prevents data pollution.
 */
class TabScopedStorageManagerImpl implements TabScopedStorageManager {
  private storageInstances = new Map<number, TanstackQueryStorageType>();

  /**
   * Get or create a storage instance for a specific tab
   */
  getStorageForTab(tabId: number): TanstackQueryStorageType {
    if (this.storageInstances.has(tabId)) {
      return this.storageInstances.get(tabId)!;
    }

    // Create new tab-scoped storage with unique key
    const storage = createStorage<TanstackQueryStateType>(
      `tanstack-query-tab-${tabId}`,
      {
        queries: [],
        mutations: [],
        tanStackQueryDetected: false,
        lastUpdated: Date.now(),
        artificialStates: {},
      },
      {
        storageEnum: StorageEnum.Local,
        liveUpdate: true,
      },
    );

    // Create enhanced storage with TanStack Query specific actions
    const enhancedStorage: TanstackQueryStorageType = {
      ...storage,

      async updateQueries(queries: QueryData[]): Promise<void> {
        await storage.set((prev) => {
          return {
            ...prev,
            queries,
            lastUpdated: Date.now(),
          };
        });
      },

      async updateMutations(mutations: MutationData[]): Promise<void> {
        await storage.set((prev) => {
          return {
            ...prev,
            mutations,
            lastUpdated: Date.now(),
          };
        });
      },

      async setDetectionStatus(detected: boolean): Promise<void> {
        await storage.set((prev) => ({
          ...prev,
          tanStackQueryDetected: detected,
          lastUpdated: Date.now(),
        }));
      },

      async updateArtificialStates(
        states: Record<string, "loading" | "error">,
      ): Promise<void> {
        await storage.set((prev) => ({
          ...prev,
          artificialStates: states,
          lastUpdated: Date.now(),
        }));
      },

      async clearArtificialStates(): Promise<void> {
        await storage.set((prev) => ({
          ...prev,
          artificialStates: {},
          lastUpdated: Date.now(),
        }));
      },

      async reset(): Promise<void> {
        await storage.set({
          queries: [],
          mutations: [],
          tanStackQueryDetected: false,
          lastUpdated: Date.now(),
          artificialStates: {},
        });
      },

      async batchUpdate(updates: {
        queries?: QueryData[];
        mutations?: MutationData[];
        tanStackQueryDetected?: boolean;
        artificialStates?: Record<string, "loading" | "error">;
        clearArtificialStates?: boolean;
      }): Promise<void> {
        // Directly update storage - Chrome storage API handles atomicity
        await storage.set((prev) => {
          const updated = { ...prev, lastUpdated: Date.now() };

          if (updates.queries !== undefined) {
            updated.queries = updates.queries;
          }

          if (updates.mutations !== undefined) {
            updated.mutations = updates.mutations;
          }

          if (updates.tanStackQueryDetected !== undefined) {
            updated.tanStackQueryDetected = updates.tanStackQueryDetected;
          }

          if (updates.clearArtificialStates) {
            updated.artificialStates = {};
          } else if (updates.artificialStates !== undefined) {
            updated.artificialStates = {
              ...prev.artificialStates,
              ...updates.artificialStates,
            };
          }

          return updated;
        });
      },
    };

    this.storageInstances.set(tabId, enhancedStorage);
    return enhancedStorage;
  }

  /**
   * Clean up storage for a specific tab (called when tab is closed)
   */
  async cleanupTab(tabId: number): Promise<void> {
    const storage = this.storageInstances.get(tabId);
    if (storage) {
      // Clear the main storage (action queue is now included)
      try {
        await chrome.storage.local.remove([`tanstack-query-tab-${tabId}`]);
      } catch (error) {
        console.error(`Failed to cleanup storage for tab ${tabId}:`, error);
      }

      // Remove from our instances map
      this.storageInstances.delete(tabId);
    }
  }
}

// Export singleton instance
export const tabScopedStorageManager = new TabScopedStorageManagerImpl();
