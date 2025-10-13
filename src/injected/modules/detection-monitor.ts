// TanStack Query detection monitoring
export function monitorQueryClientDetection(
  onDetectionChange: (detected: boolean) => void,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
  } = {},
): () => void {
  const maxAttempts = options.maxAttempts ?? 120; // 2 minutes at 1 second intervals
  const intervalMs = options.intervalMs ?? 1000;

  let currentlyDetected = false;
  let attempts = 0;
  let detectionInterval: NodeJS.Timeout | null = null;

  const checkDetection = () => {
    const detected = !!window.__TANSTACK_QUERY_CLIENT__;

    if (detected !== currentlyDetected) {
      currentlyDetected = detected;
      try {
        onDetectionChange(detected);
      } catch (error) {
        console.error("Error in detection callback:", error);
      }

      // Stop monitoring once detected - no need to keep checking
      if (detected && detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
      }
    }
  };

  // Immediate detection check
  checkDetection();

  // Only start periodic checking if not already detected
  if (!currentlyDetected) {
    detectionInterval = setInterval(() => {
      checkDetection();
      attempts++;

      // Stop after max attempts if still not found
      if (attempts >= maxAttempts && !currentlyDetected) {
        if (detectionInterval) {
          clearInterval(detectionInterval);
          detectionInterval = null;
        }
      }
    }, intervalMs);
  }

  // Return cleanup function
  return () => {
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
  };
}

// Helper to get current detection state
export function isQueryClientDetected(): boolean {
  return !!window.__TANSTACK_QUERY_CLIENT__;
}
