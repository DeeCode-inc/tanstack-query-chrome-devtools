import { ArrowUp, ArrowDown } from "lucide-react";
import type { SortDirection } from "@/types/ui";

interface SortDirectionButtonProps {
  readonly direction: SortDirection;
  readonly onToggle: () => void;
}

export function SortDirectionButton({ direction, onToggle }: SortDirectionButtonProps) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  const label = direction === "asc" ? "Asc" : "Desc";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-[70px] shrink-0 flex items-center justify-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
