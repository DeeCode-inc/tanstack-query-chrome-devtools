import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useSyncConnection } from "@/hooks/useSyncConnection";

function App() {
  const { queries, mutations, connected, sendAction, sendSetData, sendDeleteData, sendRemoveAllQueries, sendClearArray, sendClearMutationCache } = useSyncConnection({ variant: "popup" });
  return <ConnectionStatus variant="popup" queries={queries} mutations={mutations} connected={connected} sendAction={sendAction} sendSetData={sendSetData} sendDeleteData={sendDeleteData} sendRemoveAllQueries={sendRemoveAllQueries} sendClearArray={sendClearArray} sendClearMutationCache={sendClearMutationCache} />;
}

export default App;
