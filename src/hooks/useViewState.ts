import { useState } from "react";
import type { ViewType } from "../types/query";
import { useKeyboardNavigation } from "./useKeyboardNavigation";

interface UseViewStateReturn {
  // State
  currentView: ViewType;
  searchTerm: string;
  selectedQueryIndex: number | null;
  selectedMutationIndex: number | null;

  // Keyboard navigation
  queryKeyboardNavigation: ReturnType<typeof useKeyboardNavigation>;
  mutationKeyboardNavigation: ReturnType<typeof useKeyboardNavigation>;

  // Actions
  setSearchTerm: (term: string) => void;
  setSelectedQueryIndex: (index: number | null) => void;
  setSelectedMutationIndex: (index: number | null) => void;
  handleViewChange: (view: ViewType) => void;
}

export const useViewState = (): UseViewStateReturn => {
  // View and selection state
  const [currentView, setCurrentView] = useState<ViewType>("queries");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueryIndex, setSelectedQueryIndex] = useState<number | null>(
    null,
  );
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<
    number | null
  >(null);

  // Keyboard navigation hooks for queries and mutations
  const queryKeyboardNavigation = useKeyboardNavigation({
    enabled: currentView === "queries",
    itemCount: 0, // Item count will be updated by the component with filtered data
    enableWrapAround: true,
    onActivate: (index: number) => {
      setSelectedQueryIndex(index);
    },
  });

  const mutationKeyboardNavigation = useKeyboardNavigation({
    enabled: currentView === "mutations",
    itemCount: 0, // Item count will be updated by the component with filtered data
    enableWrapAround: true,
    onActivate: (index: number) => {
      setSelectedMutationIndex(index);
    },
  });

  // Handle view changes with automatic selection clearing
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    if (view === "queries") {
      setSelectedMutationIndex(null);
    } else {
      setSelectedQueryIndex(null);
    }
  };

  return {
    // State
    currentView,
    searchTerm,
    selectedQueryIndex,
    selectedMutationIndex,

    // Keyboard navigation
    queryKeyboardNavigation,
    mutationKeyboardNavigation,

    // Actions
    setSearchTerm,
    setSelectedQueryIndex,
    setSelectedMutationIndex,
    handleViewChange,
  };
};
