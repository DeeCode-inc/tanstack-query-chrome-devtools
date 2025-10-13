// Content script icon manager implementation
import type { IconUpdateMessage } from "../../types/messages";
import type { EnhancedStorageManager } from "../../lib/enhanced-storage";

export class ContentScriptIconManager {
  private previousDetectionState: boolean | undefined = undefined;
  private unsubscribe: (() => void) | null = null;
  private storage: EnhancedStorageManager | null = null;
  private tabId: number | null = null;

  initialize(storage: EnhancedStorageManager): void {
    this.storage = storage;
    this.tabId = storage.getTabId();
  }

  async start(): Promise<void> {
    if (!this.storage || this.tabId === null) {
      throw new Error("Icon manager not properly initialized");
    }

    // Subscribe to storage changes for icon updates
    this.unsubscribe = this.storage.subscribe(async () => {
      await this.handleStorageChange();
    });

    // Set initial icon state
    await this.setInitialIconState();
  }

  private async handleStorageChange(): Promise<void> {
    if (!this.storage || this.tabId === null) return;

    try {
      const currentState = await this.storage.getCurrentState();
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
    if (!this.storage || this.tabId === null) return;

    try {
      const initialState = await this.storage.getCurrentState();
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

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.storage = null;
    this.tabId = null;
    this.previousDetectionState = undefined;
  }
}
