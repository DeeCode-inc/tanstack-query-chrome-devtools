import { Search } from "lucide-react";

interface SearchInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        placeholder="Filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
      />
    </div>
  );
}
