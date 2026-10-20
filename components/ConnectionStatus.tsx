import type { LayoutVariant, MutationEntry, QueryEntry } from "@/types/ui";
import { PageLayout } from "./PageLayout";
import { SetupMessage } from "./SetupMessage";

interface ConnectionStatusProps {
  variant: LayoutVariant;
  queries: readonly QueryEntry[];
  mutations: readonly MutationEntry[];
  connected: boolean;
}

export function ConnectionStatus({
  variant,
  queries,
  mutations,
  connected,
}: ConnectionStatusProps) {
  if (!connected) {
    return (
      <div className="h-full flex-1 flex items-center justify-center">
        <SetupMessage variant={variant} />
      </div>
    );
  }

  return (
    <PageLayout variant={variant} queries={queries} mutations={mutations} />
  );
}
