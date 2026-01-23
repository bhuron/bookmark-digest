import { useState } from 'react';
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
  Tag,
  X,
} from 'lucide-react';
import { articlesApi } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import { formatRelativeTime, formatReadingTime, formatWordCount } from '../../utils/format';

export default function ArticleViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

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
  });

  const deleteMutation = useMutation({
    mutationFn: () => articlesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate('/');
    },
  });

  const addTagMutation = useMutation({
    mutationFn: (tags) => articlesApi.addTags(id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      setNewTag('');
      setShowTagInput(false);
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId) => articlesApi.removeTag(id, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
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

  const handleAddTag = (e) => {
    e.preventDefault();
    if (newTag.trim()) {
      addTagMutation.mutate({ tags: [newTag.trim()] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Article not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to articles
        </button>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 flex-1">{article.title}</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors ${
                article.is_favorite
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={article.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className="w-5 h-5" fill={article.is_favorite ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={handleToggleArchive}
              className={`p-2 rounded-lg transition-colors ${
                article.is_archived
                  ? 'bg-gray-200 text-gray-600'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={article.is_archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-5 h-5" />
            </button>

            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Open original"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
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
          {article.author && <span>By {article.author}</span>}
          {article.site_name && <span>{article.site_name}</span>}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Tag className="w-4 h-4 text-gray-400" />
          <div className="flex flex-wrap gap-2">
            {article.tags?.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium group"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                }}
              >
                {tag.name}
                <button
                  onClick={() => removeTagMutation.mutate(tag.id)}
                  className="opacity-0 group-hover:opacity-100 hover:opacity-80 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            + Add tag
          </button>
        </div>

        {showTagInput && (
          <form onSubmit={handleAddTag} className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag name..."
              className="input flex-1"
              autoFocus
            />
            <button type="submit" className="btn btn-primary">
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTagInput(false);
                setNewTag('');
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Content */}
      <div className="card">
        {article.excerpt && (
          <div className="p-6 border-b border-gray-200">
            <p className="text-lg text-gray-600 italic">{article.excerpt}</p>
          </div>
        )}

        <div
          className="p-6 prose prose-gray max-w-none prose-lg prose-headings:font-semibold prose-a:text-primary-600"
          dangerouslySetInnerHTML={{ __html: article.content_html }}
        />
      </div>
    </div>
  );
}
