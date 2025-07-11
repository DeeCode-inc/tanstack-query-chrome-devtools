// Helper function to format query key (single line for list)
export function formatQueryKeyShort(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey);
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
