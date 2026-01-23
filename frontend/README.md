# Bookmark Digest - Frontend

React frontend for Bookmark Digest application.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Configuration

The frontend connects to the backend API at `http://localhost:3001/api` by default.

### API Key

To use the app, you need to configure your API key:

1. Get the API key from `backend/config.json`
2. Open the app and go to Settings
3. Enter the API key

Or set it in localStorage directly:
```javascript
localStorage.setItem('bookmark_digest_api_key', 'your-api-key-here')
```

## Features

- **Articles**: Browse, search, and filter saved articles
- **Article Viewer**: Read articles with formatting preserved
- **Tags**: Create and manage tags to organize articles
- **Settings**: Configure API key and view statistics

## Tech Stack

- React 18 with Vite
- Tailwind CSS for styling
- React Router for navigation
- TanStack Query for data fetching
- Lucide React for icons
