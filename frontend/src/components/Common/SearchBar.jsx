import { Search, X } from 'lucide-react';
import { useState } from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Search articles...' }) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={`relative transition-all duration-300 ${isFocused ? 'scale-[1.01]' : ''}`}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gallery-400" strokeWidth={2} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="input pl-11 pr-10 h-12 text-sm"
        placeholder={placeholder}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gallery-400 hover:text-gallery-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
