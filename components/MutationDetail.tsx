import type { MutationEntry, MutationStatus } from "@/types/ui";
import { formatAbsoluteTime } from "@/utils/format";
import { stringifyWithBigInt } from "@/utils/serialization";
import type { StatusTheme } from "@/utils/status-theme";
import { STATUS_THEMES } from "@/utils/status-theme";
import { DetailHeader } from "./DetailHeader";
import { RelativeTime } from "./RelativeTime";
import { TreeView } from "./TreeView";

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
      <DetailHeader
        title="Mutation Details"
        keyLabel="Mutation key:"
        keyText={
          mutation.mutationKey
            ? stringifyWithBigInt(mutation.mutationKey, 2)
            : "No mutation key"
        }
        status={mutation.status}
        theme={theme}
        onBack={onBack}
      >
        <p
          className="text-xs text-gray-500 dark:text-gray-400 mt-2"
          title={formatAbsoluteTime(mutation.timestamp)}
        >
          Submitted: <RelativeTime timestamp={mutation.timestamp} />
        </p>
      </DetailHeader>

      <div className="px-4 py-3 space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Variables
          </h3>
          <div className="text-sm">
            <TreeView data={mutation.state.variables} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Context
          </h3>
          <div className="text-sm">
            <TreeView data={mutation.state.context} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Data Explorer
          </h3>
          <div className="text-sm">
            <TreeView data={mutation.state.data} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Mutation Explorer
          </h3>
          <div className="text-sm">
            <TreeView data={mutation.state} />
          </div>
        </section>
      </div>
    </div>
  );
}
