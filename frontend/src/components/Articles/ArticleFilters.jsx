import { Filter } from 'lucide-react';

const filterOptions = {
  status: [
    { value: 'all', label: 'All Articles' },
    { value: 'unread', label: 'Unread' },
    { value: 'archived', label: 'Archived' },
    { value: 'favorite', label: 'Favorites' },
  ],
  sortBy: [
    { value: 'created_at', label: 'Newest First' },
    { value: 'created_at_asc', label: 'Oldest First' },
    { value: 'title', label: 'Title A-Z' },
    { value: 'title_desc', label: 'Title Z-A' },
    { value: 'reading_time', label: 'Reading Time' },
  ],
};

export default function ArticleFilters({
  filters,
  onFiltersChange,
}) {
  return (
    <div className="card p-4 mt-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center text-gallery-700 pr-4 border-r border-gallery-200">
          <Filter className="w-4 h-4 mr-2" strokeWidth={2} />
          <span className="text-sm font-semibold">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              className="input appearance-none pr-10 text-sm font-medium cursor-pointer"
            >
              {filterOptions.status.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-4 w-4 text-gallery-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={filters.sortBy}
              onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value })}
              className="input appearance-none pr-10 text-sm font-medium cursor-pointer"
            >
              {filterOptions.sortBy.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-4 w-4 text-gallery-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
