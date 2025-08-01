import { useCallback } from "react";
import type { QueryAction, QueryActionMessage } from "../types/messages";

interface UseUIStateReturn {
  handleQueryAction: (
    action: QueryAction["type"],
    queryHash: string,
    newValue?: unknown,
  ) => Promise<void>;
}

export const useUIState = (
  sendMessage: (message: QueryActionMessage) => void,
): UseUIStateReturn => {
  // Handle query actions
  const handleQueryAction = useCallback(
    async (
      action: QueryAction["type"],
      queryHash: string,
      newValue?: unknown,
    ) => {
      try {
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
    [sendMessage],
  );

  return {
    handleQueryAction,
  };
};
