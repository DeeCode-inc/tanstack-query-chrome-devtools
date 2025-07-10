import { useState, useCallback, useEffect, useRef } from "react";

interface UseKeyboardNavigationOptions {
  enabled?: boolean;
  itemCount: number;
  enableWrapAround?: boolean;
  onActivate?: (index: number) => void;
}

interface UseKeyboardNavigationReturn {
  focusedIndex: number | null;
  keyboardFocused: boolean;
  setFocusedIndex: (index: number | null) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  resetFocus: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  moveFocus: (direction: "up" | "down") => void;
  updateItemCount: (count: number) => void;
  getItemProps: (index: number) => {
    tabIndex: number;
    "data-focused": boolean;
    "data-keyboard-focused": boolean;
    onFocus: () => void;
    onMouseEnter: () => void;
    ref: (element: HTMLElement | null) => void;
  };
}

export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions,
): UseKeyboardNavigationReturn {
  const { enabled = true, enableWrapAround = true } = options;

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [currentItemCount, setCurrentItemCount] = useState(options.itemCount);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const isKeyboardNavigating = useRef(false);

  // Update item count method
  const updateItemCount = useCallback((count: number) => {
    setCurrentItemCount(count);
  }, []);

  // Reset focus when item count changes or component unmounts
  useEffect(() => {
    if (focusedIndex !== null && focusedIndex >= currentItemCount) {
      const newFocusIndex = Math.max(0, currentItemCount - 1);
      setFocusedIndex(currentItemCount > 0 ? newFocusIndex : null);
    }
  }, [currentItemCount, focusedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || currentItemCount === 0) return;

      const { key } = event;

      // Set keyboard navigation flag
      isKeyboardNavigating.current = true;
      setKeyboardFocused(true);

      switch (key) {
        case "ArrowDown": {
          event.preventDefault();
          const currentIndex = focusedIndex ?? -1;
          const nextIndex = currentIndex + 1;

          if (nextIndex < currentItemCount) {
            setFocusedIndex(nextIndex);
            // Focus the actual DOM element
            const element = itemRefs.current.get(nextIndex);
            element?.focus();
          } else if (enableWrapAround && currentItemCount > 0) {
            setFocusedIndex(0);
            const element = itemRefs.current.get(0);
            element?.focus();
          }
          break;
        }

        case "ArrowUp": {
          event.preventDefault();
          const currentIndex = focusedIndex ?? currentItemCount;
          const nextIndex = currentIndex - 1;

          if (nextIndex >= 0) {
            setFocusedIndex(nextIndex);
            // Focus the actual DOM element
            const element = itemRefs.current.get(nextIndex);
            element?.focus();
          } else if (enableWrapAround && currentItemCount > 0) {
            const lastIndex = currentItemCount - 1;
            setFocusedIndex(lastIndex);
            const element = itemRefs.current.get(lastIndex);
            element?.focus();
          }
          break;
        }

        case "Home": {
          event.preventDefault();
          if (currentItemCount > 0) {
            setFocusedIndex(0);
            const element = itemRefs.current.get(0);
            element?.focus();
          }
          break;
        }

        case "End": {
          event.preventDefault();
          if (currentItemCount > 0) {
            const lastIndex = currentItemCount - 1;
            setFocusedIndex(lastIndex);
            const element = itemRefs.current.get(lastIndex);
            element?.focus();
          }
          break;
        }

        case " ":
        case "Enter": {
          event.preventDefault();
          if (focusedIndex !== null && options.onActivate) {
            options.onActivate(focusedIndex);
          }
          break;
        }

        case "Tab": {
          // Allow normal tab behavior but reset keyboard navigation state
          setKeyboardFocused(false);
          isKeyboardNavigating.current = false;
          break;
        }

        default:
          // For other keys, don't interfere
          break;
      }
    },
    [enabled, currentItemCount, focusedIndex, enableWrapAround, options],
  );

  // Reset focus
  const resetFocus = useCallback(() => {
    setFocusedIndex(null);
    setKeyboardFocused(false);
    isKeyboardNavigating.current = false;
  }, []);

  // Focus first item
  const focusFirst = useCallback(() => {
    if (currentItemCount > 0) {
      setFocusedIndex(0);
      setKeyboardFocused(true);
      const element = itemRefs.current.get(0);
      element?.focus();
    }
  }, [currentItemCount]);

  // Focus last item
  const focusLast = useCallback(() => {
    if (currentItemCount > 0) {
      const lastIndex = currentItemCount - 1;
      setFocusedIndex(lastIndex);
      setKeyboardFocused(true);
      const element = itemRefs.current.get(lastIndex);
      element?.focus();
    }
  }, [currentItemCount]);

  // Move focus in direction
  const moveFocus = useCallback(
    (direction: "up" | "down") => {
      const currentIndex =
        focusedIndex ?? (direction === "down" ? -1 : currentItemCount);
      const nextIndex =
        direction === "down" ? currentIndex + 1 : currentIndex - 1;

      if (nextIndex >= 0 && nextIndex < currentItemCount) {
        setFocusedIndex(nextIndex);
        setKeyboardFocused(true);
        const element = itemRefs.current.get(nextIndex);
        element?.focus();
      }
    },
    [focusedIndex, currentItemCount],
  );

  // Get props for individual items
  const getItemProps = useCallback(
    (index: number) => {
      return {
        tabIndex: focusedIndex === index ? 0 : -1,
        "data-focused": focusedIndex === index,
        "data-keyboard-focused": keyboardFocused && focusedIndex === index,
        onFocus: () => {
          if (!isKeyboardNavigating.current) {
            setFocusedIndex(index);
            setKeyboardFocused(false);
          }
        },
        onMouseEnter: () => {
          if (!isKeyboardNavigating.current) {
            setKeyboardFocused(false);
          }
        },
        ref: (element: HTMLElement | null) => {
          if (element) {
            itemRefs.current.set(index, element);
          } else {
            itemRefs.current.delete(index);
          }
        },
      };
    },
    [focusedIndex, keyboardFocused],
  );

  return {
    focusedIndex,
    keyboardFocused,
    setFocusedIndex,
    handleKeyDown,
    resetFocus,
    focusFirst,
    focusLast,
    moveFocus,
    updateItemCount,
    getItemProps,
  };
}
