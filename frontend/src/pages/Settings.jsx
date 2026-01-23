import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { articlesApi, settingsApi } from '../services/api';
import { Key, Check, AlertCircle, Mail } from 'lucide-react';

export default function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('bookmark_digest_api_key') || '');
  const [status, setStatus] = useState(null);
  const [smtpSettings, setSmtpSettings] = useState({
    kindleEmail: '',
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: 'false',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: ''
  });
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await articlesApi.getStats();
      return response.data;
    },
    enabled: !!localStorage.getItem('bookmark_digest_api_key'),
  });

  const { data: _settings } = useQuery({ // eslint-disable-line no-unused-vars
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsApi.get();
      return response.data.settings;
    },
    enabled: !!localStorage.getItem('bookmark_digest_api_key'),
    onSuccess: (data) => {
      if (data) {
        setSmtpSettings({
          kindleEmail: data.KINDLE_EMAIL || '',
          smtpHost: data.SMTP_HOST || '',
          smtpPort: data.SMTP_PORT || '587',
          smtpSecure: data.SMTP_SECURE === 'true' ? 'true' : 'false',
          smtpUser: data.SMTP_USER || '',
          smtpPassword: '',
          fromEmail: data.FROM_EMAIL || ''
        });
      }
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStatus('smtp-saved');
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (error) => {
      console.error('Failed to update SMTP settings:', error);
      setStatus('smtp-error');
      setTimeout(() => setStatus(null), 3000);
    }
  });

  const testSmtpMutation = useMutation({
    mutationFn: () => settingsApi.testSmtp(),
    onSuccess: () => {
      setStatus('smtp-test-success');
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (error) => {
      console.error('SMTP test failed:', error);
      setStatus('smtp-test-error');
      setTimeout(() => setStatus(null), 3000);
    }
  });

  const handleSaveSmtpSettings = () => {
    updateSettingsMutation.mutate(smtpSettings);
  };

  const handleTestSmtp = () => {
    testSmtpMutation.mutate();
  };

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

      {/* SMTP Settings Section */}
      <div className="card mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Kindle Email Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="kindleEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Kindle Email Address
              </label>
              <input
                id="kindleEmail"
                type="email"
                value={smtpSettings.kindleEmail}
                onChange={(e) => setSmtpSettings({...smtpSettings, kindleEmail: e.target.value})}
                placeholder="your_kindle_email@kindle.com"
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Host
                </label>
                <input
                  id="smtpHost"
                  type="text"
                  value={smtpSettings.smtpHost}
                  onChange={(e) => setSmtpSettings({...smtpSettings, smtpHost: e.target.value})}
                  placeholder="smtp.gmail.com"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Port
                </label>
                <input
                  id="smtpPort"
                  type="number"
                  value={smtpSettings.smtpPort}
                  onChange={(e) => setSmtpSettings({...smtpSettings, smtpPort: e.target.value})}
                  placeholder="587"
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Username
                </label>
                <input
                  id="smtpUser"
                  type="text"
                  value={smtpSettings.smtpUser}
                  onChange={(e) => setSmtpSettings({...smtpSettings, smtpUser: e.target.value})}
                  placeholder="your_email@gmail.com"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Password
                </label>
                <input
                  id="smtpPassword"
                  type="password"
                  value={smtpSettings.smtpPassword}
                  onChange={(e) => setSmtpSettings({...smtpSettings, smtpPassword: e.target.value})}
                  placeholder="Your SMTP password"
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  From Email (Optional)
                </label>
                <input
                  id="fromEmail"
                  type="email"
                  value={smtpSettings.fromEmail}
                  onChange={(e) => setSmtpSettings({...smtpSettings, fromEmail: e.target.value})}
                  placeholder="sender@example.com"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="smtpSecure" className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Secure
                </label>
                <select
                  id="smtpSecure"
                  value={smtpSettings.smtpSecure}
                  onChange={(e) => setSmtpSettings({...smtpSettings, smtpSecure: e.target.value})}
                  className="input"
                >
                  <option value="false">False (STARTTLS)</option>
                  <option value="true">True (SSL/TLS)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSmtpSettings}
                disabled={updateSettingsMutation.isPending}
                className="btn btn-primary"
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save SMTP Settings'}
              </button>
              <button
                onClick={handleTestSmtp}
                disabled={testSmtpMutation.isPending}
                className="btn btn-secondary"
              >
                {testSmtpMutation.isPending ? 'Testing...' : 'Test SMTP Connection'}
              </button>
            </div>

            {/* SMTP Status Messages */}
            {status === 'smtp-saved' && (
              <div className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                SMTP settings saved successfully
              </div>
            )}
            {status === 'smtp-error' && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                Failed to save SMTP settings
              </div>
            )}
            {status === 'smtp-test-success' && (
              <div className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                SMTP connection test successful
              </div>
            )}
            {status === 'smtp-test-error' && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                SMTP connection test failed
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
             <li>Enable &quot;Developer mode&quot; in the top right</li>
             <li>Click &quot;Load unpacked&quot; and select the <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">extension</code> folder</li>
            <li>Click the extension icon to configure your API key</li>
            <li>Navigate to any article page and click the extension to save it</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
