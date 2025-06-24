type SupportedType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "bigint"
  | "date"
  | "function";

export const detectType = (
  value: unknown,
): SupportedType | "array" | "object" => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (typeof value === "bigint") return "bigint";
  if (typeof value === "function") return "function";
  if (typeof value === "object") return "object";
  return typeof value as SupportedType;
};

export const convertValue = (
  stringValue: string,
  targetType: SupportedType,
): { value: unknown; isValid: boolean } => {
  try {
    switch (targetType) {
      case "string":
        return { value: stringValue, isValid: true };
      case "number": {
        const num = Number(stringValue);
        return { value: num, isValid: !isNaN(num) };
      }
      case "boolean": {
        const boolValue = stringValue.toLowerCase();
        if (boolValue === "true") return { value: true, isValid: true };
        if (boolValue === "false") return { value: false, isValid: true };
        return { value: false, isValid: false };
      }
      case "null":
        return { value: null, isValid: true };
      case "bigint": {
        const bigintValue = BigInt(stringValue);
        return { value: bigintValue, isValid: true };
      }
      case "date": {
        const dateValue = new Date(stringValue);
        return { value: dateValue, isValid: !isNaN(dateValue.getTime()) };
      }
      default:
        return { value: stringValue, isValid: true };
    }
  } catch {
    return { value: stringValue, isValid: false };
  }
};

export const formatValue = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "function") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return String(value);
};

export type { SupportedType };
