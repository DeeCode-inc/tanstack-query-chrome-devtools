import { useState } from "react";
import type { ViewType } from "../types/query";

interface UseViewStateReturn {
  // State
  currentView: ViewType;
  searchTerm: string;
  selectedQueryIndex: number | null;
  selectedMutationIndex: number | null;

  // Actions
  setCurrentView: (view: ViewType) => void;
  setSearchTerm: (term: string) => void;
  setSelectedQueryIndex: (index: number | null) => void;
  setSelectedMutationIndex: (index: number | null) => void;
  handleViewChange: (view: ViewType) => void;
}

export const useViewState = (): UseViewStateReturn => {
  // View and selection state
  const [currentView, setCurrentView] = useState<ViewType>("queries");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueryIndex, setSelectedQueryIndex] = useState<number | null>(null);
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<number | null>(null);

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

    // Actions
    setCurrentView,
    setSearchTerm,
    setSelectedQueryIndex,
    setSelectedMutationIndex,
    handleViewChange,
  };
};
