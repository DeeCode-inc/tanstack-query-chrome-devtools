import type { QueryData, MutationData, StatusDisplay } from "../types/query";

// Helper function to get status display with state-based colors
export function getQueryStatusDisplay(query: QueryData): StatusDisplay {
  if (query.state.isFetching) {
    return {
      icon: "RotateCw",
      text: "Fetching",
      bgColor: "status status-blue",
      textColor: "text-blue-600",
    };
  }

  switch (query.state.status) {
    case "success":
      if (query.state.isStale) {
        return {
          icon: "Clock",
          text: "Stale",
          bgColor: "status status-yellow",
          textColor: "text-yellow-600",
        };
      }
      return {
        icon: "CheckCircle",
        text: "Fresh",
        bgColor: "status status-green",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "XCircle",
        text: "Error",
        bgColor: "status status-red",
        textColor: "text-red-600",
      };
    case "pending":
      return {
        icon: "Clock",
        text: "Pending",
        bgColor: "status status-purple",
        textColor: "text-orange-600",
      };
    default:
      if (!query.isActive) {
        return {
          icon: "Moon",
          text: "Inactive",
          bgColor: "status status-gray",
          textColor: "text-gray-500",
        };
      }
      return {
        icon: "HelpCircle",
        text: "Unknown",
        bgColor: "status status-gray",
        textColor: "text-gray-600",
      };
  }
}

// Helper function to get mutation status display
export function getMutationStatusDisplay(mutation: MutationData): StatusDisplay {
  switch (mutation.state) {
    case "pending":
      return {
        icon: "Clock",
        text: "Pending",
        bgColor: "status status-purple",
        textColor: "text-orange-600",
      };
    case "success":
      return {
        icon: "CheckCircle",
        text: "Success",
        bgColor: "status status-green",
        textColor: "text-green-600",
      };
    case "error":
      return {
        icon: "XCircle",
        text: "Error",
        bgColor: "status status-red",
        textColor: "text-red-600",
      };
    case "paused":
      return {
        icon: "Pause",
        text: "Paused",
        bgColor: "status status-yellow",
        textColor: "text-yellow-600",
      };
    case "idle":
    default:
      return {
        icon: "Moon",
        text: "Idle",
        bgColor: "status status-gray",
        textColor: "text-gray-600",
      };
  }
}
