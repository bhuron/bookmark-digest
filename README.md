# Bookmark Digest

A local, self-hosted bookmarking and reading digest service that extracts web articles (including paywalled content) directly from browser tabs, saves them for later reading, and can batch convert selected articles to EPUB for Kindle delivery.

## Features

- **Browser Extension** (Chrome/Firefox) - One-click article capture from any webpage
- **Web UI** - React-based interface for managing articles
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

### 1. Backend Setup

```bash
cd backend
npm install

# Copy environment configuration (creates .env at project root)
cp backend/.env.example .env

npm start
```

The server will:
1. Generate an API key on first run (saved to `config.json`)
2. Initialize the SQLite database
3. Start on `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Optional: Copy environment configuration (for custom API base URL)
cp .env.example .env.local

npm run dev
```

The web UI will be available at `http://localhost:5174`

On first load, you'll need to enter the API key from `backend/config.json`.

### 3. Browser Extension Installation

1. Open your browser's extension management page:
   - Chrome: `chrome://extensions`
   - Firefox: `about:debugging#/runtime/this-firefox`

2. Enable **Developer Mode**

3. Click **Load unpacked** and select the `/extension` directory

4. Click the extension icon to configure:
   - Set the Backend URL (default: `http://localhost:3001`)
   - Enter your API key (from `backend/config.json`)

5. Test by clicking the extension icon on any article page

### Verify Installation

```bash
# Backend health check (no auth required)
curl http://localhost:3001/health

# Check API status (requires API key)
API_KEY=$(cat backend/config.json | grep apiKey -A 1 | grep -o '"[^"]*"' | tail -1)
curl -H "X-API-Key: $API_KEY" http://localhost:3001/api/status
```

## API Key Authentication

All `/api/*` endpoints require an API key sent via the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3001/api/articles
```

The API key is automatically generated on first run and saved to `backend/config.json`.

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
  - Query params: `?page=1&limit=20&search=query&is_archived=false`
- `GET /api/articles/:id` - Get single article
- `PUT /api/articles/:id` - Update article properties
- `DELETE /api/articles/:id` - Delete article
- `GET /api/articles/stats` - Get aggregated statistics

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

### Recent Bug Fixes
- **Image display** - Fixed missing leading slash in image paths
- **CSS parsing errors** - Suppressed JSDOM errors with VirtualConsole
- **Article typography** - Added Tailwind Typography plugin
- **EPUB library** - Replaced buggy @storyteller-platform/epub with @lesjoursfr/html-to-epub
- **EPUB spine** - Fixed broken spine structure causing Kindle rejection
- **SMTP validation** - Fixed validation for optional fromEmail field
- **UI notifications** - Modernized extension UI with in-page toast notifications

## Future Enhancements

Potential features for future development:
- Full-text search
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
# Re-run migrations
npm run migrate

# Or delete and start fresh
rm data/bookmark-digest.db
npm start
```

### API Key Issues
```bash
# View your API key
cat backend/config.json

# Regenerate (delete config.json and restart)
rm backend/config.json
npm start
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Migrate database
npm run migrate
```

## Contributing

This project uses:
- **@lesjoursfr/html-to-epub** - EPUB 3.3 compliant generation (validated with epubcheck)
- **API key authentication** - All API endpoints require `X-API-Key` header
- **Database migrations** - SQLite schema managed via `backend/migrations/*.sql`
- **Comprehensive logging** - Winston-based structured logging
- **JSDOM VirtualConsole** - Suppresses CSS parsing errors from malformed HTML

## License

MIT
