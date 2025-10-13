import "webextension-polyfill";

import { useTabStorage } from "./useTabStorage";
import { useArtificialStates } from "./useArtificialStates";
import type { QueryData, MutationData } from "../types/query";
import type {
  QueryActionMessage,
  BulkQueryActionMessage,
} from "../types/messages";

type ActionMessage = QueryActionMessage | BulkQueryActionMessage;

interface UseDevToolsDataReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  artificialStates: Map<string, "loading" | "error">;

  // Actions
  sendMessage: (message: ActionMessage) => void;
}

// Send message function - now uses direct Chrome messaging instead of storage queue
const sendMessage = (message: ActionMessage) => {
  try {
    const currentTabId = chrome.devtools.inspectedWindow.tabId;

    chrome.runtime
      .sendMessage({
        type: "QUERY_ACTION",
        tabId: currentTabId,
        action: message, // Send QueryActionMessage directly without wrapping
      })
      .catch((error) => {
        console.error("Failed to send action:", error);
      });
  } catch (error) {
    console.error("Failed to send action:", error);
    throw error;
  }
};

/**
 * Simplified hook for DevTools that uses tab-scoped storage.
 * Replaces the complex useConnection hook with clean storage-based approach.
 */
export const useDevToolsData = (): UseDevToolsDataReturn => {
  const currentTabId = chrome.devtools.inspectedWindow.tabId;
  const storage = useTabStorage(currentTabId);
  const data = storage.getSnapshot();

  // Use the new artificial states hook for proper reactivity
  const { artificialStates } = useArtificialStates(currentTabId);

  // Handle loading state - return null for tanStackQueryDetected while loading
  if (!data) {
    return {
      tanStackQueryDetected: null,
      queries: [],
      mutations: [],
      artificialStates: new Map(),
      sendMessage,
    };
  }

  return {
    // State from tab-scoped storage
    tanStackQueryDetected: data.tanStackQueryDetected,
    queries: data.queries,
    mutations: data.mutations,
    artificialStates: artificialStates,

    // Actions
    sendMessage,
  };
};
