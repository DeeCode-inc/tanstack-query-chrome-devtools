import { useStorage } from "./use-storage";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";
import type { TanstackQueryStorageType } from "../storage/base/types";

/**
 * Hook to get tab-scoped TanStack Query storage for a specific tab.
 * This provides complete isolation between tabs.
 */
export const useTabStorage = (tabId: number): TanstackQueryStorageType => {
  const storage = tabScopedStorageManager.getStorageForTab(tabId);

  // Use the storage with the useStorage hook to get reactive updates
  const data = useStorage(storage);

  // Return both the reactive data and the storage actions
  return {
    ...storage,
    // Override getSnapshot to return the reactive data
    getSnapshot: () => data,
  };
};
