import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { articlesApi } from '../services/api';
import SearchBar from '../components/Common/SearchBar';
import ArticleList from '../components/Articles/ArticleList';
import ArticleFilters from '../components/Articles/ArticleFilters';
import Pagination from '../components/Common/Pagination';

export default function Articles() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'created_at',
  });

  // Fetch articles
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, search, filters],
    queryFn: () =>
      articlesApi.list({
        page,
        limit: 20,
        search: search || undefined,
        is_archived: filters.status === 'archived' ? 1 : filters.status === 'unread' ? 0 : undefined,
        is_favorite: filters.status === 'favorite' ? 1 : undefined,
        sort_by: filters.sortBy,
      }),
  });

  const articles = articlesData?.data?.data?.articles || [];
  const total = articlesData?.data?.data?.total || 0;

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl lg:text-4xl text-gallery-900 tracking-tight mb-2">
          Library
        </h1>
        <p className="text-gallery-500 text-lg">
          Your curated collection of saved articles
        </p>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={handleSearch} />

      {/* Filters */}
      <ArticleFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Article List */}
      <div className="mt-6">
        <ArticleList articles={articles} isLoading={articlesLoading} />
      </div>

      {/* Pagination */}
      <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
    </div>
  );
}
