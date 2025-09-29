// Content script icon manager implementation
import type { IconUpdateMessage } from "../../types/messages";
import type { ContentScriptStorageManager } from "./storage-manager";

export class ContentScriptIconManager {
  private previousDetectionState: boolean | undefined = undefined;
  private unsubscribe: (() => void) | null = null;
  private storageManager: ContentScriptStorageManager | null = null;
  private tabId: number | null = null;

  initialize(storageManager: ContentScriptStorageManager): void {
    this.storageManager = storageManager;
    this.tabId = storageManager.getTabId();
  }

  async start(): Promise<void> {
    if (!this.storageManager || this.tabId === null) {
      throw new Error("Icon manager not properly initialized");
    }

    // Subscribe to storage changes for icon updates
    this.unsubscribe = this.storageManager.subscribe(async () => {
      await this.handleStorageChange();
    });

    // Set initial icon state
    await this.setInitialIconState();
  }

  private async handleStorageChange(): Promise<void> {
    if (!this.storageManager || this.tabId === null) return;

    try {
      const currentState = await this.storageManager.getCurrentState();
      if (!currentState) return;

      // Only update icon if detection state changed
      if (currentState.tanStackQueryDetected !== this.previousDetectionState) {
        this.previousDetectionState = currentState.tanStackQueryDetected;
        this.sendIconUpdate(currentState.tanStackQueryDetected, this.tabId);
      }
    } catch (error) {
      console.warn("Error in icon management subscription:", error);
    }
  }

  private async setInitialIconState(): Promise<void> {
    if (!this.storageManager || this.tabId === null) return;

    try {
      const initialState = await this.storageManager.getCurrentState();
      if (initialState) {
        this.sendIconUpdate(initialState.tanStackQueryDetected, this.tabId);
        this.previousDetectionState = initialState.tanStackQueryDetected;
      }
    } catch (error) {
      console.warn("Error setting initial icon state:", error);
    }
  }

  private sendIconUpdate(tanStackQueryDetected: boolean, tabId: number): void {
    const message: IconUpdateMessage = {
      type: "ICON_UPDATE",
      tanStackQueryDetected,
      tabId,
    };

    chrome.runtime.sendMessage(message).catch((error) => {
      console.warn("Failed to send icon update to background:", error);
    });
  }

  get isInitialized(): boolean {
    return !!this.storageManager && this.tabId !== null;
  }

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.storageManager = null;
    this.tabId = null;
    this.previousDetectionState = undefined;
  }
}
