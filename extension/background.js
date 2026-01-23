// Background service worker for Bookmark Digest extension

const API_BASE = 'http://localhost:3001/api';
const STORAGE_KEY_API = 'bookmarkDigestApiKey';

/**
 * Get API key from chrome.storage
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_API], (result) => {
      resolve(result[STORAGE_KEY_API] || '');
    });
  });
}

/**
 * Save API key to chrome.storage
 */
async function saveApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_API]: apiKey }, () => {
      resolve();
    });
  });
}

/**
 * Show notification to user
 */
function showNotification(title, message, type = 'basic') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: type === 'error' ? 2 : 1
  });
}

/**
 * Test API connection
 */
async function testConnection(apiKey) {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Capture content from the active tab
 */
async function capturePage(tab) {
  try {
    // Inject content script programmatically
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: capturePageContent,
    });

    if (!results || results.length === 0) {
      throw new Error('Failed to execute content script');
    }

    const capturedData = results[0].result;

    if (!capturedData.success) {
      throw new Error(capturedData.error || 'Failed to capture page');
    }

    return capturedData.data;
  } catch (error) {
    console.error('Capture failed:', error);
    throw error;
  }
}

/**
 * Function to be injected into the page context
 * This runs in the page's JavaScript context
 */
function capturePageContent() {
  try {
    // Wait a brief moment for any dynamic content
    return new Promise((resolve) => {
      setTimeout(() => {
        const html = document.documentElement.outerHTML;
        const title = document.title;
        const url = window.location.href;

        // Basic validation
        if (!html || html.length < 100) {
          resolve({
            success: false,
            error: 'Page content too short or unavailable'
          });
          return;
        }

        resolve({
          success: true,
          data: {
            html,
            title,
            url
          }
        });
      }, 500);
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send captured content to backend API
 */
async function saveArticle(data) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('API key not configured. Please set it in extension options.');
  }

  const response = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      html: data.html,
      url: data.url,
      tags: []
    })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your settings.');
    } else if (response.status === 413) {
      throw new Error('Article too large. Try a shorter article.');
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save article');
    }
  }

  return await response.json();
}

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if API key is configured
    const apiKey = await getApiKey();
    if (!apiKey) {
      showNotification(
        'Configuration Required',
        'Please set your API key in extension options. Right-click the icon and select Options.',
        'error'
      );
      return;
    }

    // Capture page content
    showNotification(
      'Capturing Article',
      'Please wait while we capture the article...'
    );

    const capturedData = await capturePage(tab);

    // Send to backend
    const result = await saveArticle(capturedData);

    // Show success notification
    showNotification(
      'Article Saved',
      `"${result.article.title}" has been saved to Bookmark Digest`,
      'success'
    );
  } catch (error) {
    console.error('Error saving article:', error);
    showNotification(
      'Save Failed',
      error.message || 'Failed to save article',
      'error'
    );
  }
});

/**
 * Handle installation/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install - open options page
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

/**
 * Message handler for options page communication
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    getApiKey().then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.action === 'saveApiKey') {
    saveApiKey(request.apiKey).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'testConnection') {
    testConnection(request.apiKey).then(sendResponse);
    return true;
  }

  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});
