import type { ActionType, PathSegment } from "@/types/messages";
import type { LayoutVariant, MutationEntry, QueryEntry } from "@/types/ui";
import { PageLayout } from "./PageLayout";
import { SetupMessage } from "./SetupMessage";

interface ConnectionStatusProps {
  variant: LayoutVariant;
  queries: readonly QueryEntry[];
  mutations: readonly MutationEntry[];
  connected: boolean;
  sendAction?: (action: ActionType, queryHash: string) => void;
  sendSetData?: (
    queryHash: string,
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
  sendDeleteData?: (queryHash: string, path: readonly PathSegment[]) => void;
  sendRemoveAllQueries?: () => void;
  sendClearArray?: (queryHash: string, path: readonly PathSegment[]) => void;
  sendClearMutationCache?: () => void;
}

export function ConnectionStatus({
  variant,
  queries,
  mutations,
  connected,
  sendAction,
  sendSetData,
  sendDeleteData,
  sendRemoveAllQueries,
  sendClearArray,
  sendClearMutationCache,
}: ConnectionStatusProps) {
  if (!connected) {
    return (
      <div className="h-full flex-1 flex items-center justify-center">
        <SetupMessage variant={variant} />
      </div>
    );
  }

  return (
    <PageLayout
      variant={variant}
      queries={queries}
      mutations={mutations}
      sendAction={sendAction}
      sendSetData={sendSetData}
      sendDeleteData={sendDeleteData}
      sendRemoveAllQueries={sendRemoveAllQueries}
      sendClearArray={sendClearArray}
      sendClearMutationCache={sendClearMutationCache}
    />
  );
}
