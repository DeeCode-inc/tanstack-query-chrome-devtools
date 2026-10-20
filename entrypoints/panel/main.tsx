import React from "react";
import ReactDOM from "react-dom/client";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DevtoolsActionsContext } from "@/hooks/useDevtoolsActions";
import { useSyncConnection } from "@/hooks/useSyncConnection";

const tabId = browser.devtools.inspectedWindow.tabId;

function Panel() {
  const { queries, mutations, status, actions } = useSyncConnection({
    tabId,
    variant: "panel",
  });
  return (
    <DevtoolsActionsContext value={actions}>
      <ConnectionStatus
        variant="panel"
        queries={queries}
        mutations={mutations}
        status={status}
      />
    </DevtoolsActionsContext>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Panel />
    </ErrorBoundary>
  </React.StrictMode>,
);
