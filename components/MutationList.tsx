import { Trash2 } from "lucide-react";
import type { MutationEntry } from "@/types/ui";
import { MUTATION_STATUS_DEFINITIONS } from "@/utils/status-theme";
import { MutationListItem } from "./MutationListItem";
import { StatusSummary } from "./StatusSummary";

interface MutationListProps {
  readonly mutations: readonly MutationEntry[];
  readonly selectedMutationId: number | null;
  readonly onSelectMutation: (mutationId: number) => void;
  readonly onRemoveAllMutations?: () => void;
}

export function MutationList({ mutations, selectedMutationId, onSelectMutation, onRemoveAllMutations }: MutationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="@container flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 justify-between w-full">
          <StatusSummary items={mutations} getStatus={(m) => m.status} statusDefinitions={MUTATION_STATUS_DEFINITIONS} />
          {onRemoveAllMutations && (
            <button
              type="button"
              title="Remove all mutations"
              className={`shrink-0 cursor-pointer text-gray-400 hover:text-red-500 ${mutations.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={mutations.length === 0}
              onClick={onRemoveAllMutations}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {mutations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No mutations</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {mutations.map((mutation, index) => (
            <MutationListItem
              key={String(mutation.mutationId)}
              mutation={mutation}
              index={index + 1}
              isSelected={mutation.mutationId === selectedMutationId}
              onSelect={() => onSelectMutation(mutation.mutationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
