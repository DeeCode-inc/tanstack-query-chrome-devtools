import { Search } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  placeholder,
  className = "",
}: SearchBarProps) {
  return (
    <div className={`flex-1 enter-animation-scale ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-base pl-10"
        />
      </div>
    </div>
  );
}
