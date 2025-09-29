// TanStack Query detection and monitoring
export class TanStackQueryDetectionManager {
  private detectionInterval: NodeJS.Timeout | null = null;
  private currentlyDetected = false;
  private listeners: Array<(detected: boolean) => void> = [];
  private maxAttempts = 120; // 2 minutes at 1 second intervals

  startMonitoring(): void {
    // Immediate detection
    this.checkDetection();

    // Periodic detection with smart intervals
    let attempts = 0;
    this.detectionInterval = setInterval(() => {
      this.checkDetection();
      attempts++;

      // Stop after max attempts if not found
      if (attempts >= this.maxAttempts && !this.currentlyDetected) {
        this.stopMonitoring();
      }
    }, 1000);
  }

  stopMonitoring(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  private checkDetection(): void {
    const detected = !!window.__TANSTACK_QUERY_CLIENT__;

    if (detected !== this.currentlyDetected) {
      this.currentlyDetected = detected;
      this.notifyListeners(detected);
    }
  }

  private notifyListeners(detected: boolean): void {
    this.listeners.forEach((listener) => {
      try {
        listener(detected);
      } catch (error) {
        console.error("Error in detection listener:", error);
      }
    });
  }

  onDetectionChange(callback: (detected: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  get isDetected(): boolean {
    return this.currentlyDetected;
  }

  cleanup(): void {
    this.stopMonitoring();
    this.listeners = [];
  }
}
