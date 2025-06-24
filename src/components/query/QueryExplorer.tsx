import { JsonViewer } from "../common/JsonViewer";
import type { QueryData } from "../../types/query";

interface QueryExplorerProps {
  selectedQuery: QueryData;
}

export function QueryExplorer({ selectedQuery }: QueryExplorerProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Query Explorer
      </h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        <JsonViewer data={selectedQuery} collapsed={1} readonly={true} />
      </div>
    </div>
  );
}
