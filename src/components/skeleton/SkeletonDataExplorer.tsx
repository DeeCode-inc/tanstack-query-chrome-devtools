interface SkeletonDataExplorerProps {
  isDarkMode: boolean;
  title: string;
}

export function SkeletonDataExplorer({ isDarkMode, title }: SkeletonDataExplorerProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">{title}</h4>
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
        {/* Loading message with dots animation */}
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          <span className="loading-dots">Loading data</span>
        </div>

        {/* Skeleton JSON structure */}
        <div className="mt-3 space-y-2">
          <div
            className={`
              skeleton-json
              ${isDarkMode ? "skeleton-base-dark" : "skeleton-base"}
            `}
          />
        </div>
      </div>
    </div>
  );
}

export default SkeletonDataExplorer;
