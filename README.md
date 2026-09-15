# Bookmark Digest

A local, self-hosted bookmarking and reading digest service that extracts web articles (including paywalled content) directly from browser tabs, saves them for later reading, and can batch convert selected articles to EPUB for Kindle delivery.

## Features

- **Browser Extension** (Chrome/Firefox) - One-click article capture from any webpage
- **Web UI** - React-based interface for managing articles
- **Trash & Undo** - Deleting moves articles to a trash you can restore from, individually or in bulk
- **Full-text search** - SQLite FTS5 index over titles and article text; word-prefix matching, diacritic-insensitive
- **EPUB Generation** - Batch convert articles to EPUB 3.3 format
- **Kindle Integration** - Email EPUBs directly to your Kindle
- **Local Storage** - SQLite database with all content stored locally
- **Paywall Support** - Captures content from browser DOM (works with some paywalled content)

## Current Status

**✅ Backend: COMPLETE**
- Node.js/Express server with API key authentication
- SQLite database with migrations
- Article processing with Mozilla Readability
- EPUB generation with @lesjoursfr/html-to-epub
- Image handling and optimization (Sharp)
- All CRUD API endpoints

**✅ Browser Extension: COMPLETE**
- Manifest V3 (Chrome/Firefox compatible)
- One-click article capture
- Progress indicators and error handling
- API key configuration

**✅ Frontend: COMPLETE**
- React + Vite + TanStack Query
- Article management and filtering
- EPUB generation interface
- Kindle settings configuration

**🔨 Testing: PARTIAL**
- Test infrastructure set up
- Additional tests needed

## Quick Start

### Prerequisites
- Node.js 18+ (Note: Node.js 24 may have compatibility issues with some native modules)
- npm or yarn

### Start everything from the root

```bash
npm run setup     # one-time: installs root, backend and frontend dependencies, creates .env
npm run dev       # backend on :3001 and the UI on :5174, both auto-reloading
```

`npm run dev` runs both services in one terminal with prefixed output, and Ctrl-C stops both. On first
start the backend prints an **API key** — the UI and the browser extension both need it.

### Or serve it as a single process

```bash
npm run serve     # builds the UI, then serves the UI and the API together on :3001
```

Everything is then on `http://localhost:3001`: one process, one port, no CORS hop. The pm2 scripts
(`npm start`, `npm stop`, `npm logs` …) run the same thing in the background.

There is no Vite dev server in this mode, so **nothing listens on `:5174`** — that port only exists
under `npm run dev`. The backend prints the Web UI URL it is serving on startup.

### Running each side by hand

```bash
# Backend. The env file belongs at the repository root - the backend resolves it
# as <repo>/.env, so a .env placed inside backend/ is silently ignored.
cp backend/.env.example .env

cd backend
npm install
npm run dev          # or: npm start
```

The server will:
1. Generate an API key on first run (saved to `config.json` at the repository root)
2. Initialize the SQLite database
3. Start on `http://localhost:3001`

```bash
cd frontend
npm install

# Optional: only needed for a custom API base URL
cp .env.example .env.local

npm run dev
```

The web UI is then at `http://localhost:5174`, and the Vite dev server proxies `/api` to
`http://localhost:3001`. On first load you need to enter the API key from `config.json`. It is remembered
in a cookie (and localStorage), and because cookies ignore the port, entering it once covers both `:5174`
and `:3001`.

### Browser Extension Installation

1. Open your browser's extension management page:
   - Chrome: `chrome://extensions`
   - Firefox: `about:debugging#/runtime/this-firefox`

2. Enable **Developer Mode**

3. Click **Load unpacked** and select the `/extension` directory

4. Click the extension icon to configure:
   - Set the Backend URL (default: `http://localhost:3001`)
   - Enter your API key (from `config.json` at the repository root)

5. Test by clicking the extension icon on any article page

### Verify Installation

```bash
# Backend health check (no auth required)
curl http://localhost:3001/health

# Check API status (requires API key; run from the repository root)
API_KEY=$(node -e "console.log(require('./config.json').apiKey)")
curl -H "X-API-Key: $API_KEY" http://localhost:3001/api/status
```

## Production (single process)

The backend also serves the built frontend, so a production install is one process on one port:

```bash
npm run build     # build frontend/ into frontend/dist
npm start         # pm2 starts backend/, serving the API and the UI on :3001
```

The web UI is then at `http://localhost:3001` — there is no separate frontend server and no CORS hop,
because the UI and the API share an origin. `npm start` needs pm2 (a root devDependency), so run
`npm install` at the repository root once. If `frontend/dist` is missing, the backend skips static
serving and logs a hint; that is the normal state during development, where the Vite dev server runs
on `:5174` instead.

## API Key Authentication

All `/api/*` endpoints require an API key sent via the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3001/api/articles
```

The API key is automatically generated on first run and saved to `config.json` at the repository root.

## NPM Deprecation Warnings

You may see these warnings during installation:

```
npm warn deprecated whatwg-encoding@2.0.6
npm warn deprecated abab@2.0.6
npm warn deprecated glob@7.2.3
npm warn deprecated domexception@4.0.0
```

### What These Mean

These are **transitive dependencies** (dependencies of our dependencies) from the `jsdom` package, which is required for article content extraction. These warnings:

- **Do not affect functionality** - Everything works correctly
- **Cannot be easily fixed** - We're waiting for `jsdom` to update their dependencies
- **Are safe to ignore** - These are deprecated but not vulnerable

### Solutions

If you want to suppress these warnings:

**Option 1: Use npm's built-in warning suppression**
```bash
npm install --silent
# or
npm install --no-audit --no-fund
```

**Option 2: Add to .npmrc**
```bash
echo "loglevel=error" >> ~/.npmrc
```

**Option 3: Wait for upstream updates**
These warnings will be resolved when `jsdom` updates their dependencies in a future release.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Backend       │    │   Frontend      │
│   Extension     │────▶   Server        │◀───▶   Web UI        │
│   (Manifest V3) │    │   (Express)     │    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## API Endpoints

### Health & Status
- `GET /health` - Health check (no auth)
- `GET /api/status` - Service status (requires auth)

### Articles
- `POST /api/articles` - Create article from HTML
- `GET /api/articles` - List articles with pagination and filtering
  - Query params: `?page=1&limit=20&search=query&is_archived=false`, or `trashed=true` for the trash
- `GET /api/articles/:id` - Get single article
- `PUT /api/articles/:id` - Update article properties
- `DELETE /api/articles/:id` - Move an article to the trash (reversible)
- `DELETE /api/articles/bulk` - Move many articles to the trash
- `PUT /api/articles/bulk` - Bulk archive or favourite
- `POST /api/articles/restore` - Restore trashed articles
- `DELETE /api/articles/purge` - Permanently delete trashed articles and their images
- `GET /api/articles/stats` - Get aggregated statistics

The bulk endpoints target either `{ "ids": [1, 2, 3] }` (max 500) or `{ "filter": { ... } }`, which
selects the whole matching set server-side — that is how "select all N matching" spans pages.

Search (`?search=`) is served from the FTS5 index rather than a `LIKE` scan: terms match whole words by
prefix and ignore diacritics, so `cafe` finds "café".

### EPUB
- `POST /api/epub/generate` - Generate EPUB from articles
  - Body: `{ articleIds: [], title?, author? }`
- `GET /api/epub/exports` - List export history
- `GET /api/epub/exports/:id` - Get export details
- `GET /api/epub/exports/:id/download` - Download EPUB file
- `DELETE /api/epub/exports/:id` - Delete export
- `POST /api/epub/exports/:id/send-to-kindle` - Email EPUB to Kindle

### Settings
- `GET /api/settings` - Get all application settings
- `PUT /api/settings` - Update settings (e.g., Kindle/SMTP configuration)
- `POST /api/settings/test-smtp` - Test SMTP configuration



## Database

SQLite database with the following tables:
- `articles` - Stored articles with metadata (title, url, author, reading time, etc.)
- `article_images` - Downloaded images linked to articles
- `epub_exports` - EPUB export history
- `settings` - Application settings (Kindle email, SMTP config, etc.)
- `_migrations` - Tracks applied database migrations

## Backup and restore

Your articles, the Kindle/SMTP settings, the API key and the SMTP password exist only in
`backend/data/bookmark-digest.db`, `config.json` and `.env` — none of which are in git. Losing them means
recreating all of it.

```bash
npm run backup                  # -> backups/<timestamp>/
npm run backup -- /path/to/dir  # -> somewhere else, e.g. a synced folder
```

That copies the database, `config.json` and `.env`, all with owner-only (`600`) permissions. The database
is copied with SQLite's `VACUUM INTO`, not `cp`: in WAL mode recent commits can still be in the `-wal`
file, so a plain file copy can produce a stale or torn backup with no error. Image files
(`backend/images/`) and EPUB exports are not included.

To restore, stop the server and copy the files back:

```bash
cp backups/<timestamp>/bookmark-digest.db backend/data/bookmark-digest.db
cp backups/<timestamp>/config.json .
```

## Configuration

Environment variables (see `backend/.env.example`):

```env
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
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# CORS
CORS_ORIGIN=http://localhost:5174
```

## Development

### Backend
```bash
cd backend
npm install
npm run dev              # Start with nodemon for auto-reload
npm start               # Production start
npm run migrate         # Run database migrations manually
npm run lint            # Run ESLint
npm test                # Run Jest tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Start Vite dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # Run ESLint
npm test                # Run Vitest tests
```

## Known Issues

### Tag Feature Removed
The tag feature was previously implemented but has been removed due to bugs. All tag-related database tables, API endpoints, and frontend components have been deleted. Do not attempt to restore or reference tag functionality.

### Some images or charts are not captured
The images a capture keeps are the ones the extension could see in `document.documentElement.outerHTML`
and that survive extraction. Three limits are worth knowing, and each capture reports them:

- A `srcset`-only image is now downloaded (its largest candidate), so responsive images are kept. `srcset`
  was previously stripped by the sanitiser and such images were silently skipped.
- An embedded `<iframe>` is dropped by Readability before the image pipeline runs, and a custom element such
  as `<ft-chart>` is dropped by DOMPurify. A chart delivered that way cannot be captured; only an inline
  `<svg>` or `<canvas>` survives.
- A chart a site draws inside a shadow root never reaches the capture at all, because `outerHTML` has no
  shadow root to serialise.

Every capture writes one `Graphics census` log line with the `img`, `picture`, `srcset`, `svg`, `canvas`,
`iframe`, `figure` and custom-element counts before extraction, after Readability and after sanitising
(`debug` level for ordinary photo-only articles, `info` as soon as something else is present). Comparing the
three tells you which stage lost the graphic, or that it was never in the capture.

The census counts what a stage dropped, never what it was. To identify the graphics themselves, set
`DEBUG_SAVE_RAW_HTML=true` (in the root `.env`) and capture the article once more: the untouched HTML is
written to `data/raw-captures/<title>-<url-hash>.html`, which is the only place the dropped markup still
exists. The directory is gitignored and the flag is off by default, because each file can be as large as
`MAX_ARTICLE_SIZE_MB` and holds more than the article.

### Recent Bug Fixes
- **Image display** - Fixed missing leading slash in image paths
- **CSS parsing errors** - Suppressed JSDOM errors with VirtualConsole
- **Article typography** - Added Tailwind Typography plugin
- **EPUB library** - Replaced buggy @storyteller-platform/epub with @lesjoursfr/html-to-epub
- **EPUB spine** - Fixed broken spine structure causing Kindle rejection
- **SMTP validation** - Fixed validation for optional fromEmail field
- **Extension save feedback** - Toolbar badge shows capturing → processing → saved/failed (badge only; the in-page toast path is not wired up)

## Future Enhancements

Potential features for future development:
- Newsletter generation
- Import from Pocket/Instapaper
- Mobile app (React Native)
- AI-powered summarization
- Tag system (re-implementation)

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 npm start
```

### Database Issues
```bash
# From the backend/ directory
npm run migrate

# Or delete and start fresh
rm data/bookmark-digest.db
npm start
```

### API Key Issues
```bash
# View your API key (from the repository root)
cat config.json

# Regenerate: delete it and restart the server
rm config.json
cd backend && npm start
```

## Continuous Integration

`.github/workflows/ci.yml` runs the same checks on every push and pull request to `master`:

- **Backend** — `npm run lint`, `npm test`
- **Frontend** — `npm run lint`, `npm run test:run`, `npm run build`

Reproduce them locally with `npm run lint && npm test` in `backend/`, and `npm run lint && npm run test:run` in `frontend/`.

## Contributing

This project uses:
- **@lesjoursfr/html-to-epub** - EPUB 3.3 compliant generation (validated with epubcheck)
- **API key authentication** - All API endpoints require `X-API-Key` header
- **Database migrations** - SQLite schema managed via `backend/migrations/*.sql`
- **Comprehensive logging** - Winston-based structured logging
- **JSDOM VirtualConsole** - Suppresses CSS parsing errors from malformed HTML

## License

MIT
