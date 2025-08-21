import "webextension-polyfill";

import { useState, useEffect } from "react";
import type { QueryData, MutationData } from "../types/query";
import { stateSync } from "../shared/state-sync";

interface UseConnectionReturn {
  // State
  tanStackQueryDetected: boolean | null;
  queries: QueryData[];
  mutations: MutationData[];
  artificialStates: Map<string, "loading" | "error">;

  // Actions
  sendMessage: (message: unknown) => void;
}

// Send message function - now sends through background to content script
const sendMessage = (message: unknown) => {
  try {
    // Add inspected tab ID for proper routing
    const messageWithTab = {
      ...(message as Record<string, unknown>),
      inspectedTabId: chrome.devtools.inspectedWindow.tabId,
    };

    chrome.runtime.sendMessage(messageWithTab);
  } catch (error) {
    console.error("Failed to send message:", error);
    throw error;
  }
};

export const useConnection = (): UseConnectionReturn => {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<
    boolean | null
  >(null);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  // Track artificial states from storage
  const [artificialStates, setArtificialStates] = useState<
    Map<string, "loading" | "error">
  >(new Map());

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = stateSync.subscribe((state) => {
      // Only process updates for the current inspected tab
      const currentTabId = chrome.devtools.inspectedWindow.tabId;

      // If state has a tabId and it doesn't match current tab, ignore it
      // BUT if state has no tabId (initial/default state), process it
      if (state.tabId && state.tabId !== currentTabId) {
        return; // Ignore updates from other tabs
      }

      setTanStackQueryDetected(state.tanStackQueryDetected);
      setQueries(state.queries);
      setMutations(state.mutations);

      // Update artificial states from storage - extract only current tab's states
      if (state.artificialStates?.[currentTabId]) {
        const currentTabArtificialStates = state.artificialStates[currentTabId];
        const artificialStatesMap = new Map(
          Object.entries(currentTabArtificialStates),
        );
        setArtificialStates(artificialStatesMap);
      } else {
        setArtificialStates(new Map());
      }

      // Clear artificial states when TanStack Query state changes
      if (state.tanStackQueryDetected === false) {
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
