import type { SupportedType } from "./jsonTypes";

export const getTypeColor = (
  type: SupportedType,
  isDarkMode: boolean,
): string => {
  const colors = {
    string: isDarkMode ? "text-orange-400" : "text-orange-600",
    number: isDarkMode ? "text-blue-400" : "text-blue-600",
    boolean: isDarkMode ? "text-purple-400" : "text-purple-600",
    null: isDarkMode ? "text-gray-400" : "text-gray-500",
    bigint: isDarkMode ? "text-yellow-400" : "text-yellow-600",
    date: isDarkMode ? "text-pink-400" : "text-pink-600",
    function: isDarkMode ? "text-red-400" : "text-red-600",
  };
  return colors[type];
};

export const getDefaultValue = (type: SupportedType): string => {
  switch (type) {
    case "boolean":
      return "false";
    case "number":
      return "0";
    case "bigint":
      return "0";
    case "null":
      return "null";
    case "string":
    case "date":
      return "";
    default:
      return "";
  }
};
