import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import { articlesApi } from '../services/api';
import SearchBar from '../components/Common/SearchBar';
import ArticleList from '../components/Articles/ArticleList';
import ArticleFilters from '../components/Articles/ArticleFilters';
import BulkActionBar from '../components/Articles/BulkActionBar';
import Pagination from '../components/Common/Pagination';
import {
  buildScope,
  canSelectAllMatching,
  isAllSelected,
  selectedVisibleIds,
  toggleAll,
  toggleId,
} from '../utils/selection';
import { buildArticleFilter, isTrashView } from '../utils/articleFilters';

const PAGE_SIZE = 20;

export default function Articles() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'created_at',
  });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // 'page' acts on the ticked rows, 'all' acts on everything matching the filter
  const [scopeMode, setScopeMode] = useState('page');
  // Selection chrome stays invisible until the user asks for it
  const [isSelecting, setIsSelecting] = useState(false);
  const [notice, setNotice] = useState(null);

  const queryClient = useQueryClient();

  const isTrash = isTrashView(filters.status);

  // One filter object drives both the list request and the bulk scope, so
  // "select all matching" can never mean something different from the list
  const filter = useMemo(() => buildArticleFilter(filters, search), [filters, search]);

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, filter, filters.sortBy],
    queryFn: () =>
      articlesApi.list({
        page,
        limit: PAGE_SIZE,
        sort_by: filters.sortBy,
        ...filter,
      }),
  });

  const articles = useMemo(
    () => articlesData?.data?.data?.articles || [],
    [articlesData]
  );
  const total = articlesData?.data?.data?.total || 0;
  const trashedTotal = articlesData?.data?.data?.trashedTotal || 0;

  const exitSelection = useCallback(() => {
    setSelectedIds(new Set());
    setScopeMode('page');
    setIsSelecting(false);
  }, []);

  // Selection is scoped to what is on screen, so changing the page, search or
  // filters clears it and rows the user can no longer see are never acted on
  useEffect(() => {
    exitSelection();
  }, [page, filter, exitSelection]);

  const selectedOnPage = useMemo(
    () => selectedVisibleIds(articles, selectedIds),
    [articles, selectedIds]
  );

  const scope = useMemo(
    () => buildScope({ mode: scopeMode, articles, selectedIds, filter }),
    [scopeMode, articles, selectedIds, filter]
  );

  const selectedCount = scopeMode === 'all' ? total : selectedOnPage.length;
  const targetLabel = scopeMode === 'all'
    ? `all ${total} matching article${total === 1 ? '' : 's'}`
    : `${selectedOnPage.length} article${selectedOnPage.length === 1 ? '' : 's'}`;

  // The checkbox column and the action pill only exist while this is true
  const selectionActive = isSelecting || selectedCount > 0;
  const allOnPageSelected = isAllSelected(articles, selectedIds);

  // Escape leaves selection mode, the way it dismisses anything else
  useEffect(() => {
    if (!selectionActive) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        exitSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionActive, exitSelection]);

  const settle = (text, undoScope) => {
    exitSelection();
    setNotice({ text, undoScope });
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (target) => articlesApi.bulkDelete(target),
    onSuccess: (response, target) => {
      const count = response?.data?.deleted ?? 0;

      // Trashing the whole page can leave it empty, so fall back a page
      if (count >= articles.length && page > 1 && !isTrash) {
        setPage((current) => current - 1);
      }

      settle(`Moved ${count} article${count === 1 ? '' : 's'} to trash.`, target);
    },
    onError: (error) => setNotice({
      text: error?.response?.data?.message || 'Failed to delete articles.'
    }),
  });

  const restoreMutation = useMutation({
    mutationFn: (target) => articlesApi.restore(target),
    onSuccess: (response) => {
      const count = response?.data?.restored ?? 0;
      settle(`Restored ${count} article${count === 1 ? '' : 's'}.`);
    },
    onError: (error) => setNotice({
      text: error?.response?.data?.message || 'Failed to restore articles.'
    }),
  });

  const purgeMutation = useMutation({
    mutationFn: (target) => articlesApi.purge(target),
    onSuccess: (response) => {
      const count = response?.data?.purged ?? 0;
      settle(`Permanently deleted ${count} article${count === 1 ? '' : 's'}.`);
    },
    onError: (error) => setNotice({
      text: error?.response?.data?.message || 'Failed to delete articles.'
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ target, fields }) => articlesApi.bulkUpdate(target, fields),
    onSuccess: (response, { fields }) => {
      const count = response?.data?.updated ?? 0;
      const verb = fields.is_archived !== undefined ? 'Archived' : 'Favorited';
      settle(`${verb} ${count} article${count === 1 ? '' : 's'}.`);
    },
    onError: (error) => setNotice({
      text: error?.response?.data?.message || 'Failed to update articles.'
    }),
  });

  const busy = deleteMutation.isPending ||
    restoreMutation.isPending ||
    purgeMutation.isPending ||
    updateMutation.isPending;

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    // An undoable notice sticks around long enough to actually be used
    const timer = setTimeout(() => setNotice(null), notice.undoScope ? 12000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleToggleSelect = (id) => {
    setIsSelecting(true);
    setSelectedIds((previous) => toggleId(previous, id));
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((previous) => toggleAll(previous, articles.map((article) => article.id)));
  };

  // Keeps selection mode on: the pill's "Deselect all" should not close it
  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setScopeMode('page');
  };

  const handleDelete = () => {
    if (selectedCount === 0) {
      return;
    }

    if (window.confirm(`Move ${targetLabel} to trash? You can undo this.`)) {
      deleteMutation.mutate(scope);
    }
  };

  const handleRestore = () => {
    if (window.confirm(`Restore ${targetLabel}?`)) {
      restoreMutation.mutate(scope);
    }
  };

  const handlePurge = () => {
    if (window.confirm(`Permanently delete ${targetLabel}? This cannot be undone.`)) {
      purgeMutation.mutate(scope);
    }
  };

  const handleEmptyTrash = () => {
    const count = trashedTotal || total;

    if (window.confirm(`Permanently delete all ${count} trashed article${count === 1 ? '' : 's'}? This cannot be undone.`)) {
      purgeMutation.mutate({ filter: { trashed: true } });
    }
  };

  const handleArchive = () => {
    updateMutation.mutate({ target: scope, fields: { is_archived: true } });
  };

  const handleFavorite = () => {
    updateMutation.mutate({ target: scope, fields: { is_favorite: true } });
  };

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl lg:text-4xl text-gallery-900 tracking-tight mb-2">
            {isTrash ? 'Trash' : 'Library'}
          </h1>
          <p className="text-gallery-500 text-lg">
            {isTrash
              ? 'Articles here are hidden from your library until you restore them'
              : 'Your curated collection of saved articles'}
          </p>
        </div>

        {/* The only always-visible trace of bulk selection - and it stays quiet */}
        {total > 0 && !selectionActive && (
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={() => setIsSelecting(true)}
            title="Select several articles"
          >
            <CheckSquare className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Select
          </button>
        )}
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={handleSearch} />

      {/* Filters */}
      <ArticleFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Result notice, with an undo action for reversible operations */}
      {notice && (
        <div
          className="card mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-gallery-700"
          role="status"
        >
          <span>{notice.text}</span>

          {notice.undoScope && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => restoreMutation.mutate(notice.undoScope)}
              disabled={busy}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Article List */}
      <div className="mt-6">
        <ArticleList
          articles={articles}
          isLoading={articlesLoading}
          selectedIds={selectedIds}
          selectionActive={selectionActive}
          onToggleSelect={handleToggleSelect}
          emptyMessage={isTrash
            ? 'Nothing in the trash'
            : 'Use the browser extension to save your first article'}
        />
      </div>

      {/* Pagination */}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Bulk actions, floating and only while selecting */}
      <BulkActionBar
        visible={selectionActive}
        count={selectedCount}
        total={total}
        mode={scopeMode}
        isTrash={isTrash}
        isBusy={busy}
        allOnPageSelected={allOnPageSelected}
        canSelectAllMatching={canSelectAllMatching(articles, selectedIds, total)}
        onSelectAll={handleToggleSelectAll}
        onSelectAllMatching={() => setScopeMode('all')}
        onClearSelection={handleClearSelection}
        onArchive={handleArchive}
        onFavorite={handleFavorite}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onPurge={handlePurge}
        onEmptyTrash={handleEmptyTrash}
        onExit={exitSelection}
      />
    </div>
  );
}
