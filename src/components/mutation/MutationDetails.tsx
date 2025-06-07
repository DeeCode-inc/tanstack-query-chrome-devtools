import type { MutationData } from "../../types/query";
import { MutationHeader } from "./MutationHeader";
import { MutationVariables } from "./MutationVariables";
import { MutationExplorer } from "./MutationExplorer";
import { DataExplorer } from "../common/DataExplorer";

interface MutationDetailsProps {
  selectedMutation: MutationData | null;
  isDarkMode: boolean;
}

export function MutationDetails({ selectedMutation, isDarkMode }: MutationDetailsProps) {
  if (!selectedMutation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">👈</div>
          <p>Select a mutation from the list to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <MutationHeader selectedMutation={selectedMutation} />

      <MutationVariables variables={selectedMutation.variables} isDarkMode={isDarkMode} />

      <DataExplorer
        data={selectedMutation.data}
        error={selectedMutation.error}
        isDarkMode={isDarkMode}
        title="Data Explorer"
        emptyMessage="No data available"
      />

      <MutationExplorer selectedMutation={selectedMutation} isDarkMode={isDarkMode} />
    </div>
  );
}
