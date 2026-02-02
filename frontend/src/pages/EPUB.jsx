import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articlesApi, epubApi } from '../services/api';
import { Book, Download, Mail, Check, AlertCircle, Loader } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function EPUB() {
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [epubTitle, setEpubTitle] = useState('');
  const queryClient = useQueryClient();

  // Fetch all articles for EPUB selection (max 100, backend limit)
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', 'epub'],
    queryFn: async () => {
      const response = await articlesApi.list({ limit: 100 });
      return response.data;
    },
    enabled: !!localStorage.getItem('bookmark_digest_api_key'),
  });

  // Fetch EPUB exports
  const { data: exportsData, isLoading: exportsLoading } = useQuery({
    queryKey: ['epub-exports'],
    queryFn: async () => {
      const response = await epubApi.listExports();
      return response.data.exports;
    },
    enabled: !!localStorage.getItem('bookmark_digest_api_key'),
  });

  // Generate EPUB mutation
  const generateEpubMutation = useMutation({
    mutationFn: (data) => epubApi.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epub-exports'] });
      setSelectedArticles(new Set());
      setEpubTitle('');
    },
  });

  // Send to Kindle mutation
  const sendToKindleMutation = useMutation({
    mutationFn: (exportId) => epubApi.sendToKindle(exportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epub-exports'] });
    },
  });

  // Download EPUB mutation
  const downloadEpubMutation = useMutation({
    mutationFn: async (exportId) => {
      const response = await epubApi.downloadExport(exportId);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmark-digest-${exportId}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });

  const articles = articlesData?.data?.articles || [];
  const _totalArticles = articlesData?.data?.total || 0;
  const exports = exportsData || [];

  const toggleArticleSelection = (articleId) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId);
    } else {
      newSelected.add(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const getHostname = (url) => {
    if (!url) return 'Unknown source';
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown source';
    }
  };

  const selectAllArticles = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      const allIds = articles.map(article => article.id);
      setSelectedArticles(new Set(allIds));
    }
  };

  const handleGenerateEpub = () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article');
      return;
    }
    generateEpubMutation.mutate({
      articleIds: Array.from(selectedArticles),
      title: epubTitle || `Bookmark Digest - ${new Date().toLocaleDateString()}`
    });
  };

  const handleSendToKindle = (exportId) => {
    if (!confirm('Send this EPUB to your Kindle? This will email the file to your configured Kindle address.')) {
      return;
    }
    sendToKindleMutation.mutate(exportId);
  };

  const handleDownloadEpub = (exportId) => {
    downloadEpubMutation.mutate(exportId);
  };

  const handleDeleteExport = async (exportId) => {
    if (!confirm('Delete this EPUB export? The file will be removed from disk.')) {
      return;
    }
    try {
      await epubApi.deleteExport(exportId);
      queryClient.invalidateQueries({ queryKey: ['epub-exports'] });
    } catch (error) {
      console.error('Failed to delete export:', error);
      alert('Failed to delete export');
    }
  };

  return (
    <div className="max-w-6xl animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl lg:text-4xl text-gallery-900 tracking-tight mb-2">
          EPUB Generation
        </h1>
        <p className="text-gallery-500 text-lg">
          Create beautiful ebooks from your saved articles
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Article selection */}
        <div className="space-y-6">
          {/* Selection Card */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-xl text-gallery-900">
                Select Articles
              </h2>
              <span className="badge badge-default">
                {selectedArticles.size} selected
              </span>
            </div>

            {/* EPUB Title Input */}
            <div className="mb-5">
              <label htmlFor="epubTitle" className="block text-sm font-semibold text-gallery-700 mb-2">
                EPUB Title <span className="text-gallery-400 font-normal">(optional)</span>
              </label>
              <input
                id="epubTitle"
                type="text"
                value={epubTitle}
                onChange={(e) => setEpubTitle(e.target.value)}
                placeholder="My Reading Digest"
                className="input"
              />
            </div>

            {/* Select All Button */}
            <div className="flex items-center justify-between mb-5 pb-5 border-b border-gallery-200">
              <button
                onClick={selectAllArticles}
                className="btn btn-ghost text-sm"
              >
                {selectedArticles.size === articles.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gallery-500">
                {articles.length} articles
              </span>
            </div>

            {/* Article List */}
            {articlesLoading ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 animate-spin text-gallery-400" strokeWidth={2} />
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gallery-100 mb-3">
                  <Book className="w-6 h-6 text-gallery-400" strokeWidth={2} />
                </div>
                <p className="text-gallery-500 text-sm">No articles found. Save some articles first!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center gap-3 p-3 border border-gallery-200 rounded-lg hover:border-gallery-300 hover:bg-gallery-50/50 transition-all duration-200 cursor-pointer"
                    onClick={() => toggleArticleSelection(article.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedArticles.has(article.id)}
                      onChange={() => toggleArticleSelection(article.id)}
                      className="h-4 w-4 text-coral-500 rounded focus:ring-coral-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gallery-900 truncate">
                        {article.title}
                      </div>
                      <div className="text-xs text-gallery-500 mt-0.5">
                        {article.site_name || getHostname(article.url)}
                        {article.word_count && (
                          <span> • {article.word_count} words</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-6 pt-6 border-t border-gallery-200">
              <button
                onClick={handleGenerateEpub}
                disabled={generateEpubMutation.isPending || selectedArticles.size === 0}
                className="btn btn-coral w-full"
              >
                {generateEpubMutation.isPending ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Book className="w-4 h-4 mr-2" strokeWidth={2} />
                    Generate EPUB
                  </>
                )}
              </button>
              {generateEpubMutation.isError && (
                <div className="mt-3 flex items-center text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" strokeWidth={2} />
                  <span>Failed to generate EPUB: {generateEpubMutation.error.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Export history */}
        <div>
          <div className="card p-6">
            <h2 className="font-display font-semibold text-xl text-gallery-900 mb-5">
              Export History
            </h2>

            {exportsLoading ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 animate-spin text-gallery-400" strokeWidth={2} />
              </div>
            ) : exports.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gallery-100 mb-3">
                  <Download className="w-6 h-6 text-gallery-400" strokeWidth={2} />
                </div>
                <p className="text-gallery-500 text-sm">No EPUB exports yet. Generate your first EPUB!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {exports.map((exportItem) => (
                  <div key={exportItem.id} className="border border-gallery-200 rounded-xl p-5 hover:border-gallery-300 transition-colors duration-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gallery-900 truncate mb-1">
                          {exportItem.name}
                        </div>
                        <div className="text-xs text-gallery-500 mb-3">
                          Created {formatDistanceToNow(new Date(exportItem.created_at), { addSuffix: true })}
                          {exportItem.article_count && (
                            <span> • {exportItem.article_count} articles</span>
                          )}
                          {exportItem.file_size && (
                            <span> • {Math.round(exportItem.file_size / 1024 / 1024 * 100) / 100} MB</span>
                          )}
                        </div>
                        <div>
                          {exportItem.sent_to_kindle ? (
                            <span className="badge badge-success">
                              <Check className="w-3 h-3 mr-1 fill-current" strokeWidth={2.5} />
                              Sent to Kindle
                            </span>
                          ) : (
                            <span className="badge badge-default">Not sent</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadEpub(exportItem.id)}
                          disabled={downloadEpubMutation.isPending}
                          className="btn-icon"
                          title="Download EPUB"
                          aria-label="Download EPUB"
                        >
                          <Download className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => handleSendToKindle(exportItem.id)}
                          disabled={sendToKindleMutation.isPending || exportItem.sent_to_kindle}
                          className="btn-icon"
                          title="Send to Kindle"
                          aria-label="Send to Kindle"
                        >
                          <Mail className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => handleDeleteExport(exportItem.id)}
                          className="btn-icon hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                          aria-label="Delete export"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
