import type { QueryData, MutationData, StatusDisplay } from "../types/query";

// Helper function to get status display with state-based colors
export function getQueryStatusDisplay(query: QueryData): StatusDisplay {
  if (query.state.isFetching) {
    return {
      icon: "🔄",
      text: "Fetching",
      bgColor: "bg-blue-500",
      textColor: "text-blue-600",
    };
  }

  switch (query.state.status) {
    case "success":
      if (query.state.isStale) {
        return {
          icon: "🔄",
          text: "Stale",
          bgColor: "bg-yellow-500",
          textColor: "text-yellow-600",
        };
      }
      return {
        icon: "✅",
        text: "Fresh",
        bgColor: "bg-green-500",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "❌",
        text: "Error",
        bgColor: "bg-red-500",
        textColor: "text-red-600",
      };
    case "pending":
      return {
        icon: "⏳",
        text: "Pending",
        bgColor: "bg-orange-500",
        textColor: "text-orange-600",
      };
    default:
      return {
        icon: "❓",
        text: query.isActive ? "Unknown" : "Inactive",
        bgColor: "bg-gray-400",
        textColor: "text-gray-600",
      };
  }
}

// Helper function to get mutation status display
export function getMutationStatusDisplay(mutation: MutationData): StatusDisplay {
  switch (mutation.state) {
    case "pending":
      return {
        icon: "⏳",
        text: "Pending",
        bgColor: "bg-orange-500",
        textColor: "text-orange-600",
      };
    case "success":
      return {
        icon: "✅",
        text: "Success",
        bgColor: "bg-green-500",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "❌",
        text: "Error",
        bgColor: "bg-red-500",
        textColor: "text-red-600",
      };
    case "paused":
      return {
        icon: "⏸️",
        text: "Paused",
        bgColor: "bg-yellow-500",
        textColor: "text-yellow-600",
      };
    case "idle":
    default:
      return {
        icon: "💤",
        text: "Idle",
        bgColor: "bg-gray-400",
        textColor: "text-gray-600",
      };
  }
}
