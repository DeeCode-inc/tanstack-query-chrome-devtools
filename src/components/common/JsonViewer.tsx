import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { detectType } from "../../utils/jsonTypes";
import { ValueEditor } from "./ValueEditor";

interface JsonViewerProps {
  data: unknown;
  onEdit?: (newData: unknown) => void;
  collapsed?: number;
  readonly?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  onEdit,
  collapsed = 1,
  readonly = false,
}) => {
  const { isDarkMode } = useTheme();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const updateValue = useCallback(
    (path: string[], newValue: unknown) => {
      if (!onEdit) return;

      const updateNestedValue = (
        obj: unknown,
        pathArray: string[],
        value: unknown,
      ): unknown => {
        if (pathArray.length === 0) return value;

        const [head, ...tail] = pathArray;
        if (Array.isArray(obj)) {
          const result = [...obj];
          result[parseInt(head, 10)] = updateNestedValue(
            result[parseInt(head, 10)],
            tail,
            value,
          );
          return result;
        } else if (obj && typeof obj === "object") {
          const result = { ...obj } as Record<string, unknown>;
          result[head] = updateNestedValue(result[head], tail, value);
          return result;
        }
        return value;
      };

      const newData = updateNestedValue(data, path, newValue);
      onEdit(newData);
    },
    [data, onEdit],
  );

  const deleteValue = useCallback(
    (path: string[]) => {
      if (!onEdit || path.length === 0) return;

      const deleteNestedValue = (
        obj: unknown,
        pathArray: string[],
      ): unknown => {
        if (pathArray.length === 1) {
          const [key] = pathArray;
          if (Array.isArray(obj)) {
            const result = [...obj];
            result.splice(parseInt(key, 10), 1);
            return result;
          } else if (obj && typeof obj === "object") {
            const result = { ...obj } as Record<string, unknown>;
            delete result[key];
            return result;
          }
          return obj;
        }

        const [head, ...tail] = pathArray;
        if (Array.isArray(obj)) {
          const result = [...obj];
          result[parseInt(head, 10)] = deleteNestedValue(
            result[parseInt(head, 10)],
            tail,
          );
          return result;
        } else if (obj && typeof obj === "object") {
          const result = { ...obj } as Record<string, unknown>;
          result[head] = deleteNestedValue(result[head], tail);
          return result;
        }
        return obj;
      };

      const newData = deleteNestedValue(data, path);
      onEdit(newData);
    },
    [data, onEdit],
  );

  const renderValue = (
    value: unknown,
    path: string[] = [],
    depth: number = 0,
    fieldName?: string,
  ): React.ReactNode => {
    const pathString = path.join(".");
    const currentType = detectType(value);
    const isExpanded = expandedPaths.has(pathString) || depth < collapsed;

    // Handle null
    if (value === null) {
      return (
        <ValueEditor
          value={null}
          path={path}
          onUpdate={updateValue}
          onDelete={deleteValue}
          isDarkMode={isDarkMode}
          readOnly={readonly}
          fieldName={fieldName}
        />
      );
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <div className="w-full">
          <div className="flex items-center gap-1 w-full">
            <button
              onClick={() => toggleExpanded(pathString)}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-1"
            >
              <span>{isExpanded ? "▼" : "▶"}</span>
              {fieldName && (
                <span className="text-green-600 dark:text-green-400 break-words overflow-hidden">
                  "{fieldName}":
                </span>
              )}
              <span>Array ({value.length} items)</span>
            </button>
            {path.length > 0 && !readonly && (
              <button
                onClick={() => deleteValue(path)}
                className="ml-1 p-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Delete field"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="ml-4 space-y-1">
              {value.map((item, index) => (
                <div key={index} className="flex items-start gap-1">
                  {renderValue(
                    item,
                    [...path, index.toString()],
                    depth + 1,
                    `[${index}]`,
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Handle objects
    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value);
      return (
        <div className="w-full">
          <div className="flex items-center gap-1 w-full">
            <button
              onClick={() => toggleExpanded(pathString)}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-1"
            >
              <span>{isExpanded ? "▼" : "▶"}</span>
              {fieldName && (
                <span className="text-green-600 dark:text-green-400 break-words overflow-hidden">
                  "{fieldName}":
                </span>
              )}
              <span>Object ({entries.length} keys)</span>
            </button>
            {path.length > 0 && !readonly && (
              <button
                onClick={() => deleteValue(path)}
                className="ml-1 p-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Delete field"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="ml-4 space-y-1">
              {entries.map(([key, val]) => (
                <div key={key} className="flex items-start gap-1">
                  {renderValue(val, [...path, key], depth + 1, key)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Handle primitive values
    return (
      <ValueEditor
        value={value}
        path={path}
        onUpdate={updateValue}
        onDelete={deleteValue}
        isDarkMode={isDarkMode}
        readOnly={readonly || currentType === "function"}
        fieldName={fieldName}
      />
    );
  };

  return (
    <div
      className={`font-mono text-sm ${isDarkMode ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-900"} p-2 rounded`}
    >
      {renderValue(data)}
    </div>
  );
};
