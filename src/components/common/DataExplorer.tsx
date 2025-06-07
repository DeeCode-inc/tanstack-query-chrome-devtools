import JsonView from "@microlink/react-json-view";

interface DataExplorerProps {
  data?: unknown;
  error?: unknown;
  isDarkMode: boolean;
  title: string;
  emptyMessage?: string;
}

export function DataExplorer({ data, error, isDarkMode, title, emptyMessage = "No data available" }: DataExplorerProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">{title}</h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        {data !== undefined && data !== null ? (
          <JsonView
            src={data}
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
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 text-sm">
            <div className="font-medium mb-2">Error occurred:</div>
            <JsonView
              src={error}
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
          <div className="text-gray-500 dark:text-gray-400 text-sm italic">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}
