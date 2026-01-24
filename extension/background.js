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
 * Set badge on extension icon
 */
function setBadge(text, color = '#2563eb') {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  // Clear badge after 3 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);
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
      url: data.url
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
      setBadge('!', '#ef4444');
      showNotification(
        '⚙️ Configuration Required',
        'Click here to set your API key in options.',
        'error'
      );
      return;
    }

    // Stage 1: Capturing
    setBadge('⏳', '#2563eb');
    showNotification(
      '⏳ Capturing Article...',
      'Reading page content...'
    );

    const capturedData = await capturePage(tab);

    // Stage 2: Processing
    setBadge('⏳', '#f59e0b');
    showNotification(
      '⏳ Processing Article...',
      'Extracting content and saving to server...'
    );

    // Send to backend
    const result = await saveArticle(capturedData);

    // Stage 3: Success!
    setBadge('✓', '#10b981');
    showNotification(
      '✅ Article Saved!',
      `"${result.article.title}" (${result.article.wordCount?.toLocaleString() || 'N/A'} words, ${result.article.readingTimeMinutes || 0} min read)`,
      'success'
    );

    // Optional: Play a subtle sound (browser must allow)
    try {
      // Only works if user has interacted with the page
      new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2i98Of0TQAUUqnr8LplHAY4kNTyyyUoBStx0/DWk0AKFFm5u+5YBgJQp3g8b1vIAUrgs/0yIk2CBtosfDn9E0AFFKp6/C6ZxwGOJDU8s8lKAUrcdPw1pNAChRZubvuWAYCUKd4PG9ryAFK4LP9MiJNggbaLHw5/RNABRSqevwumccBjiQ1PPLJSlFeuj0vwAAAARwAAAAA=').play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }

  } catch (error) {
    console.error('Error saving article:', error);

    // Show error badge
    setBadge('✗', '#ef4444');

    // Determine error type and provide helpful message
    let errorMessage = error.message || 'Failed to save article';
    let errorHint = '';

    if (errorMessage.includes('API key not configured')) {
      errorHint = '\n\n💡 Click the extension icon and select Options to configure.';
    } else if (errorMessage.includes('Invalid API key')) {
      errorHint = '\n\n💡 Check your API key in extension options.';
    } else if (errorMessage.includes('Server is not running')) {
      errorHint = '\n\n💡 Start the backend server: cd backend && npm run dev';
    } else if (errorMessage.includes('fetch')) {
      errorHint = '\n\n💡 Make sure the backend server is running on port 3001.';
    } else if (errorMessage.includes('Failed to capture')) {
      errorHint = '\n\n💡 Try refreshing the page and clicking again.';
    }

    showNotification(
      '❌ Save Failed',
      errorMessage + errorHint,
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
