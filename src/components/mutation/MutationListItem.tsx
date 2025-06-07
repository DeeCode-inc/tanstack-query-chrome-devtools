import { StatusBadge } from "../status/StatusBadge";
import { getMutationStatusDisplay } from "../../utils/status";
import type { MutationData } from "../../types/query";

interface MutationListItemProps {
  mutation: MutationData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

export function MutationListItem({ mutation, index, isSelected, onSelect }: MutationListItemProps) {
  const status = getMutationStatusDisplay(mutation);

  return (
    <div
      onClick={() => onSelect(index)}
      className={`
        p-3 flex items-center gap-3 cursor-pointer border-b border-gray-200 dark:border-gray-600
        transition-colors duration-200 ease-in-out
        ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500" : "hover:bg-gray-50 dark:hover:bg-gray-700"}
      `}
    >
      {/* Status indicator */}
      <StatusBadge status={status} />

      {/* Mutation info - single line with truncation */}
      <div className="flex-1">
        <div className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
          {mutation.mutationKey || `Mutation #${mutation.mutationId}`}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {new Date(mutation.submittedAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export default MutationListItem;
