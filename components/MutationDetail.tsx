import { ArrowLeft } from "lucide-react";
import type { MutationEntry } from "@/types/ui";
import { formatAbsoluteTime } from "@/utils/format";
import { STATUS_THEMES } from "@/utils/status-theme";
import { stringifyWithBigInt } from "@/utils/serialization";
import { TreeView } from "./TreeView";
import { RelativeTime } from "./RelativeTime";
import type { StatusTheme } from "@/utils/status-theme";
import type { MutationStatus } from "@/types/ui";

const MUTATION_THEME: Record<MutationStatus, StatusTheme> = {
  idle: STATUS_THEMES.paused,
  pending: STATUS_THEMES.stale,
  success: STATUS_THEMES.fresh,
  error: STATUS_THEMES.error,
};

interface MutationDetailProps {
  readonly mutation: MutationEntry | null;
  readonly onBack?: () => void;
}

export function MutationDetail({ mutation, onBack }: MutationDetailProps) {
  if (!mutation) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400">
        Select a mutation to view details
      </div>
    );
  }

  const theme = MUTATION_THEME[mutation.status];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="sticky top-0 bg-white z-11 dark:bg-gray-900 flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      <h2 className="sticky bg-white dark:bg-gray-900 px-4 pt-3 pb-1 top-0 z-10 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Mutation Details
      </h2>

      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-1">
        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mutation key:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${theme.bg} ${theme.text} ${theme.border}`}>
              {mutation.status}
            </span>
          </div>
          <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all font-mono">
            {mutation.mutationKey ? stringifyWithBigInt(mutation.mutationKey, 2) : "No mutation key"}
          </pre>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" title={formatAbsoluteTime(mutation.timestamp)}>
          Submitted: <RelativeTime timestamp={mutation.timestamp} />
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Variables</h3>
          <div className="text-sm">
            <TreeView data={mutation.variables} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Context</h3>
          <div className="text-sm">
            <TreeView data={mutation.context} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Data Explorer</h3>
          <div className="text-sm">
            <TreeView data={mutation.data} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Mutation Explorer</h3>
          <div className="text-sm">
            <TreeView data={mutation.state} />
          </div>
        </section>
      </div>
    </div>
  );
}
