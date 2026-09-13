import { Trash2, X } from 'lucide-react';

export default function BulkActionBar({ count, onDelete, onClear, isDeleting = false }) {
  if (count === 0) {
    return null;
  }

  const label = `${count} article${count === 1 ? '' : 's'} selected`;

  return (
    <div className="sticky bottom-6 z-20 mt-6 animate-fade-in-up">
      <div className="card flex items-center justify-between gap-4 px-5 py-4 shadow-gallery-md">
        <span className="text-sm font-semibold text-gallery-800" role="status">
          {label}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClear}
            disabled={isDeleting}
          >
            <X className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Clear
          </button>

          <button
            type="button"
            className="btn btn-coral"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-1.5" strokeWidth={2} />
            {isDeleting ? 'Deleting...' : `Delete ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
