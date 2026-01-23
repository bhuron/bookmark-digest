import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '../services/api';
import { Key, Check, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('bookmark_digest_api_key') || '');
  const [status, setStatus] = useState(null);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await articlesApi.getStats();
      return response.data;
    },
    enabled: !!localStorage.getItem('bookmark_digest_api_key'),
  });

  const handleSaveApiKey = () => {
    localStorage.setItem('bookmark_digest_api_key', apiKey.trim());
    setStatus('saved');
    // Invalidate stats query to trigger refetch with new API key
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('bookmark_digest_api_key');
    setApiKey('');
    setStatus('cleared');
    // Clear stats query
    queryClient.clear();
    setTimeout(() => setStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    setStatus('testing');
    try {
      const response = await articlesApi.list({ page: 1, limit: 1 });
      if (response.data && response.data.data) {
        setStatus('success');
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* API Key Section */}
      <div className="card mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2" />
            API Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key from config.json"
                className="input"
              />
              <p className="mt-2 text-sm text-gray-500">
                The API key is stored in <code className="bg-gray-100 px-1 py-0.5 rounded">backend/config.json</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSaveApiKey} className="btn btn-primary">
                Save API Key
              </button>
              {apiKey && (
                <>
                  <button onClick={handleTestConnection} className="btn btn-secondary">
                    Test Connection
                  </button>
                  <button onClick={handleClearApiKey} className="btn btn-ghost text-red-600">
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Status Messages */}
            {status === 'saved' && (
              <div className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                API key saved successfully
              </div>
            )}
            {status === 'cleared' && (
              <div className="flex items-center text-sm text-gray-600">
                <Check className="w-4 h-4 mr-1" />
                API key cleared
              </div>
            )}
            {status === 'testing' && (
              <div className="text-sm text-gray-600">Testing connection...</div>
            )}
            {status === 'success' && (
              <div className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                Connection successful
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                Connection failed. Please check your API key.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-primary-600">{stats.total_articles}</div>
                <div className="text-sm text-gray-500">Total Articles</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-600">{stats.unread_articles}</div>
                <div className="text-sm text-gray-500">Unread</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-600">{stats.favorite_articles}</div>
                <div className="text-sm text-gray-500">Favorites</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-600">{stats.archived_articles}</div>
                <div className="text-sm text-gray-500">Archived</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Browser Extension Instructions */}
      <div className="card mt-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browser Extension Setup</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Open your browser and navigate to <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">chrome://extensions</code></li>
            <li>Enable "Developer mode" in the top right</li>
            <li>Click "Load unpacked" and select the <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">extension</code> folder</li>
            <li>Click the extension icon to configure your API key</li>
            <li>Navigate to any article page and click the extension to save it</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
