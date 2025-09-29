// Message batching system for 60fps performance optimization
// Based on message-flow-plan.md specifications

export interface BatchableMessage {
  id?: string;
  type: string;
  payload?: unknown;
  timestamp?: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  batchIntervalMs: number;
  enableFrameRateLimit: boolean;
  maxWaitTimeMs: number;
}

export interface BatchProcessor<T extends BatchableMessage> {
  process: (messages: T[]) => Promise<void> | void;
}

export class MessageBatcher<T extends BatchableMessage> {
  private pendingMessages: T[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private frameId: number | null = null;
  private lastProcessTime = 0;
  private isProcessing = false;

  private processor: BatchProcessor<T>;
  private config: BatchConfig;

  constructor(
    processor: BatchProcessor<T>,
    config: BatchConfig = {
      maxBatchSize: 10,
      batchIntervalMs: 16, // ~60fps (1000ms / 60fps = 16.67ms)
      enableFrameRateLimit: true,
      maxWaitTimeMs: 100, // Max 100ms wait to ensure responsiveness
    },
  ) {
    this.processor = processor;
    this.config = config;
  }

  /**
   * Add a message to the batch queue
   */
  enqueue(message: T): void {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = performance.now();
    }

    this.pendingMessages.push(message);

    // Process immediately if batch is full
    if (this.pendingMessages.length >= this.config.maxBatchSize) {
      this.processImmediately();
      return;
    }

    // Check if any message has been waiting too long
    const oldestMessage = this.pendingMessages[0];
    const waitTime = performance.now() - (oldestMessage.timestamp || 0);
    if (waitTime >= this.config.maxWaitTimeMs) {
      this.processImmediately();
      return;
    }

    // Schedule batch processing
    this.scheduleBatchProcessing();
  }

  /**
   * Process all pending messages immediately
   */
  async processImmediately(): Promise<void> {
    if (this.isProcessing || this.pendingMessages.length === 0) {
      return;
    }

    this.cancelScheduledProcessing();
    await this.processBatch();
  }

  /**
   * Schedule batch processing with frame rate limiting
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer || this.frameId) {
      return; // Already scheduled
    }

    if (
      this.config.enableFrameRateLimit &&
      typeof requestAnimationFrame !== "undefined"
    ) {
      // Use requestAnimationFrame for smooth 60fps batching
      this.frameId = requestAnimationFrame(() => {
        this.frameId = null;
        this.checkFrameRateAndProcess();
      });
    } else {
      // Fallback to timer-based batching
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null;
        this.processBatch();
      }, this.config.batchIntervalMs);
    }
  }

  /**
   * Check frame rate and process if enough time has passed
   */
  private checkFrameRateAndProcess(): void {
    const now = performance.now();
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (timeSinceLastProcess >= this.config.batchIntervalMs) {
      this.processBatch();
    } else {
      // Schedule for the remaining time to maintain 60fps
      const remainingTime = this.config.batchIntervalMs - timeSinceLastProcess;
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null;
        this.processBatch();
      }, remainingTime);
    }
  }

  /**
   * Process the current batch of messages
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingMessages.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.lastProcessTime = performance.now();

    try {
      // Extract messages to process
      const messagesToProcess = this.pendingMessages.splice(
        0,
        this.config.maxBatchSize,
      );

      // Process the batch
      await this.processor.process(messagesToProcess);

      // If there are more messages, schedule the next batch
      if (this.pendingMessages.length > 0) {
        this.scheduleBatchProcessing();
      }
    } catch (error) {
      console.error("Error processing message batch:", error);

      // Don't lose messages on error - they remain in the queue
      // The next batch processing will retry them
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel any scheduled processing
   */
  private cancelScheduledProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Get current batch statistics
   */
  getStats() {
    return {
      pendingMessages: this.pendingMessages.length,
      isProcessing: this.isProcessing,
      lastProcessTime: this.lastProcessTime,
      config: { ...this.config },
    };
  }

  /**
   * Flush all pending messages immediately and cleanup
   */
  async flush(): Promise<void> {
    this.cancelScheduledProcessing();

    if (this.pendingMessages.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Clear all pending messages without processing
   */
  clear(): void {
    this.cancelScheduledProcessing();
    this.pendingMessages.length = 0;
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cancelScheduledProcessing();
    this.clear();
  }
}

/**
 * Factory function to create a message batcher with common configurations
 */
export function createMessageBatcher<T extends BatchableMessage>(
  processor: BatchProcessor<T>,
  preset: "high-performance" | "balanced" | "low-latency" = "balanced",
): MessageBatcher<T> {
  const configs = {
    "high-performance": {
      maxBatchSize: 20,
      batchIntervalMs: 16, // 60fps
      enableFrameRateLimit: true,
      maxWaitTimeMs: 50,
    },
    balanced: {
      maxBatchSize: 10,
      batchIntervalMs: 16, // 60fps
      enableFrameRateLimit: true,
      maxWaitTimeMs: 100,
    },
    "low-latency": {
      maxBatchSize: 5,
      batchIntervalMs: 8, // 120fps
      enableFrameRateLimit: true,
      maxWaitTimeMs: 32,
    },
  };

  return new MessageBatcher(processor, configs[preset]);
}
