import { JsonViewer } from "../common/JsonViewer";
import type { MutationData } from "../../types/query";

interface MutationExplorerProps {
  selectedMutation: MutationData;
}

export function MutationExplorer({ selectedMutation }: MutationExplorerProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Mutation Explorer
      </h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        <JsonViewer data={selectedMutation} collapsed={1} readonly={true} />
      </div>
    </div>
  );
}
