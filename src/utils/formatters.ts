// Helper function to format query key (single line for list)
export function formatQueryKeyShort(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey).replace(/"/g, "");
  } catch {
    return String(queryKey);
  }
}

// Helper function to format query key (multi-line for details)
export function formatQueryKeyDetailed(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey, null, 2);
  } catch {
    return String(queryKey);
  }
}

// Helper function to create a query key string for tracking
export function getQueryKeyString(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}
