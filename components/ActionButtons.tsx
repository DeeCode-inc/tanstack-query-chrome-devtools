import type { ActionType } from "@/types/messages";
import type { QueryState } from "@/types/ui";

interface ActionButtonConfig {
  readonly label: string;
  readonly textColor: string;
  readonly action: ActionType;
  readonly disabled: boolean;
}

interface ButtonConfigInput {
  readonly isFetching: boolean;
  readonly isFakeLoading: boolean;
  readonly isFakeError: boolean;
}

function getButtonConfig({ isFetching, isFakeLoading, isFakeError }: ButtonConfigInput): readonly ActionButtonConfig[] {
  const disableOthers = isFetching || isFakeLoading || isFakeError;

  return [
    { label: "Refetch", textColor: "text-blue-600 dark:text-blue-400", action: "refetch", disabled: disableOthers },
    { label: "Invalidate", textColor: "text-orange-500 dark:text-orange-400", action: "invalidate", disabled: disableOthers },
    { label: "Reset", textColor: "text-gray-800 dark:text-white", action: "reset", disabled: disableOthers },
    { label: "Remove", textColor: "text-pink-600 dark:text-pink-400", action: "remove", disabled: false },
    {
      label: isFakeLoading ? "Restore Loading" : "Trigger Loading",
      textColor: "text-cyan-600 dark:text-cyan-400",
      action: isFakeLoading ? "restoreLoading" : "triggerLoading",
      disabled: isFakeError || (isFetching && !isFakeLoading),
    },
    {
      label: isFakeError ? "Restore Error" : "Trigger Error",
      textColor: "text-red-600 dark:text-red-400",
      action: isFakeError ? "restoreError" : "triggerError",
      disabled: isFakeLoading || (isFetching && !isFakeError),
    },
  ];
}

interface ActionButtonsProps {
  readonly queryHash: string;
  readonly queryState: QueryState;
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly observerCount: number;
  readonly sendAction: (action: ActionType, queryHash: string) => void;
  readonly onClearSelection?: () => void;
}

export function ActionButtons({ queryHash, queryState, isActive, isDisabled, observerCount, sendAction, onClearSelection }: ActionButtonsProps) {
  const forceDisableAll = isDisabled || !isActive || !observerCount;
  const isFetching = queryState.fetchStatus === "fetching";
  const isFakeLoading = queryState.fetchMeta?.__previousQueryOptions != null && queryState.status === "pending";
  const isFakeError = queryState.fetchMeta?.__previousQueryOptions != null && queryState.status === "error";
  const buttons = getButtonConfig({ isFetching, isFakeLoading, isFakeError });

  function handleClick(action: ActionType) {
    sendAction(action, queryHash);
    if (action === "remove") {
      onClearSelection?.();
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map((button) => {
        const isTriggerButton = button.action === "triggerLoading" || button.action === "restoreLoading" || button.action === "triggerError" || button.action === "restoreError";
        const disabled = (isTriggerButton && forceDisableAll) || button.disabled;
        return (
          <button type="button" key={button.action} disabled={disabled} className={`w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-medium cursor-default hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150 ${button.textColor}${disabled ? " opacity-50 cursor-not-allowed" : ""}`} onClick={disabled ? undefined : () => handleClick(button.action)}>
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
