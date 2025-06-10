import { useState, useCallback, useRef } from 'react';
import type { MultiSelectionState } from '../types/query';

interface UseMultiSelectionOptions {
  maxItems?: number;
  allowRangeSelection?: boolean;
  allowMultiSelection?: boolean;
}

interface UseMultiSelectionReturn {
  selectionState: MultiSelectionState;
  isSelected: (index: number) => boolean;
  isMultiSelected: () => boolean;
  getSelectedCount: () => number;
  getSelectedIndices: () => number[];
  handleItemClick: (index: number, event?: React.MouseEvent) => void;
  selectAll: (maxIndex: number) => void;
  clearSelection: () => void;
  selectRange: (startIndex: number, endIndex: number) => void;
  toggleSelection: (index: number) => void;
}

export function useMultiSelection(options: UseMultiSelectionOptions = {}): UseMultiSelectionReturn {
  const {
    maxItems = 1000,
    allowRangeSelection = true,
    allowMultiSelection = true,
  } = options;

  const [selectionState, setSelectionState] = useState<MultiSelectionState>({
    selectedIndices: new Set<number>(),
    lastSelectedIndex: null,
    selectionMode: 'single',
  });

  // Track the original selected index for range selection
  const rangeStartRef = useRef<number | null>(null);

  // Check if an item is selected
  const isSelected = useCallback((index: number): boolean => {
    return selectionState.selectedIndices.has(index);
  }, [selectionState.selectedIndices]);

  // Check if multiple items are selected
  const isMultiSelected = useCallback((): boolean => {
    return selectionState.selectedIndices.size > 1;
  }, [selectionState.selectedIndices]);

  // Get count of selected items
  const getSelectedCount = useCallback((): number => {
    return selectionState.selectedIndices.size;
  }, [selectionState.selectedIndices]);

  // Get array of selected indices
  const getSelectedIndices = useCallback((): number[] => {
    return Array.from(selectionState.selectedIndices).sort((a, b) => a - b);
  }, [selectionState.selectedIndices]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedIndices: new Set<number>(),
      lastSelectedIndex: null,
      selectionMode: 'single',
    });
    rangeStartRef.current = null;
  }, []);

  // Select range of items
  const selectRange = useCallback((startIndex: number, endIndex: number) => {
    if (!allowRangeSelection) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    const newSelection = new Set<number>();

    for (let i = minIndex; i <= maxIndex && i < maxItems; i++) {
      newSelection.add(i);
    }

    setSelectionState({
      selectedIndices: newSelection,
      lastSelectedIndex: endIndex,
      selectionMode: 'range',
    });
  }, [allowRangeSelection, maxItems]);

  // Toggle selection of a single item
  const toggleSelection = useCallback((index: number) => {
    if (!allowMultiSelection) {
      // Single selection mode
      const newSelection = new Set<number>();
      if (!selectionState.selectedIndices.has(index)) {
        newSelection.add(index);
      }

      setSelectionState({
        selectedIndices: newSelection,
        lastSelectedIndex: newSelection.size > 0 ? index : null,
        selectionMode: 'single',
      });
      return;
    }

    // Multi-selection mode
    const newSelection = new Set(selectionState.selectedIndices);

    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }

    setSelectionState({
      selectedIndices: newSelection,
      lastSelectedIndex: newSelection.size > 0 ? index : null,
      selectionMode: newSelection.size > 1 ? 'multi' : 'single',
    });
  }, [allowMultiSelection, selectionState.selectedIndices]);

  // Select all items up to maxIndex
  const selectAll = useCallback((maxIndex: number) => {
    if (!allowMultiSelection) return;

    const newSelection = new Set<number>();
    for (let i = 0; i <= maxIndex && i < maxItems; i++) {
      newSelection.add(i);
    }

    setSelectionState({
      selectedIndices: newSelection,
      lastSelectedIndex: maxIndex,
      selectionMode: 'multi',
    });
  }, [allowMultiSelection, maxItems]);

  // Handle item click with modifier keys
  const handleItemClick = useCallback((index: number, event?: React.MouseEvent) => {
    // Prevent default behavior for modifier keys
    if (event) {
      event.preventDefault();
    }

    const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
    const isShift = event?.shiftKey;

    if (isShift && allowRangeSelection && selectionState.lastSelectedIndex !== null) {
      // Shift+Click: Range selection
      const startIndex = rangeStartRef.current ?? selectionState.lastSelectedIndex;
      selectRange(startIndex, index);
    } else if (isCtrlOrCmd && allowMultiSelection) {
      // Ctrl/Cmd+Click: Toggle selection
      toggleSelection(index);
      if (rangeStartRef.current === null && selectionState.selectedIndices.has(index)) {
        rangeStartRef.current = index;
      }
    } else {
      // Regular click: Single selection
      const newSelection = new Set<number>([index]);
      setSelectionState({
        selectedIndices: newSelection,
        lastSelectedIndex: index,
        selectionMode: 'single',
      });
      rangeStartRef.current = index;
    }
  }, [
    allowRangeSelection,
    allowMultiSelection,
    selectionState.lastSelectedIndex,
    selectionState.selectedIndices,
    selectRange,
    toggleSelection,
  ]);

  return {
    selectionState,
    isSelected,
    isMultiSelected,
    getSelectedCount,
    getSelectedIndices,
    handleItemClick,
    selectAll,
    clearSelection,
    selectRange,
    toggleSelection,
  };
}
