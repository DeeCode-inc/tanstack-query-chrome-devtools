import { CheckCircle, Circle, Loader, XCircle } from "lucide-react";
import { memo } from "react";
import type { MutationEntry } from "@/types/ui";
import { getMutationLabel } from "@/utils/entry-labels";
import { formatAbsoluteTime } from "@/utils/format";
import { RelativeTime } from "./RelativeTime";

interface MutationListItemProps {
  readonly mutation: MutationEntry;
  readonly isSelected: boolean;
  /** Stable across renders, so unchanged rows skip re-rendering. */
  readonly onSelect: (mutationId: number) => void;
}

const statusIcons = {
  idle: <Circle className="size-4 text-gray-400 dark:text-gray-500" />,
  pending: (
    <Loader className="size-4 animate-spin text-yellow-500 dark:text-yellow-400" />
  ),
  success: (
    <CheckCircle className="size-4 text-green-500 dark:text-green-400" />
  ),
  error: <XCircle className="size-4 text-red-500 dark:text-red-400" />,
} as const;

export const MutationListItem = memo(function MutationListItem({
  mutation,
  isSelected,
  onSelect,
}: MutationListItemProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}
      onClick={() => onSelect(mutation.mutationId)}
    >
      <span className="shrink-0">{statusIcons[mutation.status]}</span>
      <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate flex-1">
        {getMutationLabel(mutation)}
      </span>
      <span
        className="text-xs text-gray-500 dark:text-gray-400 shrink-0"
        title={formatAbsoluteTime(mutation.timestamp)}
      >
        <RelativeTime timestamp={mutation.timestamp} />
      </span>
    </button>
  );
});
