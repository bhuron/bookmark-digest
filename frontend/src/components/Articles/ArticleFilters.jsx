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
    <div className="card p-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center text-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="input w-auto"
          >
            {filterOptions.status.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={filters.sortBy}
            onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value })}
            className="input w-auto"
          >
            {filterOptions.sortBy.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>


        </div>
      </div>
    </div>
  );
}
