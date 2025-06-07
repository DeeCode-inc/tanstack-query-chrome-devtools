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
        card-list-item card-list-item-animated card-selection-animated query-item-responsive
        flex items-center gap-3
        ${isSelected ? "card-selected" : ""}
      `}
    >
      {/* Status indicator */}
      <StatusBadge status={status} />

      {/* Mutation info - responsive sizing with container queries */}
      <div className="flex-1">
        <div className="font-mono query-key-responsive text-gray-700 dark:text-gray-300 truncate">
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
