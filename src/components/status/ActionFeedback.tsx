import type { ActionFeedback as ActionFeedbackType } from "../../types/query";

interface ActionFeedbackProps {
  feedback: ActionFeedbackType | null;
  onClose: () => void;
}

export function ActionFeedback({ feedback, onClose }: ActionFeedbackProps) {
  if (!feedback) return null;

  return (
    <div className="mb-5">
      <div
        className={`
          p-2.5 rounded border flex items-center justify-between
          ${
            feedback.type === "success"
              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700"
              : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-700"
          }
        `}
      >
        <span>
          {feedback.type === "success" ? "✅" : "❌"} {feedback.message}
        </span>
        <button
          onClick={onClose}
          className={`
            bg-transparent border-none text-base cursor-pointer px-1
            ${
              feedback.type === "success"
                ? "text-green-800 dark:text-green-100"
                : "text-red-800 dark:text-red-100"
            }
          `}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default ActionFeedback;
