import { useStatusTransition } from "../../hooks/useStatusTransition";
import { IconRenderer } from "../common/IconRenderer";
import { statusBadgeVariants } from "../../lib/variants";
import type { StatusDisplay } from "../../types/query";

interface StatusBadgeProps {
  status: StatusDisplay;
  count?: number;
  className?: string;
  transitionDuration?: number;
}

export function StatusBadge({ status, count, className = "", transitionDuration = 500 }: StatusBadgeProps) {
  const { transitionClass, handleTransitionEnd } = useStatusTransition({
    currentStatus: status,
    transitionDuration,
  });

  return (
    <div
      className={`
        flex items-center justify-center text-white text-xs font-bold rounded
        ${statusBadgeVariants({ status: status.variant })} ${transitionClass} ${className}
      `}
      onAnimationEnd={handleTransitionEnd}
    >
      {count !== undefined ? count : <IconRenderer iconName={status.icon} className="w-4 h-4" />}
    </div>
  );
}
