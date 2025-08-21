import "webextension-polyfill";

import { useState, useEffect } from "react";
import type { QueryData, MutationData } from "../types/query";
import { stateSync } from "../shared/state-sync";

interface UsePopupConnectionReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  artificialStates: Map<string, "loading" | "error">;

  // Actions
  sendMessage: (message: unknown) => void;
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

// Send message function - gets active tab and routes through background
const sendMessage = async (message: unknown) => {
  try {
    const activeTabId = await getCurrentActiveTab();
    if (!activeTabId) {
      console.warn("No active tab found, cannot send message");
      return;
    }

    // Add active tab ID for proper routing through background script
    const messageWithTab = {
      ...(message as Record<string, unknown>),
      inspectedTabId: activeTabId,
    };

    await chrome.runtime.sendMessage(messageWithTab);
  } catch (error) {
    console.error("Failed to send message from popup:", error);
    throw error;
  }
};

export const usePopupConnection = (): UsePopupConnectionReturn => {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<
    boolean | null
  >(null);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  // Track artificial states from storage
  const [artificialStates, setArtificialStates] = useState<
    Map<string, "loading" | "error">
  >(new Map());

  // State sync instance - Popup only listens to storage, not messages

  // Note: Popup does not send immediate update requests to preserve artificial states
  // Tab switching and window focus changes in background.ts handle fresh data updates

  // Subscribe to storage changes with strict tab filtering
  useEffect(() => {
    const unsubscribe = stateSync.subscribe(async (state) => {
      const currentTabId = await getCurrentActiveTab();

      // Strict filtering: only show data if we have currentTabId and it matches state.tabId
      // This prevents showing stale data from previous tabs
      if (!currentTabId || !state.tabId || state.tabId !== currentTabId) {
        // Don't show any data until we have matching tab data
        // This ensures popup shows EmptyState for tabs without TanStack Query
        setTanStackQueryDetected(false);
        setQueries([]);
        setMutations([]);
        setArtificialStates(new Map());
        return;
      }

      // Only update state if data is from current active tab
      setTanStackQueryDetected(state.tanStackQueryDetected);
      setQueries(state.queries);
      setMutations(state.mutations);

      // Update artificial states from storage - extract only current tab's states
      if (currentTabId && state.artificialStates?.[currentTabId]) {
        const currentTabArtificialStates = state.artificialStates[currentTabId];
        const artificialStatesMap = new Map(
          Object.entries(currentTabArtificialStates),
        );
        setArtificialStates(artificialStatesMap);
      } else {
        setArtificialStates(new Map());
      }
    });

    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    // State
    tanStackQueryDetected,
    queries,
    mutations,
    artificialStates,

    // Actions
    sendMessage,
  };
};
