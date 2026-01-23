// Content script for Bookmark Digest
// This script runs in the context of web pages
// Note: This file is primarily for documentation purposes
// The actual capture is performed via programmatic injection from background.js

// If you need to add persistent content script functionality,
// you can add it here and reference it in manifest.json:

/*
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]
*/

// Example: Listen for messages from background
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_NOW') {
    captureCurrentPage().then(sendResponse);
    return true; // Keep message channel open
  }
});
*/

// Smart content selector utility
class ContentSelector {
  /**
   * Find the main content element on the page
   */
  static findMainContent() {
    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.article-body',
      '.post-body',
      'article .container'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return document.body;
  }

  /**
   * Check if page has paywall or login wall
   */
  static hasPaywall() {
    const paywallIndicators = [
      '.paywall',
      '.subscription-wall',
      '[data-paywall]',
      '.premium-content'
    ];

    return paywallIndicators.some(selector =>
      document.querySelector(selector)
    );
  }

  /**
   * Get article metadata
   */
  static getMetadata() {
    const meta = {};

    // Try Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const ogAuthor = document.querySelector('meta[property="article:author"]');
    const ogPublishedTime = document.querySelector('meta[property="article:published_time"]');

    if (ogTitle) meta.title = ogTitle.content;
    if (ogDescription) meta.description = ogDescription.content;
    if (ogImage) meta.image = ogImage.content;
    if (ogAuthor) meta.author = ogAuthor.content;
    if (ogPublishedTime) meta.publishedAt = ogPublishedTime.content;

    // Try Twitter Card tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle && !meta.title) meta.title = twitterTitle.content;

    return meta;
  }
}

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContentSelector };
}
