# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bookmark Digest is a self-hosted bookmarking and reading service that captures web articles (including paywalled content) via a browser extension, processes them with Mozilla Readability, stores them in SQLite, and can batch convert articles to EPUB for Kindle delivery.

**Key Technologies:**
- Backend: Node.js + Express (ES modules)
- Database: SQLite with better-sqlite3
- Article Extraction: @mozilla/readability + jsdom + DOMPurify
- EPUB Generation: @storyteller-platform/epub
- Frontend: React + Vite (planned)
- Extension: Manifest V3 (Chrome/Firefox)

## Development Commands

### Backend (in `/backend` directory)
```bash
npm install              # Install dependencies
cp .env.example .env     # Configure environment (generates API key automatically)
npm run dev              # Start development server with nodemon
npm start                # Start production server
npm run lint             # Run ESLint
npm test                 # Run Jest tests
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
│   └── kindleService.js     # Email delivery via nodemailer
├── routes/
│   ├── articles.js       # Article CRUD endpoints
│   ├── epub.js           # EPUB generation endpoints
│   └── tags.js           # Tag management endpoints
├── middleware/
│   ├── auth.js           # API key validation
│   ├── errorHandler.js   # Async error handling wrapper
│   ├── validation.js     # Request validation with express-validator
│   └── rateLimiter.js    # Rate limiting (express-rate-limit)
└── utils/
    └── logger.js         # Winston logger
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
- Foreign keys with CASCADE deletion (deleting article removes its tags/images)
- Triggers auto-update `updated_at` timestamp
- Indexes on `created_at`, `is_archived`, `is_favorite`, `site_name`, `language`

### Migrations System

- Migrations are SQL files in `backend/migrations/` directory
- Naming convention: `001_initial.sql`, `002_add_feature.sql`, etc.
- Applied migrations tracked in `_migrations` table
- migrations.js sorts files alphabetically and applies only new ones

### API Endpoints

**Articles:**
- `POST /api/articles` - Create from HTML body `{ html, url, tags? }`
- `GET /api/articles` - List with pagination/filtering `?page=1&limit=20&tag=name&search=query`
- `GET /api/articles/:id` - Get single article
- `PUT /api/articles/:id` - Update `{ title?, is_archived?, is_favorite? }`
- `DELETE /api/articles/:id` - Delete article
- `POST /api/articles/:id/tags` - Add tags `{ tags: ["tag1", "tag2"] }`
- `DELETE /api/articles/:id/tags/:tagId` - Remove tag
- `GET /api/articles/stats` - Aggregated statistics

**EPUB:**
- `POST /api/epub/generate` - Generate EPUB `{ articleIds: [], title?, author? }`
- `GET /api/epub/exports` - List export history
- `GET /api/epub/exports/:id/download` - Download EPUB file
- `POST /api/epub/exports/:id/send-to-kindle` - Email to Kindle

**Tags:**
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

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

The browser extension (not yet implemented) should:
1. Use Manifest V3 with `activeTab`, `scripting`, `storage` permissions
2. Send POST requests to `http://localhost:3001/api/articles` with:
   - Header: `X-API-Key: <key from config.json>`
   - Body: `{ html: document.documentElement.outerHTML, url: window.location.href, tags: [] }`
3. Handle success/error responses

## Important Constraints

- Max HTML size: 10MB (configurable via `MAX_ARTICLE_SIZE_MB`)
- Max article content length: 500K characters (truncated if exceeded)
- SQLite connection uses WAL mode for better concurrency
- All dates stored as ISO strings in SQLite, converted to Date objects in JS
- Tags are normalized to lowercase and trimmed

## Testing Strategy

When adding features:
1. Add unit tests for services in `__tests__/` directories
2. Test API endpoints with Supertest
3. Test migrations with a test database
4. Mock external services (SMTP, image downloads) in tests

## Common Patterns

**Creating a new migration:**
1. Create `backend/migrations/003_feature_name.sql`
2. Use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` statements
3. Restart server to auto-apply migration

**Adding a new API endpoint:**
1. Add route handler in appropriate `routes/*.js` file
2. Add validation rules in `middleware/validation.js` if needed
3. Wrap handler with `asyncHandler` for error handling
4. Update this file if the pattern changes

**Adding a new service:**
1. Create file in `backend/src/services/`
2. Export a singleton instance (not the class)
3. Import where needed with `import service from './services/serviceName.js'`
