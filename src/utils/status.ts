import type { QueryData, MutationData, StatusDisplay } from "../types/query";

// Helper function to get status display with state-based colors
export function getQueryStatusDisplay(query: QueryData): StatusDisplay {
  if (query.state.isFetching) {
    return {
      icon: "🔄",
      text: "Fetching",
      bgColor: "status-fetching",
      textColor: "text-blue-600",
    };
  }

  switch (query.state.status) {
    case "success":
      if (query.state.isStale) {
        return {
          icon: "🔄",
          text: "Stale",
          bgColor: "status-warning",
          textColor: "text-yellow-600",
        };
      }
      return {
        icon: "✅",
        text: "Fresh",
        bgColor: "status-success",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "❌",
        text: "Error",
        bgColor: "status-error",
        textColor: "text-red-600",
      };
    case "pending":
      return {
        icon: "⏳",
        text: "Pending",
        bgColor: "status-pending",
        textColor: "text-orange-600",
      };
    default:
      return {
        icon: "❓",
        text: query.isActive ? "Unknown" : "Inactive",
        bgColor: "status-inactive",
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
        bgColor: "status-pending",
        textColor: "text-orange-600",
      };
    case "success":
      return {
        icon: "✅",
        text: "Success",
        bgColor: "status-success",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "❌",
        text: "Error",
        bgColor: "status-error",
        textColor: "text-red-600",
      };
    case "paused":
      return {
        icon: "⏸️",
        text: "Paused",
        bgColor: "status-warning",
        textColor: "text-yellow-600",
      };
    case "idle":
    default:
      return {
        icon: "💤",
        text: "Idle",
        bgColor: "status-inactive",
        textColor: "text-gray-600",
      };
  }
}
