import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '../services/api';
import SearchBar from '../components/Common/SearchBar';
import ArticleList from '../components/Articles/ArticleList';
import ArticleFilters from '../components/Articles/ArticleFilters';
import BulkActionBar from '../components/Articles/BulkActionBar';
import Pagination from '../components/Common/Pagination';

const PAGE_SIZE = 20;

export default function Articles() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'created_at',
  });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [notice, setNotice] = useState(null);

  const queryClient = useQueryClient();

  // Fetch articles
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, search, filters],
    queryFn: () =>
      articlesApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        is_archived: filters.status === 'archived' ? 1 : filters.status === 'unread' ? 0 : undefined,
        is_favorite: filters.status === 'favorite' ? 1 : undefined,
        sort_by: filters.sortBy,
      }),
  });

  const articles = useMemo(
    () => articlesData?.data?.data?.articles || [],
    [articlesData]
  );
  const total = articlesData?.data?.data?.total || 0;

  // Selection is scoped to the visible page, so changing what is on screen
  // clears it. This prevents deleting rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, filters]);

  const selectedOnPage = useMemo(
    () => articles.filter((article) => selectedIds.has(article.id)).map((article) => article.id),
    [articles, selectedIds]
  );

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => articlesApi.bulkDelete(ids),
    onSuccess: (response) => {
      const deleted = response?.data?.deleted ?? selectedOnPage.length;

      setSelectedIds(new Set());
      setNotice(`Deleted ${deleted} article${deleted === 1 ? '' : 's'}.`);

      // Deleting the whole page can leave it empty, so fall back one page
      if (deleted >= articles.length && page > 1) {
        setPage((current) => current - 1);
      }

      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error) => {
      setNotice(error?.response?.data?.message || 'Failed to delete articles.');
    },
  });

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((previous) => {
      const allSelected = articles.length > 0 && articles.every((article) => previous.has(article.id));
      return allSelected ? new Set() : new Set(articles.map((article) => article.id));
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    const count = selectedOnPage.length;

    if (count === 0) {
      return;
    }

    if (window.confirm(`Delete ${count} article${count === 1 ? '' : 's'}? This cannot be undone.`)) {
      bulkDeleteMutation.mutate(selectedOnPage);
    }
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

      {/* Result notice */}
      {notice && (
        <div
          className="card mt-6 px-4 py-3 text-sm text-gallery-700"
          role="status"
        >
          {notice}
        </div>
      )}

      {/* Article List */}
      <div className="mt-6">
        <ArticleList
          articles={articles}
          isLoading={articlesLoading}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
        />
      </div>

      {/* Pagination */}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Bulk actions */}
      <BulkActionBar
        count={selectedOnPage.length}
        onDelete={handleBulkDelete}
        onClear={handleClearSelection}
        isDeleting={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
