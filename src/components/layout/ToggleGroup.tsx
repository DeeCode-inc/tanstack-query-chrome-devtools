import type { ViewType } from "../../types/query";

interface ToggleOption {
  value: ViewType;
  label: string;
  count: number;
}

interface ToggleGroupProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  options: ToggleOption[];
  className?: string;
}

export function ToggleGroup({ currentView, onViewChange, options, className = "" }: ToggleGroupProps) {
  return (
    <div className={`toggle-group-base ${className}`}>
      {options.map((option) => (
        <button key={option.value} onClick={() => onViewChange(option.value)} className={currentView === option.value ? "toggle-option-active" : "toggle-option-inactive"}>
          {option.label} ({option.count})
        </button>
      ))}
    </div>
  );
}
