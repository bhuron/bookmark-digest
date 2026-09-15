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

### Root (repository level)
```bash
npm run setup            # install root, backend and frontend deps, create .env
npm run dev              # backend :3001 + Vite :5174, prefixed output, Ctrl-C stops both
npm run build            # build the UI into frontend/dist
npm run serve            # build, then serve UI + API from :3001 in the foreground
npm run backup           # copy the database, config.json and .env to backups/<timestamp>/
npm start / stop / logs  # the same app under pm2, via ecosystem.config.js
```

`npm run backup` uses SQLite's `VACUUM INTO` rather than `cp`, because in WAL mode the newest commits can
still be in the `-wal` file and a plain copy can be silently stale. If you ever add state that cannot be
rebuilt from the repository, add it to `scripts/backup.mjs`.

`npm run dev` uses concurrently (a root devDependency) with `--kill-others-on-fail`, so a crash in one
service tears both down instead of leaving half an app running. It also runs `scripts/setup.mjs` first,
which creates the root `.env` on a fresh checkout - without it the backend would fall back to port 3000
while the Vite proxy, the extension and the docs all assume 3001.

### Backend (in `/backend` directory)
```bash
npm install              # Install dependencies
npm run dev              # Start development server with nodemon
npm start                # Start production server
npm run migrate          # Run database migrations manually
npm run lint             # Run ESLint
npm test                 # Run Jest tests
```

> **Env file location:** create `.env` at the **repository root** (`cp backend/.env.example .env` from the repo root). `backend/src/config.js` resolves it as `<repo>/.env`, so a `.env` placed in `backend/` is silently ignored and the server falls back to defaults (e.g. `PORT=3000`). The generated API key is written to `<repo>/config.json`.

### Frontend (in `/frontend` directory)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (default: http://localhost:5174)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm test                 # Run Vitest tests
```

### Database
- Database auto-initializes on server start via migrations
- Location: `./data/bookmark-digest.db` relative to the **backend** working directory (configurable via `DB_PATH` env var), i.e. `backend/data/bookmark-digest.db` when started from `backend/`
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

### Serving the frontend
In production the backend serves `frontend/dist` itself - one process, one port, no CORS hop - with a fallback to `index.html` for client-side routes. `utils/spaRoutes.js` keeps that fallback away from `/api`, `/health` and `/images` so those keep returning JSON. Static serving is skipped when no build exists, which is the normal development case; run `npm run build` (root) to enable it.

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
│   ├── articleService.js    # Article reads/writes and delete (owns the SQL)
│   ├── imageHandler.js      # Image downloading, local storage and cleanup
│   ├── coverGenerator.js    # EPUB cover image generation (sharp)
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
    ├── logger.js         # Winston logger
    ├── placeholders.js   # Detect .env.example sentinel values
    ├── filePermissions.js # 0600 on secrets (API key, env file, database)
    ├── ftsQuery.js       # Safe FTS5 MATCH expressions
    └── spaRoutes.js      # Paths the SPA fallback must not swallow
```

### Frontend Structure

```
frontend/src/
├── main.jsx              # React entry point
├── App.jsx               # Root app with router
├── index.css             # Tailwind layers and component classes
├── components/
│   ├── Layout/
│   │   ├── Header.jsx    # App header with navigation
│   │   └── Layout.jsx    # Main layout wrapper
│   ├── Articles/
│   │   ├── ArticleList.jsx    # Plain list of cards, no selection chrome
│   │   ├── ArticleCard.jsx    # Article card; checkbox fades in on hover/selection
│   │   ├── ArticleViewer.jsx  # Full article content viewer
│   │   ├── ArticleFilters.jsx  # Filter controls
│   │   └── BulkActionBar.jsx  # Floating pill: count, select-all, bulk actions
│   └── Common/
│       ├── SearchBar.jsx     # Search input
│       ├── Pagination.jsx    # Pagination controls
│       └── LoadingSpinner.jsx
├── pages/
│   ├── Articles.jsx      # Articles list page
│   ├── EPUB.jsx          # EPUB generation page
│   └── Settings.jsx      # App settings (API key + SMTP/Kindle form)
├── services/
│   └── api.js            # Axios client with auth
└── utils/
    ├── cn.js             # clsx wrapper
    ├── format.js         # Date and reading-time formatting
    ├── apiKey.js         # API key storage shared across ports (cookie + localStorage)
    ├── selection.js      # Selection helpers: toggle, scope, select-all (unit tested)
    └── articleFilters.js # One filter object for both the list and bulk scopes
```

### Article Processing Pipeline

1. **Capture**: Browser extension sends `document.documentElement.outerHTML` via POST to `/api/articles`
2. **Parse**: JSDOM parses HTML into a DOM
3. **Extract**: Readability extracts main article content
4. **Sanitize**: DOMPurify removes malicious scripts/elements
5. **Images**: Optionally download images locally (via `imageHandler.js`)
6. **Save**: Store in SQLite with metadata (word count, reading time, author, etc.)

Every capture logs a **graphics census** (`Graphics census`) with the `img`, `picture`, `srcset`, `svg`,
`canvas`, `iframe`, `figure` and custom-element counts at each stage. It is informational when the capture
holds something the image pipeline cannot download, and `debug` otherwise, so ordinary photo articles stay
quiet. The point is to make a missing chart attributable: a graphic absent from `raw` was never in the
extension's capture, one that disappears between `raw` and `extracted` was dropped by Readability, one lost
between `extracted` and `sanitized` was dropped by our own sanitiser. Two limits are built in and show up
here rather than silently: Readability itself discards `<iframe>` (an embedded chart is gone before we see
it), and DOMPurify discards custom elements such as `<ft-chart>`. Inline `<svg>` and `<canvas>` survive both
stages. A chart a site renders inside a shadow root never appears in any census, because `outerHTML` has no
shadow root to serialise.

The census counts a loss, not the thing lost, so `DEBUG_SAVE_RAW_HTML=true` also writes each capture
verbatim to `backend/data/raw-captures/<title>-<url-hash>.html` before extraction. That file is the only surviving
copy of a graphic Readability or the sanitiser discarded, and it is how the two limits above were
identified. It is off by default because a capture can be as large as `MAX_ARTICLE_SIZE_MB` and holds more
than the article; the write is best-effort and can never fail the capture.

### Database Schema Key Points

- Articles have a unique constraint on `url` (UPSERT on duplicate)
- `capture_success` flag indicates if Readability extraction succeeded
- Failed captures are stored with error message in `capture_error`
- Foreign keys with CASCADE deletion (deleting article removes its images)
- Soft delete via `deleted_at`: deleting moves an article to the trash, which lists, stats and EPUB
  generation all exclude. Re-capturing the same URL revives the row. Only purging deletes it for real
- Triggers auto-update `updated_at` timestamp
- Indexes on `created_at`, `is_archived`, `is_favorite`, `site_name`, `language`
- `articles_fts` is an FTS5 index over title/content_text/excerpt, kept in step by three triggers
  (migration 003). It is an external content table, so the article text is not duplicated
- **Tag tables removed:** Do not reference `tags` or `article_tags` tables - they were deleted

### Migrations System

- Migrations are SQL files in `backend/migrations/` directory
- Naming convention: `001_initial.sql`, `002_add_feature.sql`, etc.
- Applied migrations tracked in `_migrations` table
- migrations.js sorts files alphabetically and applies only new ones

### API Endpoints

**Articles:**
- `POST /api/articles` - Create from HTML body `{ html, url }`
- `GET /api/articles` - List with pagination/filtering. `?page=1&limit=20&search=query&is_archived=false`, plus `trashed=true` for the trash. Responds with `{ articles, total, trashedTotal }`
- `GET /api/articles/:id` - Get single article (404 for a trashed one)
- `PUT /api/articles/:id` - Update `{ title?, is_archived?, is_favorite? }`
- `DELETE /api/articles/:id` - Move an article to the trash (reversible)
- `DELETE /api/articles/bulk` - Move many articles to the trash
- `PUT /api/articles/bulk` - Bulk archive/favourite
- `POST /api/articles/restore` - Restore trashed articles (this is what Undo calls)
- `DELETE /api/articles/purge` - Permanently delete trashed articles and their images
- `GET /api/articles/stats` - Aggregated statistics (live and trashed counted separately)

The bulk endpoints take their targets as `{ ids: [1, 2] }` **or** `{ filter: {...} }`, never both. The
filter form is what makes "select all N matching" work across pages: the filter object is exactly the one
the list request used, so the two can never disagree. `backend/src/utils/spaRoutes.js` and the frontend's
`utils/articleFilters.js` are the counterparts to keep in step.

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

Copy the template to the **repository root** (not `backend/`):

```bash
cp backend/.env.example .env
```

Values are validated at boot by `validateConfig()` in `config.js`. An unset variable falls back to its default, but a value that is present and invalid (non-numeric `PORT`, out-of-range `IMAGE_QUALITY`, an unknown `NODE_ENV`, ...) aborts startup with every problem listed at once. The real process environment wins over `.env`, because dotenv never overwrites an existing variable - so `PORT=4000 npm start`, or a pm2 `env` block, overrides the file.

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
CORS_ORIGIN=http://localhost:5174
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
- Images are stored under `backend/images/<title-slug>-<url-hash>/` and served at `/images/...`
- The directory name includes a hash of the article URL, so two articles with the same title cannot collide
- URLs in article HTML are replaced with local paths recorded in `article_images`
- `srcset` and `sizes` are in the sanitiser's `ALLOWED_ATTR` on purpose: passing `ALLOWED_ATTR` replaces
  DOMPurify's defaults, and a responsive image often carries its only URL in `srcset`. Losing the attribute
  there is silent and permanent, because the downloader only ever sees the sanitised HTML
- A source is chosen in this order: a lazy-loading data attribute, then the real `src`, then the largest
  candidate in the enclosing `<picture>` sources, then the largest candidate in the `<img>`'s own `srcset`.
  Widths (`800w`) and densities (`2x`) are both understood, and a `srcset` containing a `data:` URI is left
  alone rather than parsed, since a comma inside a data URI is indistinguishable from the separator
- Once an image is local its remote candidates are removed, so the reader and the EPUB never fetch the
  original again
- Requests advertise only the formats this sharp build can decode, in preference order, and retry once with
  a conservative `Accept` when a CDN answers with something unreadable (AVIF decoding is a sharp build
  option, so it is claimed only where it exists). Anything that is not already JPEG or PNG is re-encoded to
  JPEG, which keeps the bytes on disk in agreement with the `.jpg` name they are given
- If image download fails, article is still saved (images skipped)
- Deleting articles removes their recorded image files and prunes directories left empty; every path is validated to stay inside the images directory
- Trashing keeps image files so the delete stays reversible - only purging removes them

### Search
Searching is answered by the `articles_fts` FTS5 index via `utils/ftsQuery.js`, which turns input into one
quoted prefix query per term (`"rust"* "async"*`). The quoting is what stops a stray `"` or a lone `OR`
from becoming an FTS syntax error. Semantics differ from the `LIKE '%term%'` scan it replaced: matching is
per token and prefix-based, so `rust` finds "rustacean" while `ust` no longer matches "rust", and
diacritics are ignored (`cafe` finds "café"). The filter is a subquery on `id`, so bulk operations can
carry a search term and stay index-backed.

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
- `background.js` - Service worker, handles extension icon clicks and performs the capture via `chrome.scripting.executeScript`
- `content.js` - Inert: not declared in `manifest.json` and never injected; the capture function is injected inline from `background.js`
- `options.html` + `options.js` - Settings page

### Extension Features
- One-click article capture via extension icon
- Stage-by-stage progress indicators (capturing → processing → saved)
- API key configuration and validation
- Connection testing with backend
- Status feedback via a colored toolbar badge (capturing → processing → saved/failed). In-page toasts do **not** render: `background.js` calls `window.bdToast.show()`, but nothing defines `window.bdToast` and `content.js` is never injected
- First-run setup flow (auto-opens options page)

## Important Constraints

- Max HTML size: 10MB (configurable via `MAX_ARTICLE_SIZE_MB`)
- Max article content length: 500K characters (truncated if exceeded)
- SQLite connection uses WAL mode for better concurrency
- All dates stored as ISO strings in SQLite, converted to Date objects in JS
- EPUB library uses `@lesjoursfr/html-to-epub` - EPUB 3.3 compliant, validated with epubcheck
- Images stored locally in `backend/images/<title-slug>-<url-hash>/` with leading slashes for proper path resolution
- **JSDOM VirtualConsole** is used to suppress CSS parsing errors from malformed HTML

## Frontend Architecture

### State Management
- **TanStack Query (React Query)** for server state management
- Data fetching lives inline in the page components via `useQuery`/`useMutation`; there is no `hooks/` directory
- No global state library - use React state and TanStack Query's cache
- Pure, testable logic lives in `utils/` (see `utils/selection.js`)

### Styling
- **Tailwind CSS** for utility-first styling
- **@tailwindcss/typography** plugin for article content (`prose` class)
- Custom classes in `clsx` for conditional styling

### API Communication
- Single Axios instance in `services/api.js`
- The API key lives in `utils/apiKey.js` and is sent on every request as the `X-API-Key` header. It is
  kept in a cookie *and* localStorage; the cookie is the one that matters, because localStorage is scoped
  to an origin including the port, so `:5174` and `:3001` used to each demand the key separately. A key
  found only in localStorage is migrated into the cookie on first read
- Base URL configurable via environment

### Bulk selection
Selection chrome is invisible by default: a card's checkbox fades in on hover (and on keyboard focus), and
a quiet "Select" button in the page header turns selection mode on for touch and discoverability. While
selection mode is on, clicking anywhere on a card toggles it and its title stops being a link, and a
floating pill carries the count, one progressive select-all control ("Select all" -> "Select all N
matching" -> "Deselect all"), the actions, and Done. Escape exits, as does changing page, search or
filters. State lives in `Articles.jsx` as `isSelecting` (chrome on) and `scopeMode` (`page` vs `all`
matching), with the scope maths in `utils/selection.js`.

## Testing Strategy

### Backend Tests (Jest)
- Run with: `npm test` (in `/backend` directory)
- Test files: `__tests__/` directories next to source files
- Mock external dependencies (SMTP, image downloads)

### Frontend Tests (Vitest)
- Run with: `npm test` (watch) or `npm run test:run` (single pass) in `/frontend`
- Currently pure unit tests under `src/utils/`; React Testing Library is not installed, so there are no component tests yet

### Test Status
- Backend: 11 Jest suites (routes, services, database, config, utils, integration)
- Frontend: pure unit tests for `utils/selection.js`, `utils/articleFilters.js` and `utils/apiKey.js`; no component tests yet
- CI (`.github/workflows/ci.yml`) runs lint + tests on every push and pull request

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
3. Add the API call to `services/api.js` and fetch it with `useQuery` in the page
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
