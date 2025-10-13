// Enhanced storage interface and utilities for the refactored content/injected scripts
import type {
  TanstackQueryStorageType,
  TanstackQueryStateType,
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
  private tabStorage: TanstackQueryStorageType | null = null;
  private tabId: number | null = null;
  private subscriptions: Array<() => void> = [];

  // Initialize with tab ID
  async initialize(tabId: number): Promise<void> {
    this.tabId = tabId;
    this.tabStorage = tabScopedStorageManager.getStorageForTab(tabId);
  }

  // Get current storage instance
  getStorage(): TanstackQueryStorageType {
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

  // Update queries - simplified
  async updateQueries(
    queries: QueryData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<void> {
    const processedQueries = options.validate
      ? ensureArray<QueryData>(queries)
      : (queries as QueryData[]);

    await this.tabStorage!.batchUpdate({ queries: processedQueries });
  }

  // Update mutations - simplified
  async updateMutations(
    mutations: MutationData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<void> {
    const processedMutations = options.validate
      ? ensureArray<MutationData>(mutations)
      : (mutations as MutationData[]);

    await this.tabStorage!.batchUpdate({ mutations: processedMutations });
  }

  // Update detection status - simplified
  async setDetectionStatus(detected: boolean): Promise<void> {
    await this.tabStorage!.batchUpdate({ tanStackQueryDetected: detected });
  }

  // Batch update - simplified
  async batchUpdate(updates: {
    queries?: QueryData[] | unknown;
    mutations?: MutationData[] | unknown;
    tanStackQueryDetected?: boolean;
    artificialStates?: Record<string, "loading" | "error">;
    clearArtificialStates?: boolean;
  }): Promise<void> {
    const processedUpdates: Partial<TanstackQueryStateType> = {};

    // Process queries
    if (updates.queries !== undefined) {
      processedUpdates.queries = ensureArray<QueryData>(updates.queries);
    }

    // Process mutations
    if (updates.mutations !== undefined) {
      processedUpdates.mutations = ensureArray<MutationData>(updates.mutations);
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
      const currentState = await this.tabStorage!.get();
      processedUpdates.artificialStates = {
        ...currentState.artificialStates,
        ...updates.artificialStates,
      };
    }

    await this.tabStorage!.batchUpdate(processedUpdates);
  }

  // Subscribe to storage changes with cleanup tracking
  subscribe(callback: () => void | Promise<void>): () => void {
    const unsubscribe = this.tabStorage!.subscribe(callback);
    this.subscriptions.push(unsubscribe);

    return () => {
      const index = this.subscriptions.indexOf(unsubscribe);
      if (index > -1) {
        this.subscriptions.splice(index, 1);
      }
      unsubscribe();
    };
  }

  // Get current storage state
  async getCurrentState(): Promise<TanstackQueryStateType | null> {
    return await this.tabStorage!.get();
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
}
