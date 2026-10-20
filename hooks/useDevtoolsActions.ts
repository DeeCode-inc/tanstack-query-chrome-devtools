import { createContext, useContext } from "react";
import type { DevtoolsActions } from "@/types/messages";

/**
 * Request senders for the current viewer (panel or popup). Provided at the
 * entrypoint so components can send requests without prop drilling.
 */
export const DevtoolsActionsContext = createContext<DevtoolsActions | null>(
  null,
);

export function useDevtoolsActions(): DevtoolsActions {
  const actions = useContext(DevtoolsActionsContext);
  if (actions === null) {
    throw new Error(
      "useDevtoolsActions must be used within DevtoolsActionsContext",
    );
  }
  return actions;
}
