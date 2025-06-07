import JsonView from "@microlink/react-json-view";
import type { MutationData } from "../../types/query";

interface MutationExplorerProps {
  selectedMutation: MutationData;
  isDarkMode: boolean;
}

export function MutationExplorer({ selectedMutation, isDarkMode }: MutationExplorerProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Mutation Explorer</h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        <JsonView
          src={{
            mutationId: selectedMutation.mutationId,
            mutationKey: selectedMutation.mutationKey || null,
            state: selectedMutation.state,
            isPending: selectedMutation.isPending,
            submittedAt: selectedMutation.submittedAt,
            variables: selectedMutation.variables || null,
            context: selectedMutation.context || null,
            data: selectedMutation.data || null,
            error: selectedMutation.error || null,
          }}
          collapsed={1}
          displayDataTypes={true}
          displayObjectSize={true}
          enableClipboard={true}
          theme={isDarkMode ? "monokai" : "rjv-default"}
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            backgroundColor: "transparent",
          }}
        />
      </div>
    </div>
  );
}
