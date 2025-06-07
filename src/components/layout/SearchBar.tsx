interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function SearchBar({ searchTerm, onSearchChange, placeholder, className = "" }: SearchBarProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="input-base"
      />
    </div>
  );
}

export default SearchBar;
