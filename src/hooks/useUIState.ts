import { useCallback, useMemo } from "react";
import type { QueryAction, QueryActionMessage } from "../types/messages";
import { createArtificialStateManager } from "../utils/artificialStateManager";

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
  // Create centralized artificial state manager
  const stateManager = useMemo(
    () => createArtificialStateManager(tabId),
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
        // Handle artificial states using centralized manager for immediate UI feedback
        if (action === "TRIGGER_LOADING") {
          const currentState = stateManager.getState(queryHash);
          if (currentState === "loading") {
            // Remove artificial loading state
            await stateManager.clearState(queryHash);
          } else {
            // Add artificial loading state
            await stateManager.updateState(queryHash, "loading");
          }
        } else if (action === "CANCEL_LOADING") {
          // Remove artificial loading state
          await stateManager.clearState(queryHash);
        } else if (action === "TRIGGER_ERROR") {
          const currentState = stateManager.getState(queryHash);
          if (currentState === "error") {
            // Remove artificial error state
            await stateManager.clearState(queryHash);
          } else {
            // Add artificial error state
            await stateManager.updateState(queryHash, "error");
          }
        } else if (action === "CANCEL_ERROR") {
          // Remove artificial error state
          await stateManager.clearState(queryHash);
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
    [sendMessage, stateManager],
  );

  return {
    handleQueryAction,
  };
};
