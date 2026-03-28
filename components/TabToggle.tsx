import type { ActiveTab } from "@/types/ui";

interface TabToggleProps {
  readonly activeTab: ActiveTab;
  readonly onTabChange: (tab: ActiveTab) => void;
  readonly queryCount: number;
  readonly mutationCount: number;
}

export function TabToggle({ activeTab, onTabChange, queryCount, mutationCount }: TabToggleProps) {
  return (
    <div className="flex gap-1">
      <button
        className={
          activeTab === "queries"
            ? "px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium text-sm"
            : "px-3 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
        }
        onClick={() => onTabChange("queries")}
      >
        Queries ({queryCount})
      </button>
      <button
        className={
          activeTab === "mutations"
            ? "px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium text-sm"
            : "px-3 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
        }
        onClick={() => onTabChange("mutations")}
      >
        Mutations ({mutationCount})
      </button>
    </div>
  );
}
