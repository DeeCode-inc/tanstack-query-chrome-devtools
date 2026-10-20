import type { ReactNode } from "react";
import type {
  LayoutVariant,
  MutationEntry,
  QueryEntry,
  SyncStatus,
} from "@/types/ui";
import { PageLayout } from "./PageLayout";
import { SetupMessage } from "./SetupMessage";
import { SyncStatusMessage } from "./SyncStatusMessage";

interface ConnectionStatusProps {
  variant: LayoutVariant;
  queries: readonly QueryEntry[];
  mutations: readonly MutationEntry[];
  status: SyncStatus;
}

function Centered({ children }: { readonly children: ReactNode }) {
  return (
    <div className="h-full flex-1 flex items-center justify-center p-2">
      {children}
    </div>
  );
}

export function ConnectionStatus({
  variant,
  queries,
  mutations,
  status,
}: ConnectionStatusProps) {
  switch (status.kind) {
    case "connected":
      return (
        <PageLayout variant={variant} queries={queries} mutations={mutations} />
      );
    case "loading":
      return (
        <Centered>
          <SyncStatusMessage
            title="Loading the query cache…"
            detail={`Received ${String(status.received)} of ${String(status.total)} parts.`}
          />
        </Centered>
      );
    case "failed":
      return (
        <Centered>
          <SyncStatusMessage
            alert
            title="Could not load the query cache"
            detail="The page's cache did not reach the DevTools in one piece, so none of it is shown. The reason is logged in the console; reopening the DevTools tries again."
          />
        </Centered>
      );
    case "disconnected":
      return (
        <div className="h-full flex-1 flex items-center justify-center">
          <SetupMessage variant={variant} />
        </div>
      );
  }
}
