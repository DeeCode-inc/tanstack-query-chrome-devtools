import { ConnectionStatus } from "@/components/ConnectionStatus";
import { DevtoolsActionsContext } from "@/hooks/useDevtoolsActions";
import { useSyncConnection } from "@/hooks/useSyncConnection";

function App() {
  const { queries, mutations, connected, actions } = useSyncConnection({
    variant: "popup",
  });
  return (
    <DevtoolsActionsContext value={actions}>
      <ConnectionStatus
        variant="popup"
        queries={queries}
        mutations={mutations}
        connected={connected}
      />
    </DevtoolsActionsContext>
  );
}

export default App;
