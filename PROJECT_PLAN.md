# Bookmark Digest - Local Instapaper-like Service

## Project Overview
A local, self-hosted bookmarking and reading digest service that extracts web articles (including paywalled content) directly from browser tabs, saves them for later reading, and can batch convert selected articles to EPUB for Kindle delivery.

### Core Features
1. **Browser Extension**: Capture rendered DOM from active tabs (bypasses paywalls)
2. **Article Processing**: Extract clean content using Mozilla's Readability
3. **Local Storage**: SQLite database with tagging, search, and filtering
4. **EPUB Generation**: Batch convert multiple articles to single EPUB
5. **Kindle Integration**: Automatic email delivery via Amazon's Send-to-Kindle
6. **Web Interface**: React-based UI for article management

### Tech Stack (Actual Implementation)
- **Backend**: Node.js + Express (ES modules)
- **Database**: SQLite with better-sqlite3 (v11.0.0)
- **Article Extraction**: @mozilla/readability + jsdom + DOMPurify
- **EPUB Generation**: @lesjoursfr/html-to-epub (EPUB 3.3 compliant, validated library)
- **Email**: nodemailer for SMTP
- **Frontend**: React + Vite + Tailwind CSS + TanStack Query
- **Browser Extension**: Manifest V3 (Chrome/Firefox)
- **Image Processing**: Sharp for optimization and format conversion

### Current Status (January 2026)
**✅ FULLY IMPLEMENTED** - All core features are complete and working.

**Recent Fixes & Improvements:**
1. **Fixed broken image display** - Added leading slash to image paths and frontend proxy
2. **Resolved CSS parsing errors** - Suppressed JSDOM errors with VirtualConsole
3. **Improved article typography** - Added Tailwind Typography plugin for better readability
4. **Enhanced DOMPurify configuration** - Preserves HTML attributes for proper styling
5. **Database path corrections** - Updated existing articles with correct image paths
6. **EPUB library replacement** - Replaced buggy @storyteller-platform/epub with @lesjoursfr/html-to-epub (EPUB 3.3 compliant, image support restored)

**Ready for Use:** The application is fully functional for local use with browser extension capture, web UI management, EPUB generation, and Kindle email delivery.

## System Architecture

### Component Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Backend       │    │   Frontend      │
│   Extension     │────▶   Server        │◀───▶   Web UI        │
│   (Manifest V3) │    │   (Express)     │    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DOM Capture   │    │   SQLite DB     │    │   EPUB Gen      │
│   (Content      │    │   (Articles,    │    │   (Batch        │
│    Script)      │    │    Tags, etc.)  │    │    Processor)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │   Kindle Email  │
                      │   (SMTP)        │
                      └─────────────────┘
```

### Data Flow
1. **Capture**: Browser extension captures `document.documentElement.outerHTML`
2. **Process**: Backend extracts clean content with Readability
3. **Store**: Article metadata and HTML saved to SQLite
4. **Manage**: Web UI for browsing, searching, tagging
5. **Export**: Selected articles converted to EPUB
6. **Deliver**: EPUB emailed to Kindle via configured SMTP

## Component Specifications

### 1. Browser Extension (Manifest V3)

#### Manifest Structure
```json
{
  "manifest_version": 3,
  "name": "Bookmark Digest",
  "version": "1.0.0",
  "description": "Save web articles for later reading",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["http://localhost:3001/*"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_title": "Save to Bookmark Digest",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### Content Script (content.js)
```javascript
class DOMCapture {
  async captureCurrentPage() {
    // Wait for dynamic content
    await this.waitForStability();
    
    // Capture full DOM
    const html = document.documentElement.outerHTML;
    const title = document.title;
    const url = window.location.href;
    
    // Send to background script
    return chrome.runtime.sendMessage({
      type: 'CAPTURE_PAGE',
      data: { html, title, url }
    });
  }
  
  async waitForStability(timeout = 5000) {
    // Implementation for waiting for dynamic content
    return new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 1000);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }
}

// Initialize when extension button clicked
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CAPTURE_NOW') {
    new DOMCapture().captureCurrentPage().then(sendResponse);
    return true; // Keep message channel open
  }
});
```

#### Background Script (background.js)
```javascript
const API_BASE = 'http://localhost:3001/api';

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_NOW' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Content script not ready:', chrome.runtime.lastError);
      return;
    }
    
    // Send to backend
    fetch(`${API_BASE}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Article Saved',
          message: `"${data.article.title}" saved successfully`
        });
      }
    })
    .catch(err => console.error('Save failed:', err));
  });
});
```

### 2. Backend Server (Express)

#### Project Structure
```
backend/
├── src/
│   ├── index.js              # Server entry point
│   ├── routes/
│   │   ├── articles.js       # Article CRUD endpoints
│   │   ├── tags.js          # Tag management
│   │   ├── epub.js          # EPUB generation endpoints
│   │   └── kindle.js        # Kindle email endpoints
│   ├── services/
│   │   ├── articleProcessor.js  # Readability extraction
│   │   ├── epubGenerator.js     # EPUB creation
│   │   ├── kindleService.js     # Email delivery
│   │   └── database.js      # SQLite wrapper
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validation.js
│   └── utils/
│       ├── sanitizer.js     # HTML sanitization
│       └── imageHandler.js  # Image downloading
└── package.json
```

#### Key Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "better-sqlite3": "^9.0.0",
    "@mozilla/readability": "^0.4.0",
    "jsdom": "^22.0.0",
    "epub-gen": "^0.1.0",
    "nodemailer": "^6.9.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.0.0"
  }
}
```

### 3. Database Schema

#### SQLite Tables
```sql
-- Articles table
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  original_url TEXT,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_text TEXT,
  excerpt TEXT,
  author TEXT,
  site_name TEXT,
  published_at DATETIME,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  language TEXT DEFAULT 'en',
  has_images BOOLEAN DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT 0,
  is_favorite BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url)
);

-- Tags table
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Article-tag junction table
CREATE TABLE article_tags (
  article_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Images table (for local image storage)
CREATE TABLE article_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- EPUB export history
CREATE TABLE epub_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  article_count INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  sent_to_kindle BOOLEAN DEFAULT 0,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_articles_created_at ON articles(created_at);
CREATE INDEX idx_articles_title ON articles(title);
CREATE INDEX idx_articles_is_archived ON articles(is_archived);
CREATE INDEX idx_articles_is_favorite ON articles(is_favorite);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag_id ON article_tags(tag_id);
```

### 4. Article Processing Service

#### Implementation (articleProcessor.js)
```javascript
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs').promises;
const database = require('./database');
const imageHandler = require('./imageHandler');

class ArticleProcessor {
  constructor() {
    this.readabilityOptions = {
      debug: false,
      maxElemsToParse: 0,
      nbTopCandidates: 5,
      charThreshold: 500
    };
  }
  
  async processArticle(html, url, options = {}) {
    // Parse HTML with JSDOM
    const dom = new JSDOM(html, {
      url,
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    // Extract with Readability
    const reader = new Readability(dom.window.document, this.readabilityOptions);
    const article = reader.parse();
    
    if (!article) {
      throw new Error('Failed to extract article content');
    }
    
    // Download and replace images if enabled
    let processedHtml = article.content;
    let imageData = [];
    
    if (options.preserveImages) {
      const result = await imageHandler.downloadAndReplaceImages(
        article.content,
        url,
        article.title
      );
      processedHtml = result.html;
      imageData = result.images;
    }
    
    // Calculate reading time (average 200 WPM)
    const wordCount = article.textContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    
    return {
      url,
      originalUrl: url,
      title: article.title,
      contentHtml: processedHtml,
      contentText: article.textContent,
      excerpt: article.excerpt,
      author: article.byline,
      siteName: article.siteName,
      publishedAt: article.publishedTime ? new Date(article.publishedTime) : null,
      wordCount,
      readingTimeMinutes: readingTime,
      language: article.lang || 'en',
      hasImages: imageData.length > 0,
      imageCount: imageData.length,
      images: imageData
    };
  }
  
  async saveArticle(articleData, tags = []) {
    const db = database.getConnection();
    
    return db.transaction(() => {
      // Insert article
      const articleStmt = db.prepare(`
        INSERT OR REPLACE INTO articles 
        (url, original_url, title, content_html, content_text, excerpt, 
         author, site_name, published_at, word_count, reading_time_minutes,
         language, has_images, image_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `);
      
      const articleId = articleStmt.get(
        articleData.url,
        articleData.originalUrl,
        articleData.title,
        articleData.contentHtml,
        articleData.contentText,
        articleData.excerpt,
        articleData.author,
        articleData.siteName,
        articleData.publishedAt,
        articleData.wordCount,
        articleData.readingTimeMinutes,
        articleData.language,
        articleData.hasImages,
        articleData.imageCount
      ).id;
      
      // Save images if any
      if (articleData.images && articleData.images.length > 0) {
        const imageStmt = db.prepare(`
          INSERT INTO article_images 
          (article_id, original_url, local_path, alt_text, width, height, size_bytes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const image of articleData.images) {
          imageStmt.run(
            articleId,
            image.originalUrl,
            image.localPath,
            image.altText,
            image.width,
            image.height,
            image.sizeBytes
          );
        }
      }
      
      // Process tags
      if (tags.length > 0) {
        this._saveTagsForArticle(db, articleId, tags);
      }
      
      return articleId;
    })();
  }
  
  _saveTagsForArticle(db, articleId, tagNames) {
    // Ensure tags exist
    const tagInsertStmt = db.prepare(`
      INSERT OR IGNORE INTO tags (name) VALUES (?)
    `);
    
    const tagGetStmt = db.prepare(`
      SELECT id FROM tags WHERE name = ?
    `);
    
    const articleTagStmt = db.prepare(`
      INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)
    `);
    
    for (const tagName of tagNames) {
      tagInsertStmt.run(tagName);
      const tagId = tagGetStmt.get(tagName).id;
      articleTagStmt.run(articleId, tagId);
    }
  }
}

module.exports = new ArticleProcessor();
```

### 5. EPUB Generation Service

#### Implementation (epubGenerator.js)
```javascript
const Epub = require('epub-gen');
const path = require('path');
const fs = require('fs').promises;
const database = require('./database');

class EPUBGenerator {
  constructor(outputDir = './epub-exports') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }
  
  async ensureOutputDir() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }
  
  async generateFromArticles(articleIds, options = {}) {
    const db = database.getConnection();
    
    // Fetch articles
    const placeholders = articleIds.map(() => '?').join(',');
    const articles = db.prepare(`
      SELECT id, title, content_html, author, published_at, url
      FROM articles 
      WHERE id IN (${placeholders})
      ORDER BY published_at ASC
    `).all(...articleIds);
    
    if (articles.length === 0) {
      throw new Error('No articles found');
    }
    
    // Prepare EPUB options
    const epubOptions = {
      title: options.title || `Bookmark Digest - ${new Date().toLocaleDateString()}`,
      author: options.author || 'Bookmark Digest',
      publisher: 'Bookmark Digest',
      cover: options.cover || null,
      content: [],
      verbose: false,
      lang: 'en'
    };
    
    // Format each article for EPUB
    articles.forEach((article, index) => {
      const articleContent = this._prepareArticleForEPUB(article, index + 1);
      epubOptions.content.push({
        title: article.title,
        author: article.author,
        data: articleContent
      });
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bookmark-digest-${timestamp}.epub`;
    const filepath = path.join(this.outputDir, filename);
    
    // Generate EPUB
    await new Epub(epubOptions, filepath).promise;
    
    // Get file stats
    const stats = await fs.stat(filepath);
    
    // Save export record
    const exportStmt = db.prepare(`
      INSERT INTO epub_exports 
      (name, article_count, file_path, file_size)
      VALUES (?, ?, ?, ?)
      RETURNING id
    `);
    
    const exportId = exportStmt.get(
      epubOptions.title,
      articles.length,
      filepath,
      stats.size
    ).id;
    
    return {
      id: exportId,
      filename,
      filepath,
      size: stats.size,
      articleCount: articles.length,
      title: epubOptions.title
    };
  }
  
  _prepareArticleForEPUB(article, chapterNumber) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this._escapeHtml(article.title)}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
            }
            h1 {
              border-bottom: 2px solid #eee;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .metadata {
              color: #666;
              font-size: 0.9em;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 1px solid #eee;
            }
            .original-url {
              word-break: break-all;
              font-size: 0.8em;
              color: #888;
            }
          </style>
        </head>
        <body>
          <h1>Chapter ${chapterNumber}: ${this._escapeHtml(article.title)}</h1>
          <div class="metadata">
            ${article.author ? `<p>By ${this._escapeHtml(article.author)}</p>` : ''}
            ${article.published_at ? `<p>Published: ${new Date(article.published_at).toLocaleDateString()}</p>` : ''}
            <p class="original-url">Original URL: ${this._escapeHtml(article.url)}</p>
          </div>
          <div class="content">
            ${article.content_html}
          </div>
        </body>
      </html>
    `;
  }
  
  _escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = new EPUBGenerator();
```

### 6. Kindle Email Service

#### Implementation (kindleService.js)
```javascript
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const database = require('./database');

class KindleService {
  constructor() {
    this.transporter = null;
    this.configured = false;
  }
  
  configure(config) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    });
    
    this.kindleEmail = config.kindleEmail;
    this.fromEmail = config.fromEmail || config.smtpUser;
    this.configured = true;
  }
  
  async sendEPUB(filepath, options = {}) {
    if (!this.configured) {
      throw new Error('Kindle service not configured');
    }
    
    const filename = options.filename || path.basename(filepath);
    const subject = options.subject || `Bookmark Digest: ${filename}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: this.kindleEmail,
      subject: subject,
      text: `EPUB file: ${filename}`,
      attachments: [{
        filename: filename,
        path: filepath,
        contentType: 'application/epub+zip'
      }]
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      // Update export record
      const db = database.getConnection();
      const updateStmt = db.prepare(`
        UPDATE epub_exports 
        SET sent_to_kindle = 1, sent_at = ?
        WHERE file_path = ?
      `);
      
      updateStmt.run(new Date().toISOString(), filepath);
      
      return {
        success: true,
        messageId: info.messageId,
        filename,
        filepath
      };
    } catch (error) {
      throw new Error(`Failed to send EPUB to Kindle: ${error.message}`);
    }
  }
  
  async testConnection() {
    if (!this.configured) {
      throw new Error('Kindle service not configured');
    }
    
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      throw new Error(`SMTP connection failed: ${error.message}`);
    }
  }
}

module.exports = new KindleService();
```

### 7. API Endpoints

#### Article Routes
```javascript
// GET /api/articles - List articles with pagination and filters
// GET /api/articles/:id - Get single article
// POST /api/articles - Create article from HTML
// PUT /api/articles/:id - Update article
// DELETE /api/articles/:id - Delete article
// POST /api/articles/:id/tags - Add tags to article
// DELETE /api/articles/:id/tags/:tagId - Remove tag from article
// POST /api/articles/search - Full-text search
// GET /api/articles/stats - Get statistics
```

#### EPUB Routes
```javascript
// POST /api/epub/generate - Generate EPUB from selected articles
// GET /api/epub/exports - List previous exports
// GET /api/epub/exports/:id/download - Download EPUB file
// POST /api/epub/exports/:id/send-to-kindle - Send to Kindle
```

#### Tag Routes
```javascript
// GET /api/tags - List all tags
// POST /api/tags - Create new tag
// PUT /api/tags/:id - Update tag
// DELETE /api/tags/:id - Delete tag
// GET /api/tags/:id/articles - Get articles with tag
```

#### Settings Routes
```javascript
// GET /api/settings - Get all settings
// PUT /api/settings - Update settings
// POST /api/settings/test-smtp - Test SMTP configuration
```

### 8. Frontend UI (React)

#### Component Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Layout.jsx
│   │   ├── Articles/
│   │   │   ├── ArticleList.jsx
│   │   │   ├── ArticleCard.jsx
│   │   │   ├── ArticleViewer.jsx
│   │   │   └── ArticleFilters.jsx
│   │   ├── Tags/
│   │   │   ├── TagManager.jsx
│   │   │   └── TagFilter.jsx
│   │   ├── EPUB/
│   │   │   ├── EPUBGenerator.jsx
│   │   │   ├── ExportHistory.jsx
│   │   │   └── KindleSettings.jsx
│   │   └── Common/
│   │       ├── SearchBar.jsx
│   │       ├── Pagination.jsx
│   │       └── LoadingSpinner.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Articles.jsx
│   │   ├── Tags.jsx
│   │   ├── Settings.jsx
│   │   └── EPUB.jsx
│   ├── hooks/
│   │   ├── useArticles.js
│   │   ├── useTags.js
│   │   └── useEPUB.js
│   ├── services/
│   │   ├── api.js
│   │   └── cache.js
│   ├── utils/
│   │   ├── format.js
│   │   └── validation.js
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

#### Key Dependencies
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "axios": "^1.0.0",
    "@tanstack/react-query": "^4.0.0",
    "date-fns": "^2.0.0",
    "react-markdown": "^8.0.0",
    "react-hotkeys-hook": "^4.0.0"
  },
  "devDependencies": {
    "vite": "^4.0.0",
    "@vitejs/plugin-react": "^3.0.0"
  }
}
```

### 9. Environment Configuration

#### .env File
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/bookmark-digest.db
DATA_DIR=./data
EPUB_EXPORT_DIR=./epub-exports

# Image Handling
MAX_IMAGE_SIZE_MB=5
IMAGE_QUALITY=85
IMAGE_TIMEOUT_MS=10000

# Kindle/SMTP
KINDLE_EMAIL=your_kindle_email@kindle.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com

# Security
CORS_ORIGIN=http://localhost:5173
API_RATE_LIMIT=100
```

### 10. Development Setup

#### Installation
```bash
# Clone and setup
git clone <repository>
cd bookmark-digest

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration

# Frontend setup
cd ../frontend
npm install

# Browser extension setup
cd ../extension
# Load unpacked extension in Chrome/Firefox developer mode
```

#### Development Scripts
```json
{
  "scripts": {
    "dev:backend": "nodemon src/index.js",
    "dev:frontend": "vite",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "build:frontend": "vite build",
    "start": "node src/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "db:migrate": "node scripts/migrate.js"
  }
}
```

### 11. Testing Strategy

#### Unit Tests
- **ArticleProcessor**: Test HTML extraction and processing
- **EPUBGenerator**: Test EPUB creation and formatting
- **Database**: Test CRUD operations and queries
- **API Routes**: Test endpoints with Supertest

#### Integration Tests
- **Browser Extension**: Test DOM capture and communication
- **End-to-End**: Test complete workflow with Cypress
- **Kindle Integration**: Test SMTP configuration and email sending

#### Test Data
```javascript
// Example test article
const testArticle = {
  html: `
    <!DOCTYPE html>
    <html>
      <body>
        <article>
          <h1>Test Article</h1>
          <p>This is a test article for unit testing.</p>
          <img src="https://example.com/test.jpg" alt="Test">
        </article>
      </body>
    </html>
  `,
  url: 'https://example.com/test',
  expected: {
    title: 'Test Article',
    wordCount: 7,
    hasImages: true
  }
};
```

### 12. Deployment & Maintenance

#### Production Setup
1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Ensure proper backups with `sqlite3 .backup`
3. **Logging**: Implement structured logging with Winston
4. **Monitoring**: Add health checks at `/health`
5. **Updates**: Create migration scripts for database schema changes

#### Backup Strategy
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/bookmark-digest"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="./data/bookmark-digest.db"

# Create backup
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/backup_$TIMESTAMP.db'"

# Keep only last 7 days
find "$BACKUP_DIR" -name "backup_*.db" -mtime +7 -delete
```

#### Update Procedure
1. Stop the service
2. Backup database
3. Update code
4. Run migrations (if any)
5. Restart service
6. Verify health check

### 13. Security Considerations

#### Input Validation
- **HTML Sanitization**: Use DOMPurify for any user-generated HTML
- **SQL Injection**: Use prepared statements exclusively
- **File Paths**: Validate and sanitize all file system operations
- **URL Validation**: Ensure captured URLs are valid and safe

#### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

#### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

### 14. Performance Optimizations

#### Database Indexing
- **Articles**: Index on `created_at`, `is_archived`, `is_favorite`
- **Tags**: Index on `name`
- **Article-Tags**: Composite index on `(article_id, tag_id)`

#### Caching Strategy
```javascript
// Redis cache for frequent queries
const redis = require('redis');
const cache = redis.createClient();

async function getArticlesWithCache(options) {
  const cacheKey = `articles:${JSON.stringify(options)}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const articles = await database.getArticles(options);
  await cache.setex(cacheKey, 300, JSON.stringify(articles)); // 5 minutes
  return articles;
}
```

#### Image Optimization
- **Compression**: Use Sharp for image resizing and compression
- **Lazy Loading**: Load images on demand in UI
- **CDN**: Option to use Imgix or similar for image hosting

### 15. Future Enhancements

#### Planned Features
1. **Browser Sync**: Sync articles across multiple browsers
2. **Mobile App**: React Native app for mobile reading
3. **Read Aloud**: Text-to-speech integration
4. **Annotations**: Highlight and note-taking within articles
5. **Social Sharing**: Share articles with others
6. **Import/Export**: Support Pocket, Instapaper, Raindrop.io formats
7. **AI Summarization**: GPT integration for article summaries
8. **Newsletter Generation**: Create weekly digests as newsletters

#### Technical Improvements
1. **GraphQL API**: Replace REST with GraphQL for more flexible queries
2. **Real-time Updates**: WebSocket support for live updates
3. **Progressive Web App**: Add service worker for offline support
4. **Docker Deployment**: Official Docker image with compose setup
5. **Plugin System**: Allow custom processors and exporters

---

## Implementation Checklist

### Phase 1: Core Infrastructure ✅ COMPLETE
- [x] Set up Node.js backend with Express (ES modules)
- [x] Configure SQLite database with schema and migrations
- [x] Implement basic article CRUD API with authentication
- [x] Create development environment setup with auto-generated API key

### Phase 2: Article Processing ✅ COMPLETE
- [x] Integrate @mozilla/readability + jsdom + DOMPurify for content extraction
- [x] Implement image downloading and replacement with Sharp optimization
- [x] Add tag management system with normalized lowercase tags
- [x] Create search functionality across title, content, and excerpt

### Phase 3: Browser Extension ✅ COMPLETE
- [x] Build Manifest V3 extension structure with programmatic injection
- [x] Implement DOM capture with content script and smart content selection
- [x] Add communication with backend API key authentication
- [x] Create extension UI and notifications with progress indicators

### Phase 4: Frontend UI ✅ COMPLETE
- [x] Set up React frontend with Vite + Tailwind CSS + TanStack Query
- [x] Create article listing with pagination, filtering, and sorting
- [x] Implement article viewer with typography improvements
- [x] Add tag management interface with color coding

### Phase 5: EPUB Generation ✅ COMPLETE
- [x] Integrate @lesjoursfr/html-to-epub library (EPUB 3.3 compliant)
- [x] Create EPUB formatting templates with responsive styling
- [x] Implement batch article selection (up to 100 articles)
- [x] Add export history tracking in database

### Phase 6: Kindle Integration ✅ COMPLETE
- [x] Configure nodemailer for SMTP with environment variables
- [x] Implement Kindle email sending with EPUB attachments
- [x] Create settings interface for email configuration
- [x] Add email sending status tracking (sent_to_kindle flag)

### Phase 7: Polish & Error Handling ✅ COMPLETE
- [x] Add comprehensive error handling with structured logging
- [x] Implement input validation and sanitization with express-validator
- [ ] Create unit and integration tests (Phase 9 in progress)
- [x] Optimize performance with database indexes and image compression

### Phase 8: Documentation & Monitoring ✅ COMPLETE
- [x] Create production build scripts (frontend Vite build)
- [x] Set up logging and monitoring with Winston logger and health checks
- [x] Implement backup strategy documentation
- [x] Document installation and configuration in README and AGENTS.md

---

## Success Metrics

1. **Article Capture Success Rate**: >90% for popular news sites
2. **Processing Time**: <5 seconds per article
3. **EPUB Generation**: <30 seconds for 50 articles
4. **Database Performance**: <100ms for common queries
5. **Memory Usage**: <500MB for 10,000 articles
6. **Reliability**: 99.9% uptime for local service

---

## Quick Start Guide

### 1. Prerequisites
- Node.js 18+
- npm or yarn
- Chrome or Firefox browser

### 2. Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd bookmark-digest

# Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with your SMTP and Kindle settings

# Setup frontend
cd ../frontend
npm install

# Start development servers
cd ../backend
npm run dev:backend

# In another terminal
cd ../frontend
npm run dev:frontend

# Load extension
# 1. Open Chrome/Edge → chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the "extension" folder
```

### 3. First Use
1. Navigate to `http://localhost:5173` for the web UI
2. Click the extension icon on any article page to save it
3. Use the web UI to browse, search, and tag articles
4. Select articles and generate EPUB
5. Configure Kindle email in settings to enable automatic delivery

---

## Troubleshooting

### Common Issues

1. **Extension not capturing**: Ensure content script is injected (check console logs)
2. **EPUB generation fails**: Verify epub-gen installation and file permissions
3. **Kindle email not arriving**: Check SMTP configuration and spam folder
4. **Database errors**: Ensure SQLite file is writable and not locked
5. **Image download fails**: Check network connectivity and image URL accessibility

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=bookmark-digest:* npm start
```

---

## Support & Resources

- **Documentation**: See `/docs` directory for detailed API docs
- **Issues**: Report bugs on GitHub Issues
- **Contributing**: See CONTRIBUTING.md for development guidelines
- **Community**: Join Discord/Slack for support and discussion

---

*Last Updated: January 23, 2026*
*Version: 1.0.0*
