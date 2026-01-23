import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search articles...' }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pl-10"
        placeholder={placeholder}
      />
    </div>
  );
}
