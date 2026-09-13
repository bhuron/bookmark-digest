import { useEffect, useRef } from 'react';
import LoadingSpinner from '../Common/LoadingSpinner';
import ArticleCard from './ArticleCard';
import { isAllSelected, isPartiallySelected, selectedVisibleIds } from '../../utils/selection';

export default function ArticleList({
  articles = [],
  isLoading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  emptyMessage,
}) {
  const selectAllRef = useRef(null);

  const selectable = Boolean(onToggleSelect) && Boolean(selectedIds);
  const selectedCount = selectable ? selectedVisibleIds(articles, selectedIds).length : 0;
  const allSelected = selectable && isAllSelected(articles, selectedIds);
  const someSelected = selectable && isPartiallySelected(articles, selectedIds);

  // "Indeterminate" is a DOM-only property, so it can't be set via JSX
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gallery-100 mb-5">
          <svg className="w-8 h-8 text-gallery-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-gallery-900 font-semibold text-lg mb-2">No articles found</p>
        <p className="text-gallery-500 text-sm">
          {emptyMessage || 'Use the browser extension to save your first article'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectable && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm font-medium text-gallery-600 hover:text-gallery-900 transition-colors duration-200">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="w-4 h-4 rounded border-gallery-300 text-coral-500 cursor-pointer focus:ring-coral-500"
              checked={allSelected}
              onChange={onToggleSelectAll}
            />
            {allSelected ? 'Deselect all' : 'Select all'}
          </label>

          {selectedCount > 0 && (
            <span className="text-sm text-gallery-500">
              {selectedCount} of {articles.length} selected on this page
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {articles.map((article, index) => (
          <ArticleCard
            key={article.id}
            article={article}
            index={index}
            isSelected={selectable && selectedIds.has(article.id)}
            onToggleSelect={selectable ? onToggleSelect : undefined}
          />
        ))}
      </div>
    </div>
  );
}
