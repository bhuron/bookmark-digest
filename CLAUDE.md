# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bookmark Digest is a self-hosted bookmarking and reading service that captures web articles (including paywalled content) via a browser extension, processes them with Mozilla Readability, stores them in SQLite, and can batch convert articles to EPUB for Kindle delivery.

**Key Technologies:**
- Backend: Node.js + Express (ES modules)
- Database: SQLite with better-sqlite3
- Article Extraction: @mozilla/readability + jsdom + DOMPurify
- EPUB Generation: @lesjoursfr/html-to-epub (EPUB 3.3 compliant)
- Frontend: React + Vite + Tailwind CSS + TanStack Query
- Extension: Manifest V3 (Chrome/Firefox)
- Image Processing: Sharp (optimization and format conversion)

**Important Note - Tag Feature:** The tag system was previously implemented but has been **removed** due to bugs. All tag-related database tables, API endpoints, and frontend components have been deleted. Do not attempt to restore or reference tag functionality.

## Development Commands

### Backend (in `/backend` directory)
```bash
npm install              # Install dependencies
cp .env.example .env     # Configure environment (generates API key automatically)
npm run dev              # Start development server with nodemon
npm start                # Start production server
npm run migrate          # Run database migrations manually
npm run lint             # Run ESLint
npm test                 # Run Jest tests
```

### Frontend (in `/frontend` directory)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (default: http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm test                 # Run Vitest tests
```

### Database
- Database auto-initializes on server start via migrations
- Location: `./data/bookmark-digest.db` (configurable via `DB_PATH` env var)
- Migration files: `backend/migrations/*.sql`
- Manual migration: `npm run migrate` (runs `src/database/migrate.js`)

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=articleProcessor

# Run tests in watch mode
npm test -- --watch
```

## Architecture

### API Authentication
All API endpoints (except `/health`) require an API key sent via `X-API-Key` header. The API key is auto-generated on first run and stored in `config.json` at the repository root.

### Backend Structure

```
backend/src/
├── index.js              # Express server entry point
├── config.js             # Configuration management + API key generation
├── database/
│   ├── index.js          # SQLite connection singleton (better-sqlite3)
│   └── migrations.js     # Migration runner (applies files from /migrations)
├── services/
│   ├── articleProcessor.js  # Readability extraction + HTML sanitization
│   ├── imageHandler.js      # Image downloading and local storage
│   ├── epubGenerator.js     # EPUB generation from articles
│   ├── kindleService.js     # Email delivery via nodemailer
│   └── settingsService.js   # Application settings management
├── routes/
│   ├── articles.js       # Article CRUD endpoints
│   ├── epub.js           # EPUB generation endpoints
│   └── settings.js       # Settings management endpoints
├── middleware/
│   ├── auth.js           # API key validation
│   ├── errorHandler.js   # Async error handling wrapper
│   ├── validation.js     # Request validation with express-validator
│   └── rateLimiter.js    # Rate limiting (express-rate-limit)
└── utils/
    └── logger.js         # Winston logger
```

### Frontend Structure

```
frontend/src/
├── main.jsx              # React entry point
├── App.jsx               # Root app with router
├── components/
│   ├── Layout/
│   │   ├── Header.jsx    # App header with navigation
│   │   └── Layout.jsx    # Main layout wrapper
│   ├── Articles/
│   │   ├── ArticleList.jsx    # Article list container
│   │   ├── ArticleCard.jsx    # Single article card
│   │   ├── ArticleViewer.jsx  # Full article content viewer
│   │   └── ArticleFilters.jsx  # Filter controls
│   ├── Common/
│   │   ├── SearchBar.jsx   # Search input
│   │   ├── Pagination.jsx   # Pagination controls
│   │   └── LoadingSpinner.jsx
│   └── EPUB/
│       ├── EPUBGenerator.jsx   # EPUB generation UI
│       ├── ExportHistory.jsx   # Export list
│       └── KindleSettings.jsx  # SMTP configuration
├── pages/
│   ├── Articles.jsx       # Articles list page
│   ├── EPUB.jsx           # EPUB generation page
│   └── Settings.jsx       # App settings
├── hooks/
│   ├── useArticles.js     # Articles API hook (TanStack Query)
│   └── useEPUB.js         # EPUB API hook
└── services/
    └── api.js             # Axios client with auth
```

### Article Processing Pipeline

1. **Capture**: Browser extension sends `document.documentElement.outerHTML` via POST to `/api/articles`
2. **Parse**: JSDOM parses HTML into a DOM
3. **Extract**: Readability extracts main article content
4. **Sanitize**: DOMPurify removes malicious scripts/elements
5. **Images**: Optionally download images locally (via `imageHandler.js`)
6. **Save**: Store in SQLite with metadata (word count, reading time, author, etc.)

### Database Schema Key Points

- Articles have a unique constraint on `url` (UPSERT on duplicate)
- `capture_success` flag indicates if Readability extraction succeeded
- Failed captures are stored with error message in `capture_error`
- Foreign keys with CASCADE deletion (deleting article removes its images)
- Triggers auto-update `updated_at` timestamp
- Indexes on `created_at`, `is_archived`, `is_favorite`, `site_name`, `language`
- **Tag tables removed:** Do not reference `tags` or `article_tags` tables - they were deleted

### Migrations System

- Migrations are SQL files in `backend/migrations/` directory
- Naming convention: `001_initial.sql`, `002_add_feature.sql`, etc.
- Applied migrations tracked in `_migrations` table
- migrations.js sorts files alphabetically and applies only new ones

### API Endpoints

**Articles:**
- `POST /api/articles` - Create from HTML body `{ html, url }`
- `GET /api/articles` - List with pagination/filtering `?page=1&limit=20&search=query&is_archived=false`
- `GET /api/articles/:id` - Get single article
- `PUT /api/articles/:id` - Update `{ title?, is_archived?, is_favorite? }`
- `DELETE /api/articles/:id` - Delete article
- `GET /api/articles/stats` - Aggregated statistics

**EPUB:**
- `POST /api/epub/generate` - Generate EPUB `{ articleIds: [], title?, author? }`
- `GET /api/epub/exports` - List export history
- `GET /api/epub/exports/:id` - Get export details
- `GET /api/epub/exports/:id/download` - Download EPUB file
- `DELETE /api/epub/exports/:id` - Delete export
- `POST /api/epub/exports/:id/send-to-kindle` - Email to Kindle

**Settings:**
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-smtp` - Test SMTP configuration



## Environment Configuration

Key environment variables (see `backend/.env.example`):

```bash
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database
DB_PATH=./data/bookmark-digest.db

# Image Handling
MAX_IMAGE_SIZE_MB=5
IMAGE_QUALITY=85
MAX_ARTICLE_SIZE_MB=10

# Kindle/SMTP (optional)
KINDLE_EMAIL=your_kindle_email@kindle.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Key Implementation Details

### Singleton Services
Services like `articleProcessor`, `epubGenerator`, `kindleService` use the singleton pattern - they export an instantiated object, not a class. This is important for consistency across the app.

### Error Handling
- Use `asyncHandler` wrapper from `middleware/errorHandler.js` for route handlers
- Article processing failures are saved with `capture_success=0` rather than throwing
- Always log errors with structured data via `logger.error(message, { context })`

### Database Transactions
- Always wrap multi-step operations in `db.transaction(() => { ... })`
- Use prepared statements for all queries (SQL injection protection)
- Connection is singleton - always get via `getConnection()`

### Image Handling
- Images are stored locally under `./data/images/{articleId}/`
- URLs in article HTML are replaced with local paths
- If image download fails, article is still saved (images skipped)

### Reading Time Calculation
- Based on 200 words per minute average
- `wordCount = article.textContent.split(/\s+/).length`
- `readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))`

## Browser Extension Integration

The browser extension is **fully implemented** in the `/extension` directory.

### Extension Architecture
- **Manifest V3** with `activeTab`, `scripting`, `storage` permissions
- **Programmatic script injection** - content script injected on button click, not declaratively
- **API key storage** via `chrome.storage`
- **Options page** for configuration (backend URL, API key)

### Extension Files
- `manifest.json` - Extension configuration
- `background.js` - Service worker, handles extension icon clicks
- `content.js` - Injected script to capture DOM
- `options.html` + `options.js` - Settings page

### Extension Features
- One-click article capture via extension icon
- Stage-by-stage progress indicators (capturing → processing → saved)
- API key configuration and validation
- Connection testing with backend
- Success notifications with article stats (word count, reading time)
- First-run setup flow (auto-opens options page)

## Important Constraints

- Max HTML size: 10MB (configurable via `MAX_ARTICLE_SIZE_MB`)
- Max article content length: 500K characters (truncated if exceeded)
- SQLite connection uses WAL mode for better concurrency
- All dates stored as ISO strings in SQLite, converted to Date objects in JS
- EPUB library uses `@lesjoursfr/html-to-epub` - EPUB 3.3 compliant, validated with epubcheck
- Images stored locally in `./data/images/{articleId}/` with leading slashes for proper path resolution
- **JSDOM VirtualConsole** is used to suppress CSS parsing errors from malformed HTML

## Frontend Architecture

### State Management
- **TanStack Query (React Query)** for server state management
- Custom hooks in `hooks/` directory encapsulate API calls
- No global state library - use React state and TanStack Query's cache

### Styling
- **Tailwind CSS** for utility-first styling
- **@tailwindcss/typography** plugin for article content (`prose` class)
- Custom classes in `clsx` for conditional styling

### API Communication
- Single Axios instance in `services/api.js`
- API key stored in localStorage, attached to all requests via `X-API-Key` header
- Base URL configurable via environment

## Testing Strategy

### Backend Tests (Jest)
- Run with: `npm test` (in `/backend` directory)
- Test files: `__tests__/` directories next to source files
- Mock external dependencies (SMTP, image downloads)

### Frontend Tests (Vitest)
- Run with: `npm test` (in `/frontend` directory)
- Component tests with React Testing Library
- API tests with mocked Axios

### Test Status
- **Partial:** Test infrastructure set up but most tests not yet written
- See STATUS.md for current test coverage

## Common Patterns

**Creating a new migration:**
1. Create `backend/migrations/003_feature_name.sql`
2. Use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` statements
3. Restart server to auto-apply migration

**Adding a new API endpoint:**
1. Add route handler in appropriate `routes/*.js` file
2. Add validation rules in `middleware/validation.js` if needed
3. Wrap handler with `asyncHandler` for error handling
4. Update frontend API service and create/useReactQuery hook if needed

**Adding a new service:**
1. Create file in `backend/src/services/`
2. Export a singleton instance (not the class)
3. Import where needed with `import service from './services/serviceName.js'`

**Adding a new frontend page:**
1. Create component in `frontend/src/pages/`
2. Add route in `App.jsx`
3. Create custom hook in `hooks/` for API calls
4. Add navigation link in `Header.jsx`

## Known Issues & Limitations

### NPM Deprecation Warnings (Cosmetic)
These warnings from jsdom dependencies can be safely ignored:
- `whatwg-encoding@2.0.6`
- `abab@2.0.6`
- `glob@7.2.3`
- `domexception@4.0.0`

Suppress with: `npm install --silent` or `npm install --no-audit --no-fund`

### Recent Bug Fixes
1. **Image display** - Fixed missing leading slash in image paths
2. **CSS parsing errors** - Suppressed JSDOM errors with VirtualConsole
3. **Article typography** - Added Tailwind Typography plugin
4. **EPUB library** - Replaced buggy @storyteller-platform/epub with @lesjoursfr/html-to-epub
