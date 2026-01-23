// Options page JavaScript for Bookmark Digest extension

const API_BASE = 'http://localhost:3001';
const STORAGE_KEY_API = 'bookmarkDigestApiKey';

// DOM elements
const apiKeyInput = document.getElementById('api-key');
const apiUrlInput = document.getElementById('api-url');
const settingsForm = document.getElementById('settings-form');
const saveBtn = document.getElementById('save-btn');
const testBtn = document.getElementById('test-btn');
const statusMessage = document.getElementById('status-message');
const versionElement = document.getElementById('version');
const footerVersionElement = document.getElementById('footer-version');

/**
 * Initialize the options page
 */
async function init() {
  // Set version from manifest
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version;
  versionElement.textContent = version;
  footerVersionElement.textContent = version;

  // Load saved API key
  await loadSettings();

  // Set up event listeners
  settingsForm.addEventListener('submit', handleSave);
  testBtn.addEventListener('click', handleTest);

  // Auto-focus API key input if empty
  if (!apiKeyInput.value) {
    apiKeyInput.focus();
  }
}

/**
 * Load settings from chrome.storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_API], (result) => {
      const apiKey = result[STORAGE_KEY_API] || '';
      apiKeyInput.value = apiKey;
      resolve();
    });
  });
}

/**
 * Save settings to chrome.storage
 */
async function saveSettings(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY_API]: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.hidden = false;

  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.hidden = true;
    }, 5000);
  }
}

/**
 * Hide status message
 */
function hideStatus() {
  statusMessage.hidden = true;
}

/**
 * Set button loading state
 */
function setButtonLoading(button, loading) {
  const buttonText = button.querySelector('.button-text');
  const buttonLoader = button.querySelector('.button-loader');

  if (loading) {
    button.disabled = true;
    if (buttonText) buttonText.style.display = 'none';
    if (buttonLoader) buttonLoader.style.display = 'inline-block';
  } else {
    button.disabled = false;
    if (buttonText) buttonText.style.display = 'inline';
    if (buttonLoader) buttonLoader.style.display = 'none';
  }
}

/**
 * Handle save button click
 */
async function handleSave(event) {
  event.preventDefault();

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    apiKeyInput.focus();
    return;
  }

  hideStatus();
  setButtonLoading(saveBtn, true);

  try {
    await saveSettings(apiKey);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus(`Failed to save: ${error.message}`, 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

/**
 * Test API connection
 */
async function handleTest() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key first', 'error');
    apiKeyInput.focus();
    return;
  }

  hideStatus();
  setButtonLoading(testBtn, true);

  try {
    // First test the health endpoint (no auth required)
    const healthResponse = await fetch(`${API_BASE}/health`);

    if (!healthResponse.ok) {
      throw new Error('Server is not running. Please start the backend: npm run dev');
    }

    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);

    // Then test the status endpoint (requires API key)
    const statusResponse = await fetch(`${API_BASE}/api/status`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!statusResponse.ok) {
      if (statusResponse.status === 401) {
        throw new Error('Invalid API key. Please check your config.json file.');
      } else {
        throw new Error(`Server returned: ${statusResponse.status} ${statusResponse.statusText}`);
      }
    }

    const statusData = await statusResponse.json();
    console.log('Status check:', statusData);

    showStatus('Connection successful! Your API key is valid.', 'success');
  } catch (error) {
    console.error('Connection test failed:', error);

    let errorMessage = error.message;
    if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
      errorMessage = 'Cannot connect to server. Make sure the backend is running on port 3001.';
    }

    showStatus(`Connection failed: ${errorMessage}`, 'error');
  } finally {
    setButtonLoading(testBtn, false);
  }
}

/**
 * Send message to background script
 */
function sendMessage(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Initialize on DOM content loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
