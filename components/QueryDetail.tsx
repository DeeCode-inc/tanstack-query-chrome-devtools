import { useDevtoolsActions } from "@/hooks/useDevtoolsActions";
import type { QueryEntry } from "@/types/ui";
import { formatAbsoluteTime } from "@/utils/format";
import { stringifyWithBigInt } from "@/utils/serialization";
import { STATUS_THEMES } from "@/utils/status-theme";
import { ActionButtons } from "./ActionButtons";
import { DetailHeader } from "./DetailHeader";
import { RelativeTime } from "./RelativeTime";
import { TreeView } from "./TreeView";

interface QueryDetailProps {
  readonly query: QueryEntry | null;
  readonly onBack?: () => void;
  readonly onClearSelection?: () => void;
}

export function QueryDetail({
  query,
  onBack,
  onClearSelection,
}: QueryDetailProps) {
  const { sendAction, sendSetData, sendDeleteData, sendClearArray } =
    useDevtoolsActions();

  if (!query) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400">
        Select a query to view details
      </div>
    );
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
      <DetailHeader
        title="Query Details"
        keyLabel="Query key:"
        keyText={stringifyWithBigInt(query.queryKey, 2)}
        status={query.status}
        theme={STATUS_THEMES[query.status]}
        onBack={onBack}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Observers: {query.observerCount}
        </p>
        <p
          className="text-xs text-gray-500 dark:text-gray-400 mt-1"
          title={formatAbsoluteTime(query.dataUpdatedAt)}
        >
          Last updated: <RelativeTime timestamp={query.dataUpdatedAt} />
        </p>
      </DetailHeader>

      <div className="px-4 py-3 space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Actions
          </h3>
          <ActionButtons
            queryHash={query.queryHash}
            queryState={query.state}
            isActive={query.isActive}
            isDisabled={query.isDisabled}
            observerCount={query.observerCount}
            sendAction={sendAction}
            onClearSelection={onClearSelection}
          />
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Data Explorer
          </h3>
          <div className="text-sm">
            <TreeView
              data={query.state.data}
              editable
              onFieldChange={(path, value) =>
                sendSetData(query.queryHash, path, value)
              }
              onFieldDelete={(path) => sendDeleteData(query.queryHash, path)}
              onArrayClear={(path) => sendClearArray(query.queryHash, path)}
            />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Query Explorer
          </h3>
          <div className="text-sm">
            <TreeView data={queryExplorerData} />
          </div>
        </section>
      </div>
    </div>
  );
}
