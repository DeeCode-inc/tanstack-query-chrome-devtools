import { useState, useEffect } from "react";
import { JsonViewer } from "./JsonViewer";

interface DataExplorerProps {
  data?: unknown;
  error?: unknown;
  title: string;
  emptyMessage?: string;
  onEdit?: (newData: unknown) => void;
  readonly?: boolean;
}

export function DataExplorer({
  data,
  error,
  title,
  emptyMessage = "No data available",
  onEdit,
  readonly,
}: DataExplorerProps) {
  const [isContentEntering, setIsContentEntering] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);

  useEffect(() => {
    // Only trigger content animation on initial data load, not on subsequent updates
    if ((data !== undefined || error !== undefined) && !hasDataLoaded) {
      setIsContentEntering(true);
      setHasDataLoaded(true);
      const timer = setTimeout(() => setIsContentEntering(false), 450); // Match content-enter animation duration
      return () => clearTimeout(timer);
    }
  }, [data, error, hasDataLoaded]);

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
        {title}
      </h4>
      <div
        className={`bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3 ${isContentEntering ? "content-enter" : ""}`}
      >
        {data !== undefined && data !== null ? (
          <JsonViewer
            data={data}
            collapsed={1}
            onEdit={onEdit}
            readonly={readonly}
          />
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 text-sm">
            <div className="font-medium mb-2">Error occurred:</div>
            <JsonViewer data={error} collapsed={1} />
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 text-sm italic">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
