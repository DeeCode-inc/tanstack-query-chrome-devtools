import { useState, useEffect } from "react";

interface UseDetailsAnimationOptions<T> {
  selectedItem: T | null;
  getItemKey: (item: T) => string;
}

export function useDetailsAnimation<T>({ selectedItem, getItemKey }: UseDetailsAnimationOptions<T>) {
  const [isEntering, setIsEntering] = useState(false);
  const [lastItemKey, setLastItemKey] = useState<string | null>(null);

  useEffect(() => {
    const currentItemKey = selectedItem ? getItemKey(selectedItem) : null;

    // Only trigger entrance animation when selection actually changes, not when data updates
    if (selectedItem && currentItemKey !== lastItemKey) {
      setIsEntering(true);
      setLastItemKey(currentItemKey);

      // Clear animation class after animation duration
      const timer = setTimeout(() => setIsEntering(false), 450); // Match details-enter animation duration
      return () => clearTimeout(timer);
    } else if (!selectedItem) {
      // Reset when no item is selected
      setLastItemKey(null);
      setIsEntering(false);
    }
  }, [selectedItem, lastItemKey, getItemKey]);

  return {
    isEntering,
    animationClass: isEntering ? "details-enter" : ""
  };
}
