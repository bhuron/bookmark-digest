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
import { cn } from '../../utils/cn';

export default function ArticleCard({ article }) {
  return (
    <article className="card hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              to={`/articles/${article.id}`}
              className="text-xl font-semibold text-gray-900 hover:text-primary-600 transition-colors line-clamp-2"
            >
              {article.title}
            </Link>

            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatRelativeTime(article.created_at)}
              </span>
              {article.reading_time_minutes && (
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatReadingTime(article.reading_time_minutes)}
                </span>
              )}
              {article.word_count && (
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  {formatWordCount(article.word_count)}
                </span>
              )}
            </div>

            {article.excerpt && (
              <p className="mt-3 text-gray-600 line-clamp-2">{article.excerpt}</p>
            )}

            {article.author && (
              <p className="mt-2 text-sm text-gray-500">By {article.author}</p>
            )}

            {article.site_name && (
              <p className="text-sm text-gray-500">{article.site_name}</p>
            )}

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {article.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {article.is_favorite && (
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            )}
            {article.is_archived && (
              <Archive className="w-5 h-5 text-gray-400" />
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Open original"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
