// Enhanced storage interface and utilities for the refactored content/injected scripts
import type {
  TanstackQueryStorageTypeWithActions,
  TanstackQueryStateType,
  StorageAction,
} from "../storage/base/types";
import type { QueryData, MutationData } from "../types/query";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";

// Simple array validation helper
function ensureArray<T>(data: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  console.warn("Expected array but got:", typeof data, data);
  return fallback;
}

// Enhanced storage wrapper with better error handling and validation
export class EnhancedStorageManager {
  private tabStorage: TanstackQueryStorageTypeWithActions | null = null;
  private tabId: number | null = null;
  private subscriptions: Array<() => void> = [];

  // Initialize with tab ID
  async initialize(tabId: number): Promise<void> {
    this.tabId = tabId;
    this.tabStorage = tabScopedStorageManager.getStorageForTab(tabId);
  }

  // Get current storage instance
  getStorage(): TanstackQueryStorageTypeWithActions {
    if (!this.tabStorage) {
      throw new Error("Storage not initialized. Call initialize() first.");
    }
    return this.tabStorage;
  }

  // Get current tab ID
  getTabId(): number {
    if (!this.tabId) {
      throw new Error("Tab ID not available. Call initialize() first.");
    }
    return this.tabId;
  }

  // Safe update with error handling and validation
  private async safeUpdate(
    updates: Partial<TanstackQueryStateType>,
    options: {
      validateData?: boolean;
      retryOnFailure?: boolean;
    } = {},
  ): Promise<boolean> {
    try {
      const storage = this.getStorage();

      // Validate data before update if requested
      if (options.validateData) {
        if (updates.queries) {
          updates.queries = ensureArray(updates.queries);
        }
        if (updates.mutations) {
          updates.mutations = ensureArray(updates.mutations);
        }
        if (updates.tanStackQueryDetected !== undefined) {
          // Ensure boolean value
          if (typeof updates.tanStackQueryDetected !== "boolean") {
            updates.tanStackQueryDetected = false;
          }
        }
      }

      await storage.batchUpdate(updates);

      return true;
    } catch (error) {
      console.error("Storage update failed:", error);

      // Retry once if requested
      if (options.retryOnFailure) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const storage = this.getStorage();
          await storage.batchUpdate(updates);
          return true;
        } catch (retryError) {
          console.error("Storage update retry failed:", retryError);
        }
      }

      return false;
    }
  }

  // Enhanced query data update with validation
  async updateQueries(
    queries: QueryData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<boolean> {
    try {
      // Handle different input types - structured clone handles everything
      const processedQueries = options.validate
        ? ensureArray<QueryData>(queries)
        : (queries as QueryData[]);

      return this.safeUpdate(
        { queries: processedQueries },
        { validateData: true },
      );
    } catch (error) {
      console.error("Failed to update queries:", error);
      return false;
    }
  }

  // Enhanced mutation data update with validation
  async updateMutations(
    mutations: MutationData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<boolean> {
    try {
      // Handle different input types - structured clone handles everything
      const processedMutations = options.validate
        ? ensureArray<MutationData>(mutations)
        : (mutations as MutationData[]);

      return this.safeUpdate(
        { mutations: processedMutations },
        { validateData: true },
      );
    } catch (error) {
      console.error("Failed to update mutations:", error);
      return false;
    }
  }

  // Update detection status
  async setDetectionStatus(detected: boolean): Promise<boolean> {
    return this.safeUpdate({ tanStackQueryDetected: detected });
  }

  // Enhanced batch update with mixed data types
  async batchUpdate(updates: {
    queries?: QueryData[] | unknown;
    mutations?: MutationData[] | unknown;
    tanStackQueryDetected?: boolean;
    artificialStates?: Record<string, "loading" | "error">;
    clearArtificialStates?: boolean;
  }): Promise<boolean> {
    try {
      const processedUpdates: Partial<TanstackQueryStateType> = {};

      // Process queries - structured clone handles everything
      if (updates.queries !== undefined) {
        processedUpdates.queries = ensureArray<QueryData>(updates.queries);
      }

      // Process mutations - structured clone handles everything
      if (updates.mutations !== undefined) {
        processedUpdates.mutations = ensureArray<MutationData>(
          updates.mutations,
        );
      }

      // Process detection status
      if (updates.tanStackQueryDetected !== undefined) {
        processedUpdates.tanStackQueryDetected =
          typeof updates.tanStackQueryDetected === "boolean"
            ? updates.tanStackQueryDetected
            : false;
      }

      // Handle artificial states
      if (updates.clearArtificialStates) {
        processedUpdates.artificialStates = {};
      } else if (updates.artificialStates) {
        const currentState = await this.getStorage().get();
        processedUpdates.artificialStates = {
          ...currentState.artificialStates,
          ...updates.artificialStates,
        };
      }

      return this.safeUpdate(processedUpdates, {
        validateData: true,
        retryOnFailure: true,
      });
    } catch (error) {
      console.error("Batch update failed:", error);
      return false;
    }
  }

  // Enhanced action queue management
  async enqueueAction(
    action: Omit<StorageAction, "id" | "timestamp">,
  ): Promise<boolean> {
    try {
      const storage = this.getStorage();
      await storage.enqueueAction(action);
      return true;
    } catch (error) {
      console.error("Failed to enqueue action:", error);
      return false;
    }
  }

  // Get pending actions with error handling
  async getPendingActions(): Promise<StorageAction[]> {
    try {
      const storage = this.getStorage();
      return await storage.dequeueActions();
    } catch (error) {
      console.error("Failed to get pending actions:", error);
      return [];
    }
  }

  // Mark action as processed
  async markActionProcessed(actionId: string): Promise<boolean> {
    try {
      const storage = this.getStorage();
      await storage.markActionProcessed(actionId);
      return true;
    } catch (error) {
      console.error("Failed to mark action as processed:", error);
      return false;
    }
  }

  // Clear processed actions
  async clearProcessedActions(): Promise<boolean> {
    try {
      const storage = this.getStorage();
      await storage.clearProcessedActions();
      return true;
    } catch (error) {
      console.error("Failed to clear processed actions:", error);
      return false;
    }
  }

  // Subscribe to storage changes with cleanup tracking
  subscribe(callback: () => void | Promise<void>): () => void {
    if (!this.tabStorage) {
      throw new Error("Storage not initialized");
    }

    const unsubscribe = this.tabStorage.subscribe(callback);
    this.subscriptions.push(unsubscribe);

    return () => {
      const index = this.subscriptions.indexOf(unsubscribe);
      if (index > -1) {
        this.subscriptions.splice(index, 1);
      }
      unsubscribe();
    };
  }

  // Get current storage state safely
  async getCurrentState(): Promise<TanstackQueryStateType | null> {
    try {
      const storage = this.getStorage();
      return await storage.get();
    } catch (error) {
      console.error("Failed to get current state:", error);
      return null;
    }
  }

  // Reset storage to initial state
  async reset(): Promise<boolean> {
    try {
      const storage = this.getStorage();
      await storage.reset();
      return true;
    } catch (error) {
      console.error("Failed to reset storage:", error);
      return false;
    }
  }

  // Cleanup all subscriptions
  cleanup(): void {
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("Error during subscription cleanup:", error);
      }
    });
    this.subscriptions = [];
  }
}

// Utility functions for tab management
export class TabManager {
  // Get current tab ID from Chrome APIs (context-aware)
  static async getCurrentTabId(): Promise<number | null> {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime) {
        return null;
      }

      // In DevTools context, we can directly access the tab ID
      if (chrome.devtools?.inspectedWindow?.tabId) {
        return chrome.devtools.inspectedWindow.tabId;
      }

      // In extension pages (popup, options, etc.) we can use chrome.tabs.query
      if (chrome.tabs?.query) {
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          return tabs[0]?.id || null;
        } catch {
          // chrome.tabs.query not available, try background script
        }
      }

      // In content scripts, we need to ask the background script for tab ID
      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_TAB_ID",
        });
        return response?.tabId || null;
      } catch (error) {
        console.warn("Failed to get tab ID from background script:", error);
        return null;
      }
    } catch (error) {
      console.error("Failed to get tab ID:", error);
      return null;
    }
  }

  // Create and initialize enhanced storage for current tab
  static async createEnhancedStorage(): Promise<EnhancedStorageManager | null> {
    try {
      const tabId = await this.getCurrentTabId();
      if (!tabId) {
        console.warn("Could not determine tab ID for enhanced storage");
        return null;
      }

      const storage = new EnhancedStorageManager();
      await storage.initialize(tabId);
      return storage;
    } catch (error) {
      console.error("Failed to create enhanced storage:", error);
      return null;
    }
  }

  // Create enhanced storage with explicit tab ID (useful when tab ID is known)
  static async createEnhancedStorageForTab(
    tabId: number,
  ): Promise<EnhancedStorageManager | null> {
    try {
      const storage = new EnhancedStorageManager();
      await storage.initialize(tabId);
      return storage;
    } catch (error) {
      console.error(
        `Failed to create enhanced storage for tab ${tabId}:`,
        error,
      );
      return null;
    }
  }
}
