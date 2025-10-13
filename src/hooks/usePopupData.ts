import "webextension-polyfill";

import { useTabStorage } from "./useTabStorage";
import { useArtificialStates } from "./useArtificialStates";
import type { QueryData, MutationData } from "../types/query";
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
} from "../types/messages";
import { useState, useEffect } from "react";

type ActionMessage = QueryActionMessage | BulkQueryActionMessage;

interface UsePopupDataReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  artificialStates: Map<string, "loading" | "error">;
  tabId: number | null;

  // Actions
  sendMessage: (message: ActionMessage) => void;
}

// Get current active tab ID
const getCurrentActiveTab = async (): Promise<number | null> => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return activeTab?.id || null;
  } catch (error) {
    console.error("Failed to get current active tab:", error);
    return null;
  }
};

// Send message function - now uses direct Chrome messaging instead of storage queue
const sendMessage = async (message: ActionMessage) => {
  try {
    const activeTabId = await getCurrentActiveTab();
    if (!activeTabId) {
      console.warn("No active tab found, cannot send action");
      return;
    }

    // Send action directly to background script for forwarding to content script
    await chrome.runtime.sendMessage({
      type: "QUERY_ACTION",
      tabId: activeTabId,
      action: message, // Send QueryActionMessage directly without wrapping
    });
  } catch (error) {
    console.error("Failed to send action from popup:", error);
    throw error;
  }
};

/**
 * Simplified hook for Popup that uses tab-scoped storage.
 * Replaces the complex usePopupConnection hook with clean storage-based approach.
 */
export const usePopupData = (): UsePopupDataReturn => {
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const storage = useTabStorage(currentTabId || 0); // Use 0 as fallback, will be replaced
  const data = currentTabId ? storage.getSnapshot() : null;

  // Use the new artificial states hook for proper reactivity (only when we have a tab ID)
  const { artificialStates } = useArtificialStates(currentTabId || 0);

  // Get current active tab on mount and when popup opens
  useEffect(() => {
    getCurrentActiveTab().then(async (tabId) => {
      setCurrentTabId(tabId);
      // Note: No need to request immediate update - reactive storage subscriptions
      // keep Chrome Storage fresh automatically via TanStack Query subscriptions
    });
  }, []);

  // Handle loading state or no tab ID
  if (!currentTabId || !data) {
    return {
      tanStackQueryDetected: false, // Default to false for popup (shows EmptyState)
      queries: [],
      mutations: [],
      artificialStates: new Map(),
      tabId: null,
      sendMessage,
    };
  }

  return {
    // State from tab-scoped storage
    tanStackQueryDetected: data.tanStackQueryDetected,
    queries: data.queries,
    mutations: data.mutations,
    artificialStates: artificialStates, // Use the reactive artificial states from the hook
    tabId: currentTabId,

    // Actions
    sendMessage,
  };
};
