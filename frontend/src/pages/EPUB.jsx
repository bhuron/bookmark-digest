import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articlesApi, epubApi } from '../services/api';
import { Book, Download, Mail, Check, AlertCircle, Loader } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function EPUB() {
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [epubTitle, setEpubTitle] = useState('');
  const [page, setPage] = useState(1); // eslint-disable-line no-unused-vars
  const [limit, setLimit] = useState(20); // eslint-disable-line no-unused-vars
  const queryClient = useQueryClient();

  // Fetch articles with pagination
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', 'epub', page, limit],
    queryFn: async () => {
      const response = await articlesApi.list({ page, limit });
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
  const _totalArticles = articlesData?.data?.total || 0; // eslint-disable-line no-unused-vars
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
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <Book className="w-6 h-6 mr-2" />
        EPUB Generation
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Article selection */}
        <div>
          <div className="card mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Articles ({selectedArticles.size} selected)
              </h2>

              <div className="mb-4">
                <label htmlFor="epubTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  EPUB Title (optional)
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

              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={selectAllArticles}
                  className="btn btn-ghost text-sm"
                >
                  {selectedArticles.size === articles.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-500">
                  {articles.length} articles
                </span>
              </div>

              {articlesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : articles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No articles found. Save some articles first!
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {articles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedArticles.has(article.id)}
                        onChange={() => toggleArticleSelection(article.id)}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {article.title}
                        </div>
                         <div className="text-xs text-gray-500">
                           {article.site_name || getHostname(article.url)}
                           {article.word_count && ` • ${article.word_count} words`}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={handleGenerateEpub}
                  disabled={generateEpubMutation.isPending || selectedArticles.size === 0}
                  className="btn btn-primary w-full"
                >
                  {generateEpubMutation.isPending ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Book className="w-4 h-4 mr-2" />
                      Generate EPUB ({selectedArticles.size} articles)
                    </>
                  )}
                </button>
                {generateEpubMutation.isError && (
                  <div className="mt-2 flex items-center text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Failed to generate EPUB: {generateEpubMutation.error.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Export history */}
        <div>
          <div className="card">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Export History
              </h2>

              {exportsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : exports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No EPUB exports yet. Generate your first EPUB!
                </div>
              ) : (
                <div className="space-y-4">
                  {exports.map((exportItem) => (
                    <div key={exportItem.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {exportItem.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created {formatDistanceToNow(new Date(exportItem.created_at), { addSuffix: true })}
                            {exportItem.article_count && ` • ${exportItem.article_count} articles`}
                            {exportItem.file_size && ` • ${Math.round(exportItem.file_size / 1024 / 1024 * 100) / 100} MB`}
                          </div>
                          <div className="mt-2">
                            {exportItem.sent_to_kindle ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Check className="w-3 h-3 mr-1" />
                                Sent to Kindle
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Not sent
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleDownloadEpub(exportItem.id)}
                            disabled={downloadEpubMutation.isPending}
                            className="btn btn-ghost btn-sm"
                            title="Download EPUB"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendToKindle(exportItem.id)}
                            disabled={sendToKindleMutation.isPending || exportItem.sent_to_kindle}
                            className="btn btn-ghost btn-sm"
                            title="Send to Kindle"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExport(exportItem.id)}
                            className="btn btn-ghost btn-sm text-red-600"
                            title="Delete"
                          >
                            &times;
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
    </div>
  );
}