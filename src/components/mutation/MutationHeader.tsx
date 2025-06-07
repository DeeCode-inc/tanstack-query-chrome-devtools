import type { MutationData } from "../../types/query";
import { getMutationStatusDisplay } from "../../utils/status";

interface MutationHeaderProps {
  selectedMutation: MutationData;
}

export function MutationHeader({ selectedMutation }: MutationHeaderProps) {
  const status = getMutationStatusDisplay(selectedMutation);

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Mutation Details</h3>

      <div className="flex items-start justify-between gap-4 mb-3">
        {/* Mutation info */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mutation:</div>
          <div className="text-sm font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-gray-800 dark:text-gray-200">{selectedMutation.mutationKey || `Mutation #${selectedMutation.mutationId}`}</div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status:</div>
          <div className={`px-3 py-1 rounded text-white text-sm font-medium ${status.bgColor}`}>{status.text}</div>
        </div>
      </div>

      {/* Mutation metadata */}
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <div>Mutation ID: {selectedMutation.mutationId}</div>
        <div>Submitted: {new Date(selectedMutation.submittedAt).toLocaleString()}</div>
        <div>Pending: {selectedMutation.isPending ? "Yes" : "No"}</div>
      </div>
    </div>
  );
}
