/**
 * Storage Mutex - Prevents race conditions in concurrent storage operations
 *
 * This class ensures that storage operations are executed atomically per storage key,
 * preventing the race condition where multiple set() calls can corrupt each other's
 * cache state due to shared variables.
 */
export class StorageMutex {
  private pending = new Map<string, Promise<unknown>>();

  /**
   * Executes an operation with exclusive access for the given key.
   * Ensures that only one operation per key can run at a time.
   *
   * @param key - The storage key to lock (ensures per-storage-instance isolation)
   * @param operation - The async operation to execute exclusively
   * @returns Promise that resolves with the operation result
   */
  async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this key to complete
    const existing = this.pending.get(key);
    if (existing) {
      try {
        await existing;
      } catch {
        // Ignore errors from previous operations, just wait for completion
        // Each operation should handle its own errors independently
      }
    }

    // Create and register our operation promise
    const operationPromise = operation();
    this.pending.set(key, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      // Clean up only if this is still the current operation
      // This prevents cleanup race conditions when operations overlap
      if (this.pending.get(key) === operationPromise) {
        this.pending.delete(key);
      }
    }
  }

  /**
   * Get the number of pending operations (useful for debugging)
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Check if a specific key has a pending operation
   */
  hasPendingOperation(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Clear all pending operations (useful for testing or cleanup)
   * Note: This doesn't cancel operations, just removes them from tracking
   */
  clear(): void {
    this.pending.clear();
  }
}

/**
 * Global mutex instance for storage operations
 * Each storage instance will use this shared mutex with its own key
 */
export const globalStorageMutex = new StorageMutex();
