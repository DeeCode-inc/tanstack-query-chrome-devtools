import { useState, useEffect, useCallback } from "react";
import type { StatusDisplay } from "../types/query";

interface UseStatusTransitionOptions {
  currentStatus: StatusDisplay;
  transitionDuration?: number;
}

interface StatusTransitionReturn {
  isTransitioning: boolean;
  transitionClass: string;
  containerClass: string;
  handleTransitionEnd: () => void;
}

export function useStatusTransition({
  currentStatus,
  transitionDuration = 500,
}: UseStatusTransitionOptions): StatusTransitionReturn {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState("");
  const [containerClass, setContainerClass] = useState("");
  const [lastStatusText, setLastStatusText] = useState<string | null>(null);

  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false);
    setTransitionClass("");
    setContainerClass("");
  }, []);

  useEffect(() => {
    const currentStatusText = currentStatus.text;

    // Only trigger animation when status actually changes
    if (currentStatusText !== lastStatusText && lastStatusText !== null) {
      setIsTransitioning(true);
      setContainerClass("query-item-status-change");

      // Determine appropriate transition animation based on status change
      let animationClass = "";

      switch (currentStatusText) {
        case "Fetching":
          animationClass = "status-to-fetching";
          break;
        case "Fresh":
          animationClass = "status-to-success";
          break;
        case "Stale":
          animationClass = "status-fade-gentle";
          break;
        case "Error":
          animationClass = "status-attention";
          break;
        case "Pending":
          animationClass = "status-to-pending";
          break;
        default:
          animationClass = "status-transition";
      }

      setTransitionClass(animationClass);

      // Special handling for specific transitions
      if (lastStatusText === "Fresh" && currentStatusText === "Stale") {
        // Fresh → Stale: Gentle fade transition
        setTransitionClass("status-fade-gentle");
      } else if (currentStatusText === "Error") {
        // Any → Error: Attention-grabbing animation
        setTransitionClass("status-attention");
      }

      // Auto-clear transition after duration
      const timer = setTimeout(handleTransitionEnd, transitionDuration);
      return () => clearTimeout(timer);
    }

    setLastStatusText(currentStatusText);
  }, [
    currentStatus.text,
    lastStatusText,
    transitionDuration,
    handleTransitionEnd,
  ]);

  return {
    isTransitioning,
    transitionClass,
    containerClass,
    handleTransitionEnd,
  };
}
