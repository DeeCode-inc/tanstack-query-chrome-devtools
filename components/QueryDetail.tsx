import { ArrowLeft } from "lucide-react";
import type { ActiveTab, QueryEntry } from "@/types/ui";
import type { ActionType, PathSegment } from "@/types/messages";
import { formatAbsoluteTime } from "@/utils/format";
import { STATUS_THEMES } from "@/utils/status-theme";
import { stringifyWithBigInt } from "@/utils/serialization";
import { ActionButtons } from "./ActionButtons";
import { TreeView } from "./TreeView";
import { RelativeTime } from "./RelativeTime";

interface QueryDetailProps {
  readonly query: QueryEntry | null;
  readonly onBack?: () => void;
  readonly activeTab: ActiveTab;
  readonly sendAction?: (action: ActionType, queryHash: string) => void;
  readonly sendSetData?: (queryHash: string, path: readonly PathSegment[], value: string | number | boolean) => void;
  readonly sendDeleteData?: (queryHash: string, path: readonly PathSegment[]) => void;
  readonly sendClearArray?: (queryHash: string, path: readonly PathSegment[]) => void;
  readonly onClearSelection?: () => void;
}

export function QueryDetail({ query, onBack, activeTab, sendAction, sendSetData, sendDeleteData, sendClearArray, onClearSelection }: QueryDetailProps) {
  if (!query) {
    return <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400">Select a query to view details</div>;
  }

  const queryExplorerData = {
    isActive: query.isActive,
    meta: query.meta,
    observersCount: query.observerCount,
    queryHash: query.queryHash,
    queryKey: query.queryKey,
    state: query.state,
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {onBack && (
        <button type="button" onClick={onBack} className="sticky top-0 bg-white z-11 dark:bg-gray-900 flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      <h2 className="sticky bg-white dark:bg-gray-900 px-4 pt-3 pb-1 top-0 z-10 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{activeTab === "queries" ? "Query Details" : "Mutation Details"}</h2>

      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-1">
        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{activeTab === "queries" ? "Query key:" : "Mutation key:"}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${STATUS_THEMES[query.status].bg} ${STATUS_THEMES[query.status].text} ${STATUS_THEMES[query.status].border}`}>{query.status}</span>
          </div>
          <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all font-mono">{stringifyWithBigInt(query.queryKey, 2)}</pre>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Observers: {query.observerCount}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1" title={formatAbsoluteTime(query.dataUpdatedAt)}>
          Last updated: <RelativeTime timestamp={query.dataUpdatedAt} />
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Actions</h3>
          {sendAction && <ActionButtons queryHash={query.queryHash} queryState={query.state} isActive={query.isActive} isDisabled={query.isDisabled} observerCount={query.observerCount} sendAction={sendAction} onClearSelection={onClearSelection} />}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Data Explorer</h3>
          <div className="text-sm">
            <TreeView data={query.data} editable={!!sendSetData} onFieldChange={sendSetData ? (path, value) => sendSetData(query.queryHash, path, value) : undefined} onFieldDelete={sendDeleteData ? (path) => sendDeleteData(query.queryHash, path) : undefined} onArrayClear={sendClearArray ? (path) => sendClearArray(query.queryHash, path) : undefined} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Query Explorer</h3>
          <div className="text-sm">
            <TreeView data={queryExplorerData} />
          </div>
        </section>
      </div>
    </div>
  );
}
