import type { ActiveTab, SortDirection } from "@/types/ui";
import { Header } from "./Header";
import { SearchInput } from "./SearchInput";
import { SortDirectionButton } from "./SortDirectionButton";
import { SortTermDropdown } from "./SortTermDropdown";

interface ToolbarProps {
  readonly activeTab: ActiveTab;
  readonly onTabChange: (tab: ActiveTab) => void;
  readonly queryCount: number;
  readonly mutationCount: number;
  readonly filterTerm: string;
  readonly onFilterChange: (value: string) => void;
  readonly sortTerm: string;
  readonly sortOptions: readonly { value: string; label: string }[];
  readonly onSortTermChange: (value: string) => void;
  readonly sortDirection: SortDirection;
  readonly onSortDirectionToggle: () => void;
}

/** Tab header plus the filter / sort row above a query or mutation list. */
export function Toolbar({
  activeTab,
  onTabChange,
  queryCount,
  mutationCount,
  filterTerm,
  onFilterChange,
  sortTerm,
  sortOptions,
  onSortTermChange,
  sortDirection,
  onSortDirectionToggle,
}: ToolbarProps) {
  return (
    <>
      <Header
        activeTab={activeTab}
        onTabChange={onTabChange}
        queryCount={queryCount}
        mutationCount={mutationCount}
      />
      <div className="flex items-center gap-2 px-3 py-2">
        <SearchInput value={filterTerm} onChange={onFilterChange} />
        <SortTermDropdown
          value={sortTerm}
          options={sortOptions}
          onChange={onSortTermChange}
        />
        <SortDirectionButton
          direction={sortDirection}
          onToggle={onSortDirectionToggle}
        />
      </div>
    </>
  );
}
