import { createStorage, StorageEnum } from "../base";
import type {
  TanstackQueryStorageType,
  TanstackQueryStorageTypeWithActions,
  TanstackQueryStateType,
  TabScopedStorageManager,
  StorageAction,
  ActionQueueState,
} from "../base/types";
import type { QueryData, MutationData } from "../../types/query";

/**
 * Tab-scoped storage manager that creates individual storage instances for each tab.
 * This ensures complete isolation between tabs and prevents data pollution.
 */
class TabScopedStorageManagerImpl implements TabScopedStorageManager {
  private storageInstances = new Map<number, TanstackQueryStorageType>();
  private batchUpdateQueues = new Map<number, Promise<void>>();

  /**
   * Get or create a storage instance for a specific tab
   */
  getStorageForTab(tabId: number): TanstackQueryStorageTypeWithActions {
    if (this.storageInstances.has(tabId)) {
      return this.storageInstances.get(
        tabId,
      )! as TanstackQueryStorageTypeWithActions;
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

    // Create action queue storage for this tab
    const actionQueueStorage = createStorage<ActionQueueState>(
      `tanstack-query-actions-tab-${tabId}`,
      {
        actions: [],
        lastProcessed: Date.now(),
      },
      {
        storageEnum: StorageEnum.Local,
        liveUpdate: true,
      },
    );

    // Capture reference to this manager instance for use in the enhanced storage
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const managerInstance = this;

    // Create enhanced storage with TanStack Query specific actions and action queue methods
    const enhancedStorage: TanstackQueryStorageTypeWithActions = {
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
        // Queue sequential execution to prevent race conditions between rapid batchUpdate calls
        const currentQueue =
          managerInstance.batchUpdateQueues.get(tabId) || Promise.resolve();
        const newQueue = currentQueue.then(async () => {
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
        });

        managerInstance.batchUpdateQueues.set(tabId, newQueue);
        await newQueue;
      },

      // Action queue methods
      async enqueueAction(
        action: Omit<StorageAction, "id" | "timestamp">,
      ): Promise<void> {
        const newAction: StorageAction = {
          ...action,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          processed: false,
        };

        // Add action to action queue storage
        await actionQueueStorage.set((prev) => ({
          ...prev,
          actions: [...prev.actions, newAction],
        }));

        // Trigger main storage subscription by updating lastUpdated
        // This ensures content script subscription fires when actions are enqueued
        await storage.set((prev) => ({
          ...prev,
          lastUpdated: Date.now(),
        }));
      },

      async dequeueActions(): Promise<StorageAction[]> {
        const queueState = await actionQueueStorage.get();
        return queueState.actions.filter((action) => !action.processed);
      },

      async markActionProcessed(actionId: string): Promise<void> {
        await actionQueueStorage.set((prev) => ({
          ...prev,
          actions: prev.actions.map((action) =>
            action.id === actionId ? { ...action, processed: true } : action,
          ),
          lastProcessed: Date.now(),
        }));
      },

      async clearProcessedActions(): Promise<void> {
        await actionQueueStorage.set((prev) => ({
          ...prev,
          actions: prev.actions.filter((action) => !action.processed),
        }));
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
      // Clear both the main storage and action queue storage
      try {
        await chrome.storage.local.remove([
          `tanstack-query-tab-${tabId}`,
          `tanstack-query-actions-tab-${tabId}`,
        ]);
      } catch (error) {
        console.error(`Failed to cleanup storage for tab ${tabId}:`, error);
      }

      // Remove from our instances map
      this.storageInstances.delete(tabId);
    }
  }

  /**
   * Get all active tab IDs that have storage instances
   */
  async getAllTabIds(): Promise<number[]> {
    try {
      // Get all storage keys and extract tab IDs
      const allItems = await chrome.storage.local.get(null);
      const tabIds: number[] = [];

      for (const key in allItems) {
        const match = key.match(/^tanstack-query-tab-(\d+)$/);
        if (match) {
          tabIds.push(parseInt(match[1], 10));
        }
      }

      return tabIds;
    } catch (error) {
      console.error("Failed to get all tab IDs:", error);
      return [];
    }
  }

  /**
   * Clean up all inactive tabs (tabs that no longer exist)
   */
  async cleanupInactiveTabs(): Promise<void> {
    try {
      const storedTabIds = await this.getAllTabIds();
      const activeTabs = await chrome.tabs.query({});
      const activeTabIds = new Set(
        activeTabs.map((tab) => tab.id).filter(Boolean),
      );

      // Clean up tabs that no longer exist
      for (const tabId of storedTabIds) {
        if (!activeTabIds.has(tabId)) {
          await this.cleanupTab(tabId);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup inactive tabs:", error);
    }
  }
}

// Export singleton instance
export const tabScopedStorageManager = new TabScopedStorageManagerImpl();

// Set up automatic cleanup when tabs are closed
if (typeof chrome !== "undefined" && chrome.tabs) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabScopedStorageManager.cleanupTab(tabId).catch((error) => {
      console.error(`Failed to cleanup tab ${tabId}:`, error);
    });
  });

  // Periodic cleanup of inactive tabs (every 5 minutes)
  setInterval(
    () => {
      tabScopedStorageManager.cleanupInactiveTabs().catch((error) => {
        console.error("Failed to cleanup inactive tabs:", error);
      });
    },
    5 * 60 * 1000,
  );
}
