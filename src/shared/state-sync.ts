import { StorageManager } from "./storage-manager";
import type { QueryState } from "../types/storage";

export class StateSync {
  private listeners: Set<(state: QueryState) => void> = new Set();
  private isListening = false;

  constructor(listenToMessages = false) {
    this.setupStorageListener();
    if (listenToMessages) {
      this.setupMessageListener();
    }
  }

  private setupStorageListener(): void {
    if (this.isListening) return;

    StorageManager.onStateChange((state) => {
      this.notifyListeners(state);
    });

    this.isListening = true;
  }

  private setupMessageListener(): void {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "UPDATE_QUERY_STATE") {
        this.updateState(message.payload);
        sendResponse({ received: true });
      }
      return true; // Keep message channel open for async response
    });
  }

  private async updateState(newState: Partial<QueryState>): Promise<void> {
    try {
      await StorageManager.updatePartialState(newState);
      // Storage change event will notify all listeners automatically
    } catch (error) {
      console.error("Failed to update state:", error);
    }
  }

  subscribe(listener: (state: QueryState) => void): () => void {
    this.listeners.add(listener);

    // Send current state immediately
    StorageManager.getState()
      .then(listener)
      .catch((error) => {
        console.error("Failed to get initial state:", error);
      });

    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: QueryState): void {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error("Error in state listener:", error);
      }
    });
  }
}

export const stateSync = new StateSync(false);
