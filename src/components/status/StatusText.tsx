import { useStatusTransition } from "../../hooks/useStatusTransition";
import type { StatusDisplay } from "../../types/query";

interface StatusTextProps {
  status: StatusDisplay;
  className?: string;
  transitionDuration?: number;
}

export function StatusText({ status, className = "", transitionDuration = 500 }: StatusTextProps) {
  const { transitionClass, handleTransitionEnd } = useStatusTransition({
    currentStatus: status,
    transitionDuration,
  });

  return (
    <div
      className={`
        px-3 py-1 rounded text-white text-sm font-medium min-w-[85px] text-center
        status-badge-animated status-transition ${status.bgColor} ${transitionClass} ${className}
      `}
      onAnimationEnd={handleTransitionEnd}
    >
      {status.text}
    </div>
  );
}
