// Action processor for handling queued actions between DevTools/Popup and injected script
import type { StorageAction } from "../storage/base/types";
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
  RequestImmediateUpdateMessage,
  ClearArtificialStatesMessage,
} from "../types/messages";
import { EnhancedStorageManager } from "./enhanced-storage";
import { MessageSerializer } from "./serialization-manager";

// Extended storage action with retry information
interface ExtendedStorageAction extends StorageAction {
  retryCount?: number;
}

// Action result tracking
interface ActionResult {
  actionId: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

// Action processor configuration
interface ActionProcessorConfig {
  processingInterval?: number; // How often to check for actions (ms)
  maxRetries?: number; // Max retries for failed actions
  retryDelay?: number; // Delay between retries (ms)
  batchSize?: number; // Max actions to process per batch
}

export class ActionProcessor {
  private isProcessing = false;
  private isStarted = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private storageManager: EnhancedStorageManager;
  private config: Required<ActionProcessorConfig>;
  private actionResults = new Map<string, ActionResult>();

  constructor(
    storageManager: EnhancedStorageManager,
    config: ActionProcessorConfig = {},
  ) {
    this.storageManager = storageManager;
    this.config = {
      processingInterval: config.processingInterval || 100,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 500,
      batchSize: config.batchSize || 10,
    };
  }

  // Start processing actions
  start(): void {
    if (this.isStarted) return;

    this.isStarted = true;

    // Set up periodic processing
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processActionQueue();
      }
    }, this.config.processingInterval);

    // Also listen for storage changes to process immediately
    this.storageManager.subscribe(() => {
      if (!this.isProcessing) {
        this.processActionQueue();
      }
    });
  }

  // Stop processing actions
  stop(): void {
    if (!this.isStarted) return;

    this.isStarted = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Main action processing loop
  private async processActionQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const pendingActions = await this.storageManager.getPendingActions();

      if (pendingActions.length === 0) {
        return;
      }

      // Process actions in batches
      const batches = this.createBatches(pendingActions, this.config.batchSize);

      for (const batch of batches) {
        await Promise.all(
          batch.map((action) =>
            this.processAction(action as ExtendedStorageAction),
          ),
        );
      }

      // Clean up processed actions
      await this.cleanupProcessedActions();
    } catch (error) {
      console.error("Error processing action queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single action
  private async processAction(action: ExtendedStorageAction): Promise<void> {
    try {
      // Send action to injected script
      const success = await this.sendActionToInjected(action);

      if (success) {
        // Mark as processed
        await this.storageManager.markActionProcessed(action.id);

        // Record success
        this.actionResults.set(action.id, {
          actionId: action.id,
          success: true,
          timestamp: Date.now(),
        });
      } else {
        // Handle retry logic
        await this.handleActionFailure(action);
      }
    } catch (error) {
      console.error(`Failed to process action ${action.id}:`, error);
      await this.handleActionFailure(action, error);
    }
  }

  // Send action to injected script via postMessage
  private async sendActionToInjected(
    action: ExtendedStorageAction,
  ): Promise<boolean> {
    try {
      // Prepare message for transmission
      const message = MessageSerializer.prepareForPostMessage({
        ...action.payload,
        source: "tanstack-query-devtools-content",
        actionId: action.id,
      });

      // Send via postMessage
      window.postMessage(message, window.location.origin);

      return true;
    } catch (error) {
      console.error("Failed to send action to injected script:", error);
      return false;
    }
  }

  // Handle action failure and retry logic
  private async handleActionFailure(
    action: ExtendedStorageAction,
    error?: unknown,
  ): Promise<void> {
    const retryCount = (action.retryCount || 0) + 1;

    if (retryCount <= this.config.maxRetries) {
      // Update retry count and retry later
      console.warn(
        `Action ${action.id} failed, retrying (${retryCount}/${this.config.maxRetries})`,
      );

      // Wait before retry
      setTimeout(async () => {
        try {
          // Update action with retry count
          const updatedAction: ExtendedStorageAction = {
            ...action,
            retryCount,
            timestamp: Date.now(),
          };

          await this.processAction(updatedAction);
        } catch (retryError) {
          console.error(`Retry failed for action ${action.id}:`, retryError);
        }
      }, this.config.retryDelay * retryCount);
    } else {
      // Max retries exceeded, mark as failed
      console.error(
        `Action ${action.id} exceeded max retries, marking as failed`,
      );

      await this.storageManager.markActionProcessed(action.id);

      this.actionResults.set(action.id, {
        actionId: action.id,
        success: false,
        error: error ? String(error) : "Unknown error",
        timestamp: Date.now(),
      });
    }
  }

  // Create batches from actions array
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  // Clean up processed actions
  private async cleanupProcessedActions(): Promise<void> {
    try {
      await this.storageManager.clearProcessedActions();
    } catch (error) {
      console.error("Failed to cleanup processed actions:", error);
    }
  }

  // Get action result
  getActionResult(actionId: string): ActionResult | null {
    return this.actionResults.get(actionId) || null;
  }

  // Get all action results
  getAllActionResults(): ActionResult[] {
    return Array.from(this.actionResults.values());
  }

  // Clear action results
  clearActionResults(): void {
    this.actionResults.clear();
  }

  // Get processing status
  get processing(): boolean {
    return this.isProcessing;
  }

  get started(): boolean {
    return this.isStarted;
  }
}

// Utility functions for creating action messages
export class ActionMessageFactory {
  // Create query action message
  static createQueryAction(
    action: QueryActionMessage["action"],
    queryHash: string,
    newData?: unknown,
  ): QueryActionMessage {
    return {
      type: "QUERY_ACTION",
      action,
      queryHash,
      ...(newData !== undefined && { newData }),
    };
  }

  // Create bulk query action message
  static createBulkQueryAction(
    action: BulkQueryActionMessage["action"],
  ): BulkQueryActionMessage {
    return {
      type: "BULK_QUERY_ACTION",
      action,
    };
  }

  // Create immediate update request
  static createImmediateUpdateRequest(
    preserveArtificialStates?: boolean,
  ): RequestImmediateUpdateMessage {
    return {
      type: "REQUEST_IMMEDIATE_UPDATE",
      ...(preserveArtificialStates !== undefined && {
        preserveArtificialStates,
      }),
    };
  }

  // Create clear artificial states message
  static createClearArtificialStates(): ClearArtificialStatesMessage {
    return {
      type: "CLEAR_ARTIFICIAL_STATES",
    };
  }
}

// Action processor factory
export class ActionProcessorFactory {
  // Create action processor for current tab
  static async createForCurrentTab(
    config?: ActionProcessorConfig,
  ): Promise<ActionProcessor | null> {
    try {
      const storageManager = await import("./enhanced-storage").then((module) =>
        module.TabManager.createEnhancedStorage(),
      );

      if (!storageManager) {
        console.error("Failed to create storage manager for action processor");
        return null;
      }

      return new ActionProcessor(storageManager, config);
    } catch (error) {
      console.error("Failed to create action processor:", error);
      return null;
    }
  }
}
