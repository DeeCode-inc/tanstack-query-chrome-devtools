import type { MutationEntry } from "@/types/ui";
import { MUTATION_STATUS_DEFINITIONS } from "@/utils/status-theme";
import { EntityList } from "./EntityList";
import { MutationListItem } from "./MutationListItem";

interface MutationListProps {
  readonly mutations: readonly MutationEntry[];
  readonly selectedMutationId: number | null;
  readonly onSelectMutation: (mutationId: number) => void;
  readonly onRemoveAllMutations?: () => void;
}

function getMutationId(mutation: MutationEntry): number {
  return mutation.mutationId;
}

function getMutationStatus(mutation: MutationEntry): string {
  return mutation.status;
}

export function MutationList({
  mutations,
  selectedMutationId,
  onSelectMutation,
  onRemoveAllMutations,
}: MutationListProps) {
  return (
    <EntityList
      items={mutations}
      getId={getMutationId}
      getStatus={getMutationStatus}
      statusDefinitions={MUTATION_STATUS_DEFINITIONS}
      selectedId={selectedMutationId}
      onSelect={onSelectMutation}
      onRemoveAll={onRemoveAllMutations}
      removeAllTitle="Remove all mutations"
      emptyLabel="No mutations"
      renderItem={(mutation, isSelected, onSelect) => (
        <MutationListItem
          mutation={mutation}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      )}
    />
  );
}
