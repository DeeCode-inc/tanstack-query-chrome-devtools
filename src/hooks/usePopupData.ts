import "webextension-polyfill";

import { useTabStorage } from "./useTabStorage";
import { useArtificialStates } from "./useArtificialStates";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";
import type { QueryData, MutationData } from "../types/query";
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
  RequestImmediateUpdateMessage,
} from "../types/messages";
import { useState, useEffect } from "react";

type ActionMessage =
  | QueryActionMessage
  | BulkQueryActionMessage
  | RequestImmediateUpdateMessage;

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

// Send message function - now enqueues actions in storage instead of sending messages
const sendMessage = async (message: ActionMessage) => {
  try {
    const activeTabId = await getCurrentActiveTab();
    if (!activeTabId) {
      console.warn("No active tab found, cannot enqueue action");
      return;
    }

    const tabStorage = tabScopedStorageManager.getStorageForTab(activeTabId);

    // Convert message to action and enqueue in storage
    await tabStorage.enqueueAction({
      type: message.type,
      payload: message,
    });
  } catch (error) {
    console.error("Failed to enqueue action from popup:", error);
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

      // Request immediate update when popup opens to ensure fresh data
      if (tabId) {
        try {
          const tabStorage = tabScopedStorageManager.getStorageForTab(tabId);
          await tabStorage.enqueueAction({
            type: "REQUEST_IMMEDIATE_UPDATE",
            payload: { type: "REQUEST_IMMEDIATE_UPDATE" },
          });
        } catch (error) {
          console.error("Failed to request immediate update:", error);
        }
      }
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
