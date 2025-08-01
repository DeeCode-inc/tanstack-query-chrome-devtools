import type { QueryState } from "../types/storage";

export class StorageManager {
  private static readonly STORAGE_KEY = "tanstack-query-state";
  private static updateInProgress = false;
  private static pendingUpdates: Partial<QueryState>[] = [];

  static async getState(): Promise<QueryState> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return (
        result[this.STORAGE_KEY] || {
          queries: [],
          mutations: [],
          tanStackQueryDetected: false,
          lastUpdated: Date.now(),
        }
      );
    } catch (error) {
      console.error("Failed to get state from storage:", error);
      return {
        queries: [],
        mutations: [],
        tanStackQueryDetected: false,
        lastUpdated: Date.now(),
      };
    }
  }

  static async setState(state: QueryState): Promise<void> {
    try {
      const stateWithTimestamp = {
        ...state,
        lastUpdated: Date.now(),
      };
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: stateWithTimestamp,
      });
    } catch (error) {
      console.error("Failed to set state in storage:", error);
      throw error;
    }
  }

  static onStateChange(callback: (state: QueryState) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[this.STORAGE_KEY]) {
        const newValue = changes[this.STORAGE_KEY].newValue;
        if (newValue) {
          callback(newValue);
        }
      }
    });
  }

  static async clearState(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear state from storage:", error);
      throw error;
    }
  }

  static async updatePartialState(updates: Partial<QueryState>): Promise<void> {
    // If an update is already in progress, queue this update
    if (this.updateInProgress) {
      this.pendingUpdates.push(updates);
      return;
    }

    this.updateInProgress = true;

    try {
      // Process the current update plus any queued updates
      let allUpdates = { ...updates };

      // Merge any pending updates
      while (this.pendingUpdates.length > 0) {
        const pendingUpdate = this.pendingUpdates.shift()!;
        allUpdates = { ...allUpdates, ...pendingUpdate };
      }

      const currentState = await this.getState();
      const newState = { ...currentState, ...allUpdates };
      await this.setState(newState);
    } catch (error) {
      console.error("Failed to update partial state:", error);
      throw error;
    } finally {
      this.updateInProgress = false;

      // Process any updates that came in while we were working
      if (this.pendingUpdates.length > 0) {
        const nextUpdate = this.pendingUpdates.shift()!;
        this.updatePartialState(nextUpdate);
      }
    }
  }
}
