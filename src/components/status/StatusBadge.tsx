import type { StatusDisplay } from "../../types/query";

interface StatusBadgeProps {
  status: StatusDisplay;
  count?: number;
  className?: string;
}

export function StatusBadge({ status, count, className = "" }: StatusBadgeProps) {
  return (
    <div
      className={`
        w-6 h-6 flex items-center justify-center text-white text-xs font-bold rounded
        status-badge-animated ${status.bgColor} ${className}
      `}
    >
      {count !== undefined ? count : status.icon}
    </div>
  );
}

export default StatusBadge;
