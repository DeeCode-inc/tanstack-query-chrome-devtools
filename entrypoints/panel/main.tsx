import React from "react";
import ReactDOM from "react-dom/client";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useSyncConnection } from "@/hooks/useSyncConnection";

const tabId = browser.devtools.inspectedWindow.tabId;

function Panel() {
  const { queries, mutations, connected, sendAction, sendSetData, sendDeleteData, sendRemoveAllQueries, sendClearArray, sendClearMutationCache } = useSyncConnection({ tabId, variant: "panel" });
  return <ConnectionStatus variant="panel" queries={queries} mutations={mutations} connected={connected} sendAction={sendAction} sendSetData={sendSetData} sendDeleteData={sendDeleteData} sendRemoveAllQueries={sendRemoveAllQueries} sendClearArray={sendClearArray} sendClearMutationCache={sendClearMutationCache} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
);
