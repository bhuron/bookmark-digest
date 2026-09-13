import { Archive, Flame, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Shared look for the round icon buttons inside the pill */
function buttonClass(tone = 'default') {
  return cn(
    'p-2.5 rounded-full transition-colors duration-200',
    'disabled:opacity-40 disabled:pointer-events-none',
    tone === 'danger'
      ? 'text-gallery-500 hover:text-white hover:bg-coral-500'
      : 'text-gallery-500 hover:text-gallery-900 hover:bg-gallery-100'
  );
}

/**
 * Bulk actions, as a single floating pill.
 *
 * It only exists while a selection is being made, and it carries the selection
 * count, the "select all" affordance and the actions - so the list itself stays
 * free of permanent chrome.
 */
export default function BulkActionBar({
  visible = false,
  count = 0,
  total = 0,
  mode = 'page',
  isTrash = false,
  isBusy = false,
  allOnPageSelected = false,
  canSelectAllMatching = false,
  onSelectAll,
  onSelectAllMatching,
  onClearSelection,
  onArchive,
  onFavorite,
  onDelete,
  onRestore,
  onPurge,
  onEmptyTrash,
  onExit,
}) {
  if (!visible) {
    return null;
  }

  const label = mode === 'all'
    ? `All ${total} matching selected`
    : count === 0
      ? 'Select articles'
      : `${count} selected`;

  // One control that offers the widest selection the current view allows
  let selectAction = null;

  if (mode !== 'all') {
    if (!allOnPageSelected) {
      selectAction = { text: 'Select all', run: onSelectAll };
    } else if (canSelectAllMatching) {
      selectAction = { text: `Select all ${total} matching`, run: onSelectAllMatching };
    } else {
      selectAction = { text: 'Deselect all', run: onClearSelection };
    }
  }

  const nothingSelected = count === 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-full border border-gallery-200/80 bg-white/85 p-1.5 pl-4 shadow-gallery-lg backdrop-blur-md animate-fade-in-up">
        <span className="whitespace-nowrap text-sm font-semibold text-gallery-800" role="status">
          {label}
        </span>

        {selectAction && (
          <button
            type="button"
            onClick={selectAction.run}
            disabled={isBusy}
            className="ml-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-coral-600 transition-colors duration-200 hover:bg-coral-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            {selectAction.text}
          </button>
        )}

        <span className="mx-1.5 h-5 w-px bg-gallery-200" aria-hidden="true" />

        {isTrash ? (
          <>
            <button
              type="button"
              className={buttonClass()}
              onClick={onRestore}
              disabled={isBusy || nothingSelected}
              title="Restore"
              aria-label="Restore selected articles"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              className={buttonClass()}
              onClick={onEmptyTrash}
              disabled={isBusy}
              title="Empty trash"
              aria-label="Permanently delete everything in the trash"
            >
              <Flame className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              className={buttonClass('danger')}
              onClick={onPurge}
              disabled={isBusy || nothingSelected}
              title="Delete forever"
              aria-label="Permanently delete selected articles"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={buttonClass()}
              onClick={onArchive}
              disabled={isBusy || nothingSelected}
              title="Archive"
              aria-label="Archive selected articles"
            >
              <Archive className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              className={buttonClass()}
              onClick={onFavorite}
              disabled={isBusy || nothingSelected}
              title="Favorite"
              aria-label="Favorite selected articles"
            >
              <Star className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              className={buttonClass('danger')}
              onClick={onDelete}
              disabled={isBusy || nothingSelected}
              title="Delete"
              aria-label="Move selected articles to the trash"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
            </button>
          </>
        )}

        <span className="mx-1.5 h-5 w-px bg-gallery-200" aria-hidden="true" />

        <button
          type="button"
          className={buttonClass()}
          onClick={onExit}
          disabled={isBusy}
          title="Done"
          aria-label="Leave selection mode"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
