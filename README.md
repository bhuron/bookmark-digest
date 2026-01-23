# Bookmark Digest

A local, self-hosted bookmarking and reading digest service that extracts web articles (including paywalled content) directly from browser tabs, saves them for later reading, and can batch convert selected articles to EPUB for Kindle delivery.

## Current Status

**✅ Backend (Phase 1-3): COMPLETE**
- Node.js/Express server with API key authentication
- SQLite database with migrations
- Article processing with Readability
- EPUB generation with @storyteller-platform/epub
- Image handling and optimization
- All CRUD API endpoints

**🔨 In Progress:**
- Browser Extension (Phase 4)
- Frontend UI (Phase 5)
- Testing (Phase 7)

## Quick Start

### Prerequisites
- Node.js 18+ (Note: Node.js 24 may have compatibility issues with some native modules)
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The server will:
1. Generate an API key on first run (saved to `config.json`)
2. Initialize the SQLite database
3. Start on `http://localhost:3001`

### Test the Server

```bash
# Health check (no auth required)
curl http://localhost:3001/health

# API status (requires API key)
API_KEY="your-api-key-here"
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
- `GET /api/articles` - List articles with pagination
- `GET /api/articles/:id` - Get single article
- `PUT /api/articles/:id` - Update article
- `DELETE /api/articles/:id` - Delete article
- `POST /api/articles/:id/tags` - Add tags to article
- `DELETE /api/articles/:id/tags/:tagId` - Remove tag
- `GET /api/articles/stats` - Get statistics

### EPUB
- `POST /api/epub/generate` - Generate EPUB from articles
- `GET /api/epub/exports` - List exports
- `GET /api/epub/exports/:id` - Get export details
- `GET /api/epub/exports/:id/download` - Download EPUB
- `DELETE /api/epub/exports/:id` - Delete export
- `POST /api/epub/exports/:id/send-to-kindle` - Send to Kindle

### Tags
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag
- `GET /api/tags/:id/articles` - Get articles with tag

## Database

SQLite database with the following tables:
- `articles` - Stored articles with metadata
- `tags` - Tag definitions
- `article_tags` - Article-tag relationships
- `article_images` - Downloaded images
- `epub_exports` - EPUB export history
- `settings` - Application settings

## Configuration

Environment variables (see `backend/.env.example`):

```env
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/bookmark-digest.db

# Kindle/SMTP (optional)
KINDLE_EMAIL=your_kindle_email@kindle.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## Next Steps

### Immediate (Ready to Implement)
1. **Browser Extension** - Manifest V3 extension for capturing pages
2. **Frontend UI** - React-based web interface
3. **Testing** - Unit and integration tests

### Future Enhancements
- Full-text search
- Newsletter generation
- Import from Pocket/Instapaper
- Mobile app (React Native)
- AI-powered summarization

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

This project follows the corrected implementation plan which addresses:
- ✅ Replaced unmaintained `epub-gen` with `@storyteller-platform/epub`
- ✅ Added API key authentication
- ✅ Fixed browser extension architecture
- ✅ Enhanced error handling
- ✅ Database constraints and migrations
- ✅ Comprehensive logging

## License

MIT
