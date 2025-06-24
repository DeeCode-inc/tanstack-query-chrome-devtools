import { useDetailsAnimation } from "../../hooks/useDetailsAnimation";
import type { MutationData } from "../../types/query";
import { DataExplorer } from "../common/DataExplorer";
import { MutationExplorer } from "./MutationExplorer";
import { MutationHeader } from "./MutationHeader";
import { MutationVariables } from "./MutationVariables";

interface MutationDetailsProps {
  selectedMutation: MutationData | null;
}

export function MutationDetails({ selectedMutation }: MutationDetailsProps) {
  const { animationClass } = useDetailsAnimation({
    selectedItem: selectedMutation,
    getItemKey: (mutation: MutationData) => mutation.mutationId.toString(),
  });

  if (!selectedMutation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center enter-animation-scale">
          <p>Select a mutation from the list to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto ${animationClass}`}>
      <MutationHeader selectedMutation={selectedMutation} />

      <MutationVariables variables={selectedMutation.variables} />

      <DataExplorer
        data={selectedMutation.data}
        error={selectedMutation.error}
        title="Data Explorer"
        emptyMessage="No data available"
        readonly={true}
      />

      <MutationExplorer selectedMutation={selectedMutation} />
    </div>
  );
}
