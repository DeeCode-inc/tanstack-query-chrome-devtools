import { useState } from "react";
import type { ViewType, LayoutMode } from "../types/query";
import { useMultiSelection } from "./useMultiSelection";
import { useKeyboardNavigation } from "./useKeyboardNavigation";

interface UseViewStateReturn {
  // State
  currentView: ViewType;
  layoutMode: LayoutMode;
  searchTerm: string;
  selectedQueryIndex: number | null;
  selectedMutationIndex: number | null;

  // Multi-selection
  queryMultiSelection: ReturnType<typeof useMultiSelection>;
  mutationMultiSelection: ReturnType<typeof useMultiSelection>;

  // Keyboard navigation
  queryKeyboardNavigation: ReturnType<typeof useKeyboardNavigation>;
  mutationKeyboardNavigation: ReturnType<typeof useKeyboardNavigation>;

  // Actions
  setCurrentView: (view: ViewType) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSearchTerm: (term: string) => void;
  setSelectedQueryIndex: (index: number | null) => void;
  setSelectedMutationIndex: (index: number | null) => void;
  handleViewChange: (view: ViewType) => void;
  handleLayoutChange: (mode: LayoutMode) => void;
}

export const useViewState = (): UseViewStateReturn => {
  // View and selection state
  const [currentView, setCurrentView] = useState<ViewType>("queries");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueryIndex, setSelectedQueryIndex] = useState<number | null>(null);
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<number | null>(null);

  // Multi-selection hooks for queries and mutations
  const queryMultiSelection = useMultiSelection({
    allowMultiSelection: true,
    allowRangeSelection: true,
    maxItems: 1000,
  });

  const mutationMultiSelection = useMultiSelection({
    allowMultiSelection: true,
    allowRangeSelection: true,
    maxItems: 1000,
  });

  // Keyboard navigation hooks for queries and mutations
  const queryKeyboardNavigation = useKeyboardNavigation({
    enabled: currentView === "queries",
    itemCount: 0, // Item count will be updated by the component with filtered data
    onItemSelect: setSelectedQueryIndex,
    onItemActivate: setSelectedQueryIndex,
    multiSelectionHook: queryMultiSelection,
    enableWrapAround: true,
  });

  const mutationKeyboardNavigation = useKeyboardNavigation({
    enabled: currentView === "mutations",
    itemCount: 0, // Item count will be updated by the component with filtered data
    onItemSelect: setSelectedMutationIndex,
    onItemActivate: setSelectedMutationIndex,
    multiSelectionHook: mutationMultiSelection,
    enableWrapAround: true,
  });

  // Handle view changes with automatic selection clearing
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    if (view === "queries") {
      setSelectedMutationIndex(null);
      mutationMultiSelection.clearSelection();
    } else {
      setSelectedQueryIndex(null);
      queryMultiSelection.clearSelection();
    }
  };

  // Handle layout changes
  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
  };

  return {
    // State
    currentView,
    layoutMode,
    searchTerm,
    selectedQueryIndex,
    selectedMutationIndex,

    // Multi-selection
    queryMultiSelection,
    mutationMultiSelection,

    // Keyboard navigation
    queryKeyboardNavigation,
    mutationKeyboardNavigation,

    // Actions
    setCurrentView,
    setLayoutMode,
    setSearchTerm,
    setSelectedQueryIndex,
    setSelectedMutationIndex,
    handleViewChange,
    handleLayoutChange,
  };
};
