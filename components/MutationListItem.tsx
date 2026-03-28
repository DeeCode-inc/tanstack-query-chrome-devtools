import { Circle, Loader, CheckCircle, XCircle } from "lucide-react";
import type { MutationEntry } from "@/types/ui";
import { formatAbsoluteTime } from "@/utils/format";
import { stringifyWithBigInt } from "@/utils/serialization";
import { RelativeTime } from "./RelativeTime";

interface MutationListItemProps {
  readonly mutation: MutationEntry;
  readonly index: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

const statusIcons = {
  idle: <Circle className="size-4 text-gray-400 dark:text-gray-500" />,
  pending: <Loader className="size-4 animate-spin text-yellow-500 dark:text-yellow-400" />,
  success: <CheckCircle className="size-4 text-green-500 dark:text-green-400" />,
  error: <XCircle className="size-4 text-red-500 dark:text-red-400" />,
} as const;

export function MutationListItem({ mutation, index, isSelected, onSelect }: MutationListItemProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}
      onClick={onSelect}
    >
      <span className="shrink-0">{statusIcons[mutation.status]}</span>
      <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate flex-1">
        {mutation.mutationKey
          ? stringifyWithBigInt(mutation.mutationKey)
          : `Mutation #${String(index)}`}
      </span>
      <span
        className="text-xs text-gray-500 dark:text-gray-400 shrink-0"
        title={formatAbsoluteTime(mutation.timestamp)}
      >
        <RelativeTime timestamp={mutation.timestamp} />
      </span>
    </div>
  );
}
