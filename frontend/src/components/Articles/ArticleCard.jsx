import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Star,
  Archive,
  ExternalLink,
  FileText,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime, formatReadingTime, formatWordCount } from '../../utils/format';
import { cn } from '../../utils/cn';

export default function ArticleCard({
  article,
  index = 0,
  isSelected = false,
  selectionActive = false,
  onToggleSelect,
}) {
  const selectable = Boolean(onToggleSelect);
  // While selecting, the whole card toggles, so the title stops being a link
  const handleCardClick = selectable && selectionActive
    ? () => onToggleSelect(article.id)
    : undefined;

  return (
    <article
      onClick={handleCardClick}
      className={cn(
        'group card transition-all duration-300 animate-fade-in-up',
        isSelected
          ? 'border-coral-400 shadow-coral-sm ring-1 ring-coral-300'
          : 'hover:border-gallery-300 hover:shadow-gallery-md',
        handleCardClick && 'cursor-pointer'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-6 lg:p-7">
        <div className="flex items-start gap-5">
          {/* Invisible until it is useful: on hover, on keyboard focus, or once
              selection mode is on */}
          {selectable && (
            <label
              className={cn(
                'flex items-center pt-1 cursor-pointer transition-opacity duration-200',
                isSelected || selectionActive
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gallery-300 text-coral-500 cursor-pointer focus:ring-coral-500"
                checked={isSelected}
                onChange={() => onToggleSelect(article.id)}
                aria-label={`Select "${article.title}"`}
              />
            </label>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Not a link while selecting, and never for a trashed article */}
            {article.is_trashed || selectionActive ? (
              <h3
                className={cn(
                  'font-display font-semibold text-xl leading-snug line-clamp-2',
                  article.is_trashed ? 'text-gallery-500' : 'text-gallery-900'
                )}
              >
                {article.title}
              </h3>
            ) : (
              <Link
                to={`/articles/${article.id}`}
                className="block group/link"
              >
                <h3 className="font-display font-semibold text-xl leading-snug text-gallery-900 group-hover/link:text-coral-600 transition-colors duration-200 line-clamp-2">
                  {article.title}
                </h3>
              </Link>
            )}

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 mt-3.5 text-sm text-gallery-500">
              {article.author && (
                <span className="font-medium text-gallery-700">
                  {article.author}
                </span>
              )}
              {article.site_name && (
                <>
                  {article.author && <span className="text-gallery-300">·</span>}
                  <span className="text-gallery-600">{article.site_name}</span>
                </>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gallery-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{formatRelativeTime(article.created_at)}</span>
              </span>
              {article.reading_time_minutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{formatReadingTime(article.reading_time_minutes)}</span>
                </span>
              )}
              {article.word_count && (
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{formatWordCount(article.word_count)}</span>
                </span>
              )}
            </div>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="mt-4 text-gallery-600 leading-relaxed line-clamp-2 text-balance">
                {article.excerpt}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            {article.is_trashed && (
              <div className="badge badge-default">
                <Trash2 className="w-3 h-3 mr-1" strokeWidth={2.5} />
                In trash
              </div>
            )}
            {article.is_favorite && (
              <div className="badge badge-coral">
                <Star className="w-3 h-3 mr-1 fill-current" strokeWidth={2.5} />
                Favorite
              </div>
            )}
            {article.is_archived && (
              <div className="badge badge-default">
                <Archive className="w-3 h-3 mr-1" strokeWidth={2.5} />
                Archived
              </div>
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="Open original"
              aria-label="Open original article"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
