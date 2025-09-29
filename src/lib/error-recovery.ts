// Error recovery system with exponential backoff retry logic
// Based on message-flow-plan.md specifications

export interface RetryableOperation<T> {
  execute: () => Promise<T>;
  validate?: (result: T) => boolean;
  name?: string;
}

export interface ErrorRecoveryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  resetTimeoutMs: number;
}

export interface RetryContext {
  attempt: number;
  lastError: Error | null;
  totalElapsed: number;
  nextDelayMs: number;
}

export interface ErrorRecoveryStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalRetries: number;
  avgRetriesPerOperation: number;
  lastResetTime: number;
}

export class ErrorRecovery {
  private stats: ErrorRecoveryStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalRetries: 0,
    avgRetriesPerOperation: 0,
    lastResetTime: Date.now(),
  };

  private resetTimer: NodeJS.Timeout | null = null;
  private config: ErrorRecoveryConfig;

  constructor(
    config: ErrorRecoveryConfig = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      resetTimeoutMs: 300000, // 5 minutes
    },
  ) {
    this.config = config;
    this.scheduleStatsReset();
  }

  /**
   * Execute an operation with exponential backoff retry logic
   */
  async executeWithRetry<T>(operation: RetryableOperation<T>): Promise<T> {
    this.stats.totalOperations++;
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const result = await operation.execute();

        // Validate result if validator provided
        if (operation.validate && !operation.validate(result)) {
          throw new Error(
            `Operation validation failed: ${operation.name || "unknown"}`,
          );
        }

        // Success - update stats and return
        this.stats.successfulOperations++;
        if (attempt > 1) {
          this.stats.totalRetries += attempt - 1;
        }
        this.updateAverageRetries();

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is the last attempt, fail
        if (attempt > this.config.maxRetries) {
          this.stats.failedOperations++;
          this.stats.totalRetries += attempt - 1;
          this.updateAverageRetries();

          throw new Error(
            `Operation failed after ${this.config.maxRetries} retries: ${lastError.message}`,
          );
        }

        // Calculate delay for next attempt
        const context: RetryContext = {
          attempt,
          lastError,
          totalElapsed: Date.now() - startTime,
          nextDelayMs: this.calculateDelay(attempt),
        };

        // Log retry attempt
        console.warn(
          `Retry attempt ${attempt}/${this.config.maxRetries} for operation: ${
            operation.name || "unknown"
          }. Waiting ${context.nextDelayMs}ms. Error: ${lastError.message}`,
        );

        // Wait before retry
        await this.delay(context.nextDelayMs);
      }
    }

    // This should never be reached due to the throw above
    throw lastError || new Error("Unknown error during retry execution");
  }

  /**
   * Execute an operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    operation: RetryableOperation<T>,
    failureThreshold = 5,
    timeoutMs = 60000,
  ): Promise<T> {
    const recentFailures = this.getRecentFailures(timeoutMs);

    if (recentFailures >= failureThreshold) {
      throw new Error(
        `Circuit breaker open: ${recentFailures} failures in the last ${timeoutMs}ms`,
      );
    }

    return this.executeWithRetry(operation);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter =
      cappedDelay * this.config.jitterFactor * (Math.random() - 0.5);
    const finalDelay = Math.max(0, cappedDelay + jitter);

    return Math.round(finalDelay);
  }

  /**
   * Create a delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get number of recent failures for circuit breaker
   */
  private getRecentFailures(timeoutMs: number): number {
    // For simplicity, using a basic calculation based on current stats
    // In a production system, you'd want to track individual failure timestamps
    const timeSinceReset = Date.now() - this.stats.lastResetTime;
    if (timeSinceReset > timeoutMs) {
      return 0; // Reset period exceeded
    }

    const failureRate =
      this.stats.failedOperations / Math.max(1, this.stats.totalOperations);
    return Math.round(failureRate * 10); // Simplified failure count
  }

  /**
   * Update average retries calculation
   */
  private updateAverageRetries(): void {
    this.stats.avgRetriesPerOperation =
      this.stats.totalRetries / Math.max(1, this.stats.totalOperations);
  }

  /**
   * Schedule periodic stats reset
   */
  private scheduleStatsReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.resetStats();
      this.scheduleStatsReset(); // Schedule next reset
    }, this.config.resetTimeoutMs);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      avgRetriesPerOperation: 0,
      lastResetTime: Date.now(),
    };
  }

  /**
   * Get current statistics
   */
  getStats(): ErrorRecoveryStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorRecoveryConfig {
    return { ...this.config };
  }

  /**
   * Create a wrapper function for an operation that automatically includes retry logic
   */
  wrapOperation<T>(operation: RetryableOperation<T>): () => Promise<T> {
    return () => this.executeWithRetry(operation);
  }

  /**
   * Create a wrapper function with circuit breaker
   */
  wrapOperationWithCircuitBreaker<T>(
    operation: RetryableOperation<T>,
    failureThreshold?: number,
    timeoutMs?: number,
  ): () => Promise<T> {
    return () =>
      this.executeWithCircuitBreaker(operation, failureThreshold, timeoutMs);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

/**
 * Factory function to create ErrorRecovery with common presets
 */
export function createErrorRecovery(
  preset: "aggressive" | "balanced" | "conservative" = "balanced",
): ErrorRecovery {
  const configs = {
    aggressive: {
      maxRetries: 5,
      initialDelayMs: 50,
      maxDelayMs: 2000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.1,
      resetTimeoutMs: 180000, // 3 minutes
    },
    balanced: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      resetTimeoutMs: 300000, // 5 minutes
    },
    conservative: {
      maxRetries: 2,
      initialDelayMs: 200,
      maxDelayMs: 10000,
      backoffMultiplier: 3,
      jitterFactor: 0.2,
      resetTimeoutMs: 600000, // 10 minutes
    },
  };

  return new ErrorRecovery(configs[preset]);
}

/**
 * Helper function to wrap any async function with error recovery
 */
export function withErrorRecovery<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  recovery: ErrorRecovery,
  options?: { name?: string; validate?: (result: R) => boolean },
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return recovery.executeWithRetry({
      execute: () => fn(...args),
      validate: options?.validate,
      name: options?.name || fn.name || "anonymous function",
    });
  };
}
