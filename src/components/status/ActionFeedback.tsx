import { useState, useEffect } from "react";
import type { ActionFeedback as ActionFeedbackType } from "../../types/query";

interface ActionFeedbackProps {
  feedback: ActionFeedbackType | null;
  onClose: () => void;
}

export function ActionFeedback({ feedback, onClose }: ActionFeedbackProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<ActionFeedbackType | null>(null);

  useEffect(() => {
    if (feedback) {
      // New feedback - show with entrance animation
      setCurrentFeedback(feedback);
      setIsVisible(true);
      setIsExiting(false);
    } else if (currentFeedback && !isExiting) {
      // Feedback cleared - start exit animation
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setCurrentFeedback(null);
        setIsExiting(false);
      }, 200); // Match exit animation duration
      return () => clearTimeout(timer);
    }
  }, [feedback, currentFeedback, isExiting]);

  const handleClose = () => {
    setIsExiting(true);
    const timer = setTimeout(() => {
      onClose();
    }, 200); // Match exit animation duration
    return () => clearTimeout(timer);
  };

  if (!isVisible || !currentFeedback) return null;

  return (
    <div className="mb-5">
      <div
        className={`
          card-base
          p-3 flex items-center justify-between shadow-md
          border-l-4 transition-all duration-300 ease-out
          ${isExiting ? "toast-exit" : "toast-enter"}
          ${currentFeedback.type === "success" ? "bg-green-50 text-green-800 border-green-500 dark:bg-green-950/50 dark:text-green-100" : "bg-red-50 text-red-800 border-red-500 dark:bg-red-950/50 dark:text-red-100"}
        `}
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">{currentFeedback.type === "success" ? "✅" : "❌"}</span>
          <span className="font-medium">{currentFeedback.message}</span>
        </span>
        <button
          onClick={handleClose}
          className={`
            bg-transparent border-none text-lg cursor-pointer px-2 py-1 rounded
            hover:bg-black/10 dark:hover:bg-white/10 transition-colors
            ${currentFeedback.type === "success" ? "text-green-700 dark:text-green-200" : "text-red-700 dark:text-red-200"}
          `}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default ActionFeedback;
