import { JsonViewer } from "../common/JsonViewer";

interface MutationVariablesProps {
  variables?: unknown;
}

export function MutationVariables({ variables }: MutationVariablesProps) {
  if (variables === undefined) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Variables
      </h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        <JsonViewer data={variables ?? {}} collapsed={2} readonly={true} />
      </div>
    </div>
  );
}
