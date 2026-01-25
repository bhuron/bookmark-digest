import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { articlesApi, settingsApi } from '../services/api';
import { Key, Check, AlertCircle, Mail, BarChart3 } from 'lucide-react';

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

  const { data: _settings } = useQuery({
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
    // Remove empty strings from optional fields
    const cleanedSettings = { ...smtpSettings };
    if (!cleanedSettings.fromEmail.trim()) {
      delete cleanedSettings.fromEmail;
    }
    updateSettingsMutation.mutate(cleanedSettings);
  };

  const handleTestSmtp = () => {
    testSmtpMutation.mutate();
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('bookmark_digest_api_key', apiKey.trim());
    setStatus('saved');
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('bookmark_digest_api_key');
    setApiKey('');
    setStatus('cleared');
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
    <div className="max-w-3xl animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl lg:text-4xl text-gallery-900 tracking-tight mb-2">
          Settings
        </h1>
        <p className="text-gallery-500 text-lg">
          Configure your application preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* API Key Section */}
        <div className="card">
          <div className="p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gallery-100 rounded-lg p-2.5">
                <Key className="w-5 h-5 text-gallery-700" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-display font-semibold text-xl text-gallery-900">
                  API Configuration
                </h2>
                <p className="text-sm text-gallery-500 mt-0.5">
                  Connect to your backend server
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-semibold text-gallery-700 mb-2">
                  API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="input font-mono text-sm"
                />
                <p className="mt-2 text-sm text-gallery-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gallery-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.5L9 21m0 0l-4.5-4.5M9 21V9a2.25 2.25 0 012.25-2.25h5.25A2.25 2.25 0 0118.5 9v12" />
                  </svg>
                  Found in <code className="bg-gallery-100 px-2 py-0.5 rounded text-xs font-mono text-gallery-700">backend/config.json</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleSaveApiKey} className="btn btn-primary">
                  Save API Key
                </button>
                {apiKey && (
                  <>
                    <button onClick={handleTestConnection} className="btn btn-secondary">
                      {status === 'testing' ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button onClick={handleClearApiKey} className="btn btn-ghost text-red-600">
                      Clear
                    </button>
                  </>
                )}
              </div>

              {/* Status Messages */}
              {status === 'saved' && (
                <div className="flex items-center text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2.5} />
                  <span>API key saved successfully</span>
                </div>
              )}
              {status === 'cleared' && (
                <div className="flex items-center text-sm text-gallery-700 bg-gallery-100 px-4 py-3 rounded-lg">
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2.5} />
                  <span>API key cleared</span>
                </div>
              )}
              {status === 'success' && (
                <div className="flex items-center text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2.5} />
                  <span>Connection successful! Your API key is working.</span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2} />
                  <span>Connection failed. Please check your API key.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SMTP Settings Section */}
        <div className="card">
          <div className="p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gallery-100 rounded-lg p-2.5">
                <Mail className="w-5 h-5 text-gallery-700" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-display font-semibold text-xl text-gallery-900">
                  Kindle Email Configuration
                </h2>
                <p className="text-sm text-gallery-500 mt-0.5">
                  Send EPUBs directly to your Kindle
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="kindleEmail" className="block text-sm font-semibold text-gallery-700 mb-2">
                    Kindle Email Address
                  </label>
                  <input
                    id="kindleEmail"
                    type="email"
                    value={smtpSettings.kindleEmail}
                    onChange={(e) => setSmtpSettings({...smtpSettings, kindleEmail: e.target.value})}
                    placeholder="your_kindle@kindle.com"
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="smtpHost" className="block text-sm font-semibold text-gallery-700 mb-2">
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
                  <label htmlFor="smtpPort" className="block text-sm font-semibold text-gallery-700 mb-2">
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

                <div>
                  <label htmlFor="smtpSecure" className="block text-sm font-semibold text-gallery-700 mb-2">
                    Security
                  </label>
                  <select
                    id="smtpSecure"
                    value={smtpSettings.smtpSecure}
                    onChange={(e) => setSmtpSettings({...smtpSettings, smtpSecure: e.target.value})}
                    className="input"
                  >
                    <option value="false">STARTTLS</option>
                    <option value="true">SSL/TLS</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="smtpUser" className="block text-sm font-semibold text-gallery-700 mb-2">
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
                  <label htmlFor="smtpPassword" className="block text-sm font-semibold text-gallery-700 mb-2">
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

                <div className="lg:col-span-2">
                  <label htmlFor="fromEmail" className="block text-sm font-semibold text-gallery-700 mb-2">
                    From Email <span className="text-gallery-400 font-normal">(optional)</span>
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
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
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
                  {testSmtpMutation.isPending ? 'Testing...' : 'Test SMTP'}
                </button>
              </div>

              {/* SMTP Status Messages */}
              {status === 'smtp-saved' && (
                <div className="flex items-center text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2.5} />
                  <span>SMTP settings saved successfully</span>
                </div>
              )}
              {status === 'smtp-error' && (
                <div className="flex items-center text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2} />
                  <span>Failed to save SMTP settings</span>
                </div>
              )}
              {status === 'smtp-test-success' && (
                <div className="flex items-center text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2.5} />
                  <span>SMTP connection test successful!</span>
                </div>
              )}
              {status === 'smtp-test-error' && (
                <div className="flex items-center text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" strokeWidth={2} />
                  <span>SMTP connection test failed. Please check your settings.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="card">
            <div className="p-6 lg:p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gallery-100 rounded-lg p-2.5">
                  <BarChart3 className="w-5 h-5 text-gallery-700" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-xl text-gallery-900">
                    Statistics
                  </h2>
                  <p className="text-sm text-gallery-500 mt-0.5">
                    Overview of your reading library
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gallery-50 rounded-xl p-5 text-center">
                  <div className="font-display font-bold text-3xl text-gallery-900 mb-1">
                    {stats.total_articles}
                  </div>
                  <div className="text-sm text-gallery-600 font-medium">Total Articles</div>
                </div>
                <div className="bg-gallery-50 rounded-xl p-5 text-center">
                  <div className="font-display font-bold text-3xl text-coral-500 mb-1">
                    {stats.unread_articles}
                  </div>
                  <div className="text-sm text-gallery-600 font-medium">Unread</div>
                </div>
                <div className="bg-gallery-50 rounded-xl p-5 text-center">
                  <div className="font-display font-bold text-3xl text-amber-500 mb-1">
                    {stats.favorite_articles}
                  </div>
                  <div className="text-sm text-gallery-600 font-medium">Favorites</div>
                </div>
                <div className="bg-gallery-50 rounded-xl p-5 text-center">
                  <div className="font-display font-bold text-3xl text-gallery-600 mb-1">
                    {stats.archived_articles}
                  </div>
                  <div className="text-sm text-gallery-600 font-medium">Archived</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browser Extension Instructions */}
        <div className="card">
          <div className="p-6 lg:p-7">
            <h2 className="font-display font-semibold text-xl text-gallery-900 mb-5">
              Browser Extension Setup
            </h2>
            <ol className="space-y-3 text-gallery-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gallery-900 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span className="pt-0.5">Open <code className="bg-gallery-100 px-2 py-0.5 rounded text-sm font-mono">chrome://extensions</code> in your browser</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gallery-900 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span className="pt-0.5">Enable "Developer mode" in the top right corner</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gallery-900 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span className="pt-0.5">Click "Load unpacked" and select the <code className="bg-gallery-100 px-2 py-0.5 rounded text-sm font-mono">extension</code> folder</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gallery-900 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span className="pt-0.5">Click the extension icon to configure your API key</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gallery-900 text-white flex items-center justify-center text-xs font-bold">5</span>
                <span className="pt-0.5">Navigate to any article and click the extension to save it</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
