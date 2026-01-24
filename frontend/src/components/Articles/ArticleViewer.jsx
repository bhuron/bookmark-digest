import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  ExternalLink,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react';
import { articlesApi } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import { formatRelativeTime, formatReadingTime, formatWordCount } from '../../utils/format';

export default function ArticleViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', id],
    queryFn: () => articlesApi.get(id).then((res) => res.data.article),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => articlesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => console.error('Failed to update article:', error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => articlesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate('/');
    },
    onError: (error) => console.error('Failed to delete article:', error),
  });

  const handleToggleFavorite = () => {
    updateMutation.mutate({ is_favorite: !article?.is_favorite });
  };

  const handleToggleArchive = () => {
    updateMutation.mutate({ is_archived: !article?.is_archived });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this article?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gallery-100 mb-5">
          <svg className="w-8 h-8 text-gallery-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-gallery-900 font-semibold text-lg">Article not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gallery-600 hover:text-gallery-900 transition-colors duration-200 mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" strokeWidth={2.5} />
        <span className="font-medium">Back to library</span>
      </button>

      {/* Article Header */}
      <div className="mb-10">
        {/* Title */}
        <h1 className="font-display font-bold text-3xl lg:text-4xl text-gallery-900 leading-tight tracking-tight mb-6">
          {article.title}
        </h1>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-sm text-gallery-600 pb-6 border-b border-gallery-200">
          {article.author && (
            <span className="font-semibold text-gallery-800">
              {article.author}
            </span>
          )}
          {article.site_name && (
            <>
              {article.author && <span className="text-gallery-300">·</span>}
              <span>{article.site_name}</span>
            </>
          )}
          {article.created_at && (
            <>
              <span className="text-gallery-300">·</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                {formatRelativeTime(article.created_at)}
              </span>
            </>
          )}
          {article.reading_time_minutes && (
            <>
              <span className="text-gallery-300">·</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                {formatReadingTime(article.reading_time_minutes)}
              </span>
            </>
          )}
          {article.word_count && (
            <>
              <span className="text-gallery-300">·</span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" strokeWidth={2} />
                {formatWordCount(article.word_count)}
              </span>
            </>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mt-6">
          {/* Status Badges */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`btn-icon ${article.is_favorite ? 'btn-icon-active' : ''}`}
              title={article.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={article.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className="w-5 h-5" fill={article.is_favorite ? 'currentColor' : 'none'} strokeWidth={2} />
            </button>

            <button
              onClick={handleToggleArchive}
              className={`btn-icon ${article.is_archived ? 'bg-gallery-100' : ''}`}
              title={article.is_archived ? 'Unarchive' : 'Archive'}
              aria-label={article.is_archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-5 h-5" strokeWidth={2} />
            </button>

            <button
              onClick={handleDelete}
              className="btn-icon hover:text-red-600 hover:bg-red-50"
              title="Delete"
              aria-label="Delete article"
            >
              <Trash2 className="w-5 h-5" strokeWidth={2} />
            </button>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="Open original"
              aria-label="Open original article"
            >
              <ExternalLink className="w-5 h-5" strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="card p-8 lg:p-12 shadow-gallery-sm">
        {article.excerpt && (
          <div className="mb-8 pb-8 border-b border-gallery-200">
            <p className="text-xl text-gallery-600 leading-relaxed italic font-serif">
              {article.excerpt}
            </p>
          </div>
        )}

        <div
          className="prose prose-gallery max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content_html }}
        />
      </article>
    </div>
  );
}
