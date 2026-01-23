import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { articlesApi, tagsApi } from '../services/api';
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
  const [selectedTag, setSelectedTag] = useState(null);

  // Fetch articles
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, search, filters, selectedTag],
    queryFn: () =>
      articlesApi.list({
        page,
        limit: 20,
        search: search || undefined,
        tag: selectedTag || undefined,
        is_archived: filters.status === 'archived' ? 1 : filters.status === 'unread' ? 0 : undefined,
        is_favorite: filters.status === 'favorite' ? 1 : undefined,
        sort_by: filters.sortBy,
      }),
  });

  // Fetch tags for filter
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list().then((res) => res.data),
  });

  const articles = articlesData?.data?.data?.articles || [];
  const total = articlesData?.data?.data?.total || 0;

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
      </div>

      <SearchBar value={search} onChange={handleSearch} />

      <ArticleFilters
        filters={filters}
        onFiltersChange={setFilters}
        tags={tags}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
      />

      <ArticleList articles={articles} isLoading={articlesLoading} />

      <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
    </div>
  );
}
