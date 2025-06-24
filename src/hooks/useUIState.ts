import { useCallback } from "react";

interface UseUIStateReturn {
  handleQueryAction: (
    action: string,
    queryHash: string,
    newValue?: unknown,
  ) => Promise<void>;
}

export const useUIState = (
  sendMessage: (message: unknown) => void,
): UseUIStateReturn => {
  // Handle query actions
  const handleQueryAction = useCallback(
    async (action: string, queryHash: string, newValue?: unknown) => {
      try {
        const message: Record<string, unknown> = {
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
