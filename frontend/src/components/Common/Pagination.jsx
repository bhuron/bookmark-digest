import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gallery-200 animate-fade-in-up">
      <div className="text-sm text-gallery-500">
        Showing <span className="font-medium text-gallery-700">{Math.min((page - 1) * limit + 1, total)}</span> to{' '}
        <span className="font-medium text-gallery-700">{Math.min(page * limit, total)}</span> of{' '}
        <span className="font-medium text-gallery-700">{total}</span> articles
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
          className={cn(
            'btn btn-secondary',
            !hasPrevPage && 'opacity-40 cursor-not-allowed hover:bg-white'
          )}
        >
          <ChevronLeft className="w-4 h-4 mr-1" strokeWidth={2.5} />
          Previous
        </button>

        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }

            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'w-10 h-10 rounded-lg text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-gallery-900 text-white shadow-gallery-sm'
                    : 'text-gallery-600 hover:text-gallery-900 hover:bg-gallery-100'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className={cn(
            'btn btn-secondary',
            !hasNextPage && 'opacity-40 cursor-not-allowed hover:bg-white'
          )}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
