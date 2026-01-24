# AGENTS.md

This file provides guidance to agentic coding assistants (like Claude Code) when working with the Bookmark Digest repository. It contains build/lint/test commands, code style guidelines, and important constraints.

## Project Overview

Bookmark Digest is a self-hosted bookmarking and reading service that captures web articles (including paywalled content) via a browser extension, processes them with Mozilla Readability, stores them in SQLite, and can batch convert articles to EPUB for Kindle delivery.

**Key Technologies:**
- Backend: Node.js + Express (ES modules)
- Database: SQLite with better-sqlite3
- Article Extraction: @mozilla/readability + jsdom + DOMPurify
- EPUB Generation: @lesjoursfr/html-to-epub
- Frontend: React + Vite
- Extension: Manifest V3 (Chrome/Firefox)

## Build/Lint/Test Commands

### Backend (`/backend` directory)

```bash
cd backend

# Install dependencies
npm install

# Copy environment configuration (generates API key automatically)
cp .env.example .env

# Start development server with nodemon
npm run dev

# Start production server
npm start

# Run ESLint
npm run lint

# Run all Jest tests
npm test

# Run specific test file
npm test -- --testPathPattern=articleProcessor

# Run tests in watch mode
npm test -- --watch

# Run database migrations manually
npm run migrate
```

### Frontend (`/frontend` directory)

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server (port 5174)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run ESLint
npm run lint

# Run all Vitest tests
npm test

# Run specific test file (pattern matching)
npm test -- --run <pattern>

# Run tests in watch mode
npm test -- --watch
```

### Extension (`/extension` directory)

No build system currently; load unpacked extension in browser developer mode.

## Code Style Guidelines

### Backend (Node.js + Express)

- **Modules**: ES modules (`import`/`export`). Use `.js` extension.
- **Naming**:
  - `camelCase` for variables, functions, and methods
  - `PascalCase` for classes and constructor functions
  - `UPPER_SNAKE_CASE` for constants
- **Services**: Singleton pattern – export an instantiated object, not a class (see `articleProcessor.js`).
- **Error Handling**:
  - Use `asyncHandler` wrapper from `middleware/errorHandler.js` for route handlers.
  - Log errors with structured context: `logger.error(message, { context })`.
  - Article processing failures are saved with `capture_success=0` rather than throwing.
- **Database**:
  - Always wrap multi‑step operations in `db.transaction(() => { ... })`.
  - Use prepared statements for all queries (SQL injection protection).
  - Connection is a singleton – always get via `getConnection()`.
- **Imports**: Group external dependencies first, then internal modules.
- **Size Limits**:
  - Max HTML size: 10 MB (configurable via `MAX_ARTICLE_SIZE_MB`).
  - Max article content length: 500 K characters (truncated if exceeded).
- **Comments**: Use JSDoc for public functions; avoid inline comments unless necessary.

### Frontend (React + Vite)

- **Components**: React functional components with `PascalCase` naming.
- **Naming**: `camelCase` for variables, functions, and hooks.
- **Styling**: Tailwind CSS (utility‑first). Use `clsx` for conditional class names.
- **HTTP Client**: `axios` with interceptors for API key and error handling (see `src/services/api.js`).
- **State Management**: Server state with `@tanstack/react‑query`; local state with `useState`/`useReducer`.
- **Imports**: Group external dependencies first, then internal modules.
- **File Structure**: One component per file, default export.
- **Date Formatting**: Use `date‑fns` utilities (see `src/utils/format.js`).
- **Environment Variables**: Vite‑style (`import.meta.env.VITE_*`).

### General

- **Language**: JavaScript (no TypeScript). Use JSDoc where helpful.
- **Linting**: ESLint (configurations per project). Run `npm run lint` before committing.
- **Formatting**: No Prettier config; follow existing code indentation and spacing.
- **Line Length**: Not enforced, but keep lines readable (∼80‑100 characters).
- **Async/Await**: Prefer `async`/`await` over callbacks where possible.
- **Comments**: Avoid unnecessary comments; code should be self‑documenting.
- **Error Messages**: Provide clear, user‑friendly error messages in API responses.

## Testing Strategy

- **Backend**:
  - Unit tests for services in `__tests__/` directories.
  - API endpoint tests with Supertest.
  - Migration tests with a test database.
  - Mock external services (SMTP, image downloads) in tests.
- **Frontend**:
  - Component tests with Vitest.
  - Mock API calls with `axios` mocks.
- **Running Tests**:
  - Always run `npm test` in both `/backend` and `/frontend` before committing.
  - Fix any lint errors (`npm run lint`) before committing.

## Environment Configuration

### Backend
- Copy `backend/.env.example` to `backend/.env`.
- API key is auto‑generated on first run and stored in `config.json` at repository root.
- Key environment variables: `PORT`, `DB_PATH`, `LOG_LEVEL`, `CORS_ORIGIN`, `MAX_IMAGE_SIZE_MB`, etc.

### Frontend
- Copy `frontend/.env.example` to `frontend/.env.local`.
- Set `VITE_API_BASE` (defaults to `/api`).

## Important Constraints

- **Database**: SQLite with WAL mode for better concurrency.
- **Dates**: Stored as ISO strings in SQLite, converted to `Date` objects in JavaScript.

- **Images**: Stored locally under `./data/images/{articleId}/`. If download fails, article is still saved (images skipped).
- **Reading Time**: Based on 200 words per minute average.
- **Security**: All API endpoints (except `/health`) require an API key sent via `X‑API‑Key` header.

## References

- `CLAUDE.md` – Detailed architecture, implementation patterns, and common workflows.
- `PROJECT_PLAN.md` – High‑level project vision and roadmap.
- `STATUS.md` – Current implementation status and pending tasks.

## Cursor / Copilot Rules

No project‑specific Cursor (`.cursorrules`) or Copilot (`.github/copilot‑instructions.md`) rules exist yet. Follow the guidelines above.