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
    <div className={`flex items-center gap-1 mb-4 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onViewChange(option.value)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentView === option.value
              ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          {option.label} ({option.count})
        </button>
      ))}
    </div>
  );
}

export default ToggleGroup;
