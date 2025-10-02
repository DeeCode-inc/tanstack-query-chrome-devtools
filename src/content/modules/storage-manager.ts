// Content script storage manager implementation
import type { EnhancedStorageManager } from "../../lib/enhanced-storage";
import type { QueryData, MutationData } from "../../types/query";
import type { TanstackQueryStateType } from "../../storage/base/types";

export class ContentScriptStorageManager {
  private storageManager: EnhancedStorageManager | null = null;

  initialize(storageManager: EnhancedStorageManager): void {
    this.storageManager = storageManager;
  }

  async updateQueries(
    payload: QueryData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<void> {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    await this.storageManager.updateQueries(payload, options);
  }

  async updateMutations(
    payload: MutationData[] | unknown,
    options: { validate?: boolean } = {},
  ): Promise<void> {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    await this.storageManager.updateMutations(payload, options);
  }

  async setDetectionStatus(detected: boolean): Promise<void> {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    await this.storageManager.setDetectionStatus(detected);
  }

  async batchUpdate(updates: Partial<TanstackQueryStateType>): Promise<void> {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    await this.storageManager.batchUpdate(updates);
  }

  async processUpdatePayload(payload: {
    queries?: unknown;
    mutations?: unknown;
    tanStackQueryDetected?: boolean;
  }): Promise<void> {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    // No deserialization needed - postMessage uses structured clone
    // Data is already in correct format
    await this.storageManager.batchUpdate({
      queries: payload.queries,
      mutations: payload.mutations,
      tanStackQueryDetected: payload.tanStackQueryDetected,
    });
  }

  async getCurrentState(): Promise<TanstackQueryStateType | null> {
    if (!this.storageManager) {
      return null;
    }

    return this.storageManager.getCurrentState();
  }

  subscribe(callback: () => void | Promise<void>): () => void {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    return this.storageManager.subscribe(callback);
  }

  getTabId(): number {
    if (!this.storageManager) {
      throw new Error("Storage manager not initialized");
    }

    return this.storageManager.getTabId();
  }

  get isInitialized(): boolean {
    return !!this.storageManager;
  }

  cleanup(): void {
    if (this.storageManager) {
      this.storageManager.cleanup();
      this.storageManager = null;
    }
  }
}
