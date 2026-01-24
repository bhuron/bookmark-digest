import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Star,
  Archive,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { formatRelativeTime, formatReadingTime, formatWordCount } from '../../utils/format';

export default function ArticleCard({ article, index = 0 }) {
  return (
    <article
      className="group card hover:border-gallery-300 hover:shadow-gallery-md transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-6 lg:p-7">
        <div className="flex items-start gap-5">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <Link
              to={`/articles/${article.id}`}
              className="block group/link"
            >
              <h3 className="font-display font-semibold text-xl leading-snug text-gallery-900 group-hover/link:text-coral-600 transition-colors duration-200 line-clamp-2">
                {article.title}
              </h3>
            </Link>

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
            >
              <ExternalLink className="w-4 h-4" strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
