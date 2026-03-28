import type { ActiveTab } from "@/types/ui";
import { ExtensionIcon } from "./ExtensionIcon";
import { TabToggle } from "./TabToggle";

interface HeaderProps {
  readonly activeTab: ActiveTab;
  readonly onTabChange: (tab: ActiveTab) => void;
  readonly queryCount: number;
  readonly mutationCount: number;
}

export function Header({ activeTab, onTabChange, queryCount, mutationCount }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <div className="shrink-0">
        <ExtensionIcon />
      </div>
      <TabToggle activeTab={activeTab} onTabChange={onTabChange} queryCount={queryCount} mutationCount={mutationCount} />
      <div className="flex-1 min-w-10" />
    </div>
  );
}
