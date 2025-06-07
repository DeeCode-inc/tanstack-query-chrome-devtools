import JsonView from "@microlink/react-json-view";

import type { MutationData } from "../../types/query";
import { getMutationStatusDisplay } from "../../utils/status";

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

  const status = getMutationStatusDisplay(selectedMutation);

  return (
    <div className="h-full overflow-y-auto">
      {/* Mutation Details Header */}
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

      {/* Variables Section */}
      {selectedMutation.variables !== undefined && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Variables</h4>
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
            <JsonView
              src={selectedMutation.variables ?? {}}
              collapsed={2}
              displayDataTypes={false}
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
      )}

      {/* Data Explorer Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Data Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          {selectedMutation.data !== undefined && selectedMutation.data !== null ? (
            <JsonView
              src={selectedMutation.data}
              collapsed={2}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              theme={isDarkMode ? "monokai" : "rjv-default"}
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                backgroundColor: "transparent",
              }}
            />
          ) : selectedMutation.error ? (
            <div className="text-red-600 dark:text-red-400 text-sm">
              <div className="font-medium mb-2">Error occurred:</div>
              <JsonView
                src={selectedMutation.error}
                collapsed={1}
                displayDataTypes={false}
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
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm italic">No data available</div>
          )}
        </div>
      </div>

      {/* Mutation Explorer Section */}
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
    </div>
  );
}
