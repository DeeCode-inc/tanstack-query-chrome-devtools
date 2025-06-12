import { useState, useEffect, useCallback } from "react";

interface UseUIStateReturn {
  isDarkMode: boolean;

  handleQueryAction: (action: string, queryHash: string, newValue?: unknown) => Promise<void>;
}

export const useUIState = (sendMessage: (message: unknown) => void): UseUIStateReturn => {
  // UI State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

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
    [sendMessage]
  );

  // Detect system dark mode preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Set initial state
    setIsDarkMode(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return {
    isDarkMode,
    handleQueryAction,
  };
};
