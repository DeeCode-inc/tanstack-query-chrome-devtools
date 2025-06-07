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
          card-base p-3 flex items-center justify-between shadow-md
          border-l-4 transition-all duration-300 ease-out
          ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border-green-500 dark:bg-green-950/50 dark:text-green-100"
              : "bg-red-50 text-red-800 border-red-500 dark:bg-red-950/50 dark:text-red-100"
          }
        `}
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">
            {feedback.type === "success" ? "✅" : "❌"}
          </span>
          <span className="font-medium">{feedback.message}</span>
        </span>
        <button
          onClick={onClose}
          className={`
            bg-transparent border-none text-lg cursor-pointer px-2 py-1 rounded
            hover:bg-black/10 dark:hover:bg-white/10 transition-colors
            ${
              feedback.type === "success"
                ? "text-green-700 dark:text-green-200"
                : "text-red-700 dark:text-red-200"
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
