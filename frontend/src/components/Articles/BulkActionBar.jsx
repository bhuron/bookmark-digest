import { Archive, Flame, RotateCcw, Star, Trash2, X } from 'lucide-react';

export default function BulkActionBar({
  count,
  total,
  mode = 'page',
  isTrash = false,
  isBusy = false,
  canSelectAllMatching = false,
  onSelectAllMatching,
  onArchive,
  onFavorite,
  onDelete,
  onRestore,
  onPurge,
  onEmptyTrash,
  onClear,
}) {
  if (count === 0) {
    return null;
  }

  const label = mode === 'all'
    ? `All ${total} matching article${total === 1 ? '' : 's'} selected`
    : `${count} article${count === 1 ? '' : 's'} selected`;

  return (
    <div className="sticky bottom-6 z-20 mt-6 animate-fade-in-up">
      <div className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4 shadow-gallery-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gallery-800" role="status">
            {label}
          </span>

          {canSelectAllMatching && mode !== 'all' && (
            <button
              type="button"
              className="text-sm font-semibold text-coral-600 hover:text-coral-700 underline"
              onClick={onSelectAllMatching}
              disabled={isBusy}
            >
              Select all {total} matching
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isTrash ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onRestore} disabled={isBusy}>
                <RotateCcw className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Restore
              </button>

              <button type="button" className="btn btn-secondary" onClick={onEmptyTrash} disabled={isBusy}>
                <Flame className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Empty trash
              </button>

              <button type="button" className="btn btn-coral" onClick={onPurge} disabled={isBusy}>
                <Trash2 className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Delete forever
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={onArchive} disabled={isBusy}>
                <Archive className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Archive
              </button>

              <button type="button" className="btn btn-secondary" onClick={onFavorite} disabled={isBusy}>
                <Star className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Favorite
              </button>

              <button type="button" className="btn btn-coral" onClick={onDelete} disabled={isBusy}>
                <Trash2 className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Delete
              </button>
            </>
          )}

          <button type="button" className="btn btn-ghost" onClick={onClear} disabled={isBusy}>
            <X className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
