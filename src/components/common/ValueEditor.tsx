import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  detectType,
  convertValue,
  formatValue,
  type SupportedType,
} from "../../utils/jsonTypes";
import { getTypeColor, getDefaultValue } from "../../utils/jsonStyling";

export interface ValueEditorProps {
  value: unknown;
  path: string[];
  onUpdate: (path: string[], newValue: unknown) => void;
  onDelete: (path: string[]) => void;
  isDarkMode: boolean;
  readOnly: boolean;
  fieldName?: string;
}

export const ValueEditor: React.FC<ValueEditorProps> = ({
  value,
  path,
  onUpdate,
  onDelete,
  isDarkMode,
  readOnly,
  fieldName,
}) => {
  const detectedType = detectType(value);
  const [currentType, setCurrentType] = useState<SupportedType>(
    detectedType === "object" || detectedType === "array"
      ? "string"
      : (detectedType as SupportedType),
  );
  const [inputValue, setInputValue] = useState<string>(formatValue(value));
  const [isValid, setIsValid] = useState<boolean>(true);

  // Reset internal state when value changes
  useEffect(() => {
    const newDetectedType = detectType(value);
    const newType =
      newDetectedType === "object" || newDetectedType === "array"
        ? "string"
        : (newDetectedType as SupportedType);
    setCurrentType(newType);
    setInputValue(formatValue(value));
    setIsValid(true);
  }, [value]);

  const handleTypeChange = (newType: SupportedType) => {
    setCurrentType(newType);
    const defaultValue = getDefaultValue(newType);
    setInputValue(defaultValue);
    const { value: convertedValue, isValid: valid } = convertValue(
      defaultValue,
      newType,
    );
    setIsValid(valid);
    if (valid) {
      onUpdate(path, convertedValue);
    }
  };

  const handleValueChange = (newValue: string) => {
    setInputValue(newValue);
    // Only update local state, don't apply changes immediately
  };

  const commitValue = () => {
    const { value: convertedValue, isValid: valid } = convertValue(
      inputValue,
      currentType,
    );
    setIsValid(valid);
    if (valid) {
      onUpdate(path, convertedValue);
    } else {
      // Reset to original value if invalid
      setInputValue(formatValue(value));
      setIsValid(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitValue();
    }
  };

  const handleBooleanChange = (checked: boolean) => {
    const newValue = checked.toString();
    setInputValue(newValue);
    onUpdate(path, checked);
  };

  const handleDelete = () => {
    onDelete(path);
  };

  const handleInputBlur = () => {
    commitValue();
  };

  if (readOnly) {
    const displayType =
      detectedType === "object" || detectedType === "array"
        ? "string"
        : (detectedType as SupportedType);
    return (
      <div className="flex items-center gap-1 w-full">
        {fieldName && (
          <span className="text-green-600 dark:text-green-400">
            "{fieldName}":
          </span>
        )}
        <span>:</span>
        <span className="flex-1 min-w-[3rem] text-gray-600 dark:text-gray-400 wrap-anywhere">
          {displayType === "string" && typeof value === "string"
            ? `"${value}"`
            : formatValue(value)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 w-full">
      {fieldName && (
        <span className="text-green-600 dark:text-green-400 break-words overflow-hidden">
          "{fieldName}"
        </span>
      )}
      <select
        value={currentType}
        onChange={(e) => handleTypeChange(e.target.value as SupportedType)}
        className={`${getTypeColor(currentType, isDarkMode)} bg-transparent border-none p-0 text-xs cursor-pointer hover:underline`}
      >
        <option value="string">string</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
        <option value="null">null</option>
        <option value="bigint">bigint</option>
        <option value="date">date</option>
      </select>
      <span>:</span>

      {currentType === "boolean" ? (
        <div className="flex items-center gap-1 flex-1 min-w-[3rem]">
          <input
            type="checkbox"
            checked={inputValue === "true"}
            onChange={(e) => handleBooleanChange(e.target.checked)}
            className="w-3 h-3"
          />
          <span className="text-xs">{inputValue}</span>
        </div>
      ) : currentType === "null" ? (
        <span className="text-gray-500 dark:text-gray-400 italic flex-1 min-w-[3rem]">
          null
        </span>
      ) : (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className={`text-xs px-2 py-1 rounded border flex-1 min-w-[3rem] ${!isValid ? "border-red-500 bg-red-50 dark:bg-red-900/20" : isDarkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-300 text-gray-700"}`}
          placeholder={`Enter ${currentType} value...`}
        />
      )}

      {path.length > 0 && (
        <button
          onClick={handleDelete}
          className="ml-1 p-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          title="Delete field"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};
