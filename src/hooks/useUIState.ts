import { useState, useEffect, useCallback } from "react";
import type { QueryKey } from "@tanstack/query-core";

interface UseUIStateReturn {
  // State
  isDarkMode: boolean;
  actionFeedback: { message: string; type: "success" | "error" } | null;

  // Actions
  handleQueryAction: (action: string, queryKey: QueryKey) => Promise<void>;
  setActionFeedback: (feedback: { message: string; type: "success" | "error" } | null) => void;
}

export const useUIState = (sendMessage: (message: unknown) => void): UseUIStateReturn => {
  // UI State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Handle query actions
  const handleQueryAction = useCallback(async (action: string, queryKey: QueryKey) => {
    try {
      sendMessage({
        type: "QUERY_ACTION",
        action: action,
        queryKey: queryKey,
      });
    } catch (error) {
      console.error("Failed to send action:", error);
      setActionFeedback({
        message: `Failed to send ${action.toLowerCase()} action`,
        type: "error",
      });
    }
  }, [sendMessage]);

  // Clear action feedback after delay
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

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
    // State
    isDarkMode,
    actionFeedback,

    // Actions
    handleQueryAction,
    setActionFeedback,
  };
};
