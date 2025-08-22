import { Trash2 } from "lucide-react";
import { buttonVariants } from "../../lib/variants";

interface RemoveAllQueriesButtonProps {
  disabled: boolean;
  onRemoveAll: () => void;
}

export function RemoveAllQueriesButton({
  disabled,
  onRemoveAll,
}: RemoveAllQueriesButtonProps) {
  return (
    <button
      onClick={onRemoveAll}
      disabled={disabled}
      title="Remove all queries"
      className={buttonVariants({ variant: "pink", size: "sm" })}
      aria-label="Remove all queries"
    >
      <Trash2 size={14} className="shrink-0" />
    </button>
  );
}
