import type { LayoutMode } from "../../types/query";

interface LayoutToggleProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
}

export function LayoutToggle({ layoutMode, onLayoutChange }: LayoutToggleProps) {
  return (
    <div className="toggle-group-base">
      <button
        className={layoutMode === "list" ? "toggle-option-active" : "toggle-option-inactive"}
        onClick={() => onLayoutChange("list")}
        aria-pressed={layoutMode === "list"}
      >
        List
      </button>
      <button
        className={layoutMode === "grid" ? "toggle-option-active" : "toggle-option-inactive"}
        onClick={() => onLayoutChange("grid")}
        aria-pressed={layoutMode === "grid"}
      >
        Grid
      </button>
    </div>
  );
}
