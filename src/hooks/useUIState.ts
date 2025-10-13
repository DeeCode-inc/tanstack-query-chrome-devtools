import { useCallback, useMemo } from "react";
import type { QueryAction, QueryActionMessage } from "../types/messages";
import { tabScopedStorageManager } from "../storage/impl/tab-scoped-manager";

interface UseUIStateReturn {
  handleQueryAction: (
    action: QueryAction["type"],
    queryHash: string,
    newValue?: unknown,
  ) => Promise<void>;
}

export const useUIState = (
  sendMessage: (message: QueryActionMessage) => void,
  tabId: number,
): UseUIStateReturn => {
  // Get storage directly - no factory needed
  const storage = useMemo(
    () => tabScopedStorageManager.getStorageForTab(tabId),
    [tabId],
  );

  // Handle query actions
  const handleQueryAction = useCallback(
    async (
      action: QueryAction["type"],
      queryHash: string,
      newValue?: unknown,
    ) => {
      try {
        // Handle artificial states with direct storage access for immediate UI feedback
        if (action === "TRIGGER_LOADING") {
          const currentData = await storage.get();
          const currentState = currentData.artificialStates?.[queryHash];
          const newArtificialStates = { ...currentData.artificialStates };

          if (currentState === "loading") {
            // Remove artificial loading state
            delete newArtificialStates[queryHash];
          } else {
            // Add artificial loading state
            newArtificialStates[queryHash] = "loading";
          }

          await storage.updateArtificialStates(newArtificialStates);
        } else if (action === "CANCEL_LOADING") {
          // Remove artificial loading state
          const currentData = await storage.get();
          const newArtificialStates = { ...currentData.artificialStates };
          delete newArtificialStates[queryHash];
          await storage.updateArtificialStates(newArtificialStates);
        } else if (action === "TRIGGER_ERROR") {
          const currentData = await storage.get();
          const currentState = currentData.artificialStates?.[queryHash];
          const newArtificialStates = { ...currentData.artificialStates };

          if (currentState === "error") {
            // Remove artificial error state
            delete newArtificialStates[queryHash];
          } else {
            // Add artificial error state
            newArtificialStates[queryHash] = "error";
          }

          await storage.updateArtificialStates(newArtificialStates);
        } else if (action === "CANCEL_ERROR") {
          // Remove artificial error state
          const currentData = await storage.get();
          const newArtificialStates = { ...currentData.artificialStates };
          delete newArtificialStates[queryHash];
          await storage.updateArtificialStates(newArtificialStates);
        }

        // Still send message to injected script for actual TanStack Query manipulation
        const message: QueryActionMessage = {
          type: "QUERY_ACTION",
          action: action,
          queryHash: queryHash,
        };

        // Add newValue for SET_QUERY_DATA action
        if (action === "SET_QUERY_DATA" && newValue !== undefined) {
          message.newData = newValue;
        }

        sendMessage(message);
      } catch (error) {
        console.error("Failed to send action:", error);
      }
    },
    [sendMessage, storage],
  );

  return {
    handleQueryAction,
  };
};
