# Bookmark Digest Browser Extension

Manifest V3 browser extension for capturing web articles and saving them to your local Bookmark Digest backend.

## Features

- **One-Click Saving**: Click the extension icon on any article to save it
- **Paywall Bypass**: Captures rendered DOM (works if you're logged in)
- **API Key Authentication**: Secure communication with backend
- **Connection Testing**: Verify backend connectivity from options page
- **Status Feedback**: A colored toolbar badge shows capturing / processing / saved / failed (see [Known Limitations](#known-limitations))

## Installation

### Load Unpacked Extension (Chrome/Edge)

1. Open your browser and navigate to:
   - Chrome/Edge: `chrome://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`

2. Enable **Developer Mode** (toggle in top right)

3. Click **Load unpacked**

4. Navigate to and select the `extension/` folder in this project

## Configuration

### First Time Setup

1. **Start the Backend Server**:
   ```bash
   # From the repository root first — the backend resolves its env file as
   # <repo>/.env, so a .env placed inside backend/ is silently ignored.
   cp backend/.env.example .env

   cd backend
   npm install
   npm run dev
   ```

2. **Get Your API Key**:
   - The server generates an API key automatically on first run and prints it to the console
   - Find it in `config.json` at the **repository root** (not `backend/config.json`)

3. **Configure Extension**:
   - Right-click the extension icon → **Options**
   - Paste your API key
   - Click **Save Settings**
   - Click **Test Connection** to verify

### Backend Server

The extension connects to `http://localhost:3001` by default. To change this:

1. Edit `extension/manifest.json`
2. Update the `host_permissions` array
3. Update the `API_BASE` constant in `extension/background.js`
4. Reload the extension

## Usage

### Saving an Article

1. Navigate to any web article in your browser
2. Click the Bookmark Digest extension icon
3. Wait for the capture notification
4. Article is saved to your local database

### Managing Articles

Currently, saved articles can be accessed via:
- **API**: Use the REST endpoints directly
- **Database**: Query `backend/data/bookmark-digest.db`
- **Web UI**: Browse and manage articles at `http://localhost:5174`

### Troubleshooting

#### "Configuration Required" Error

**Cause**: API key not set in extension options

**Solution**:
1. Right-click extension icon → Options
2. Paste the API key from `config.json` at the repository root
3. Save settings

#### "Server is not running" Error

**Cause**: Backend server not started

**Solution**:
```bash
cd backend
npm run dev
```

#### "Invalid API key" Error

**Cause**: Incorrect API key in extension settings

**Solution**:
1. Copy the API key from `config.json` at the repository root
2. Update in extension options
3. Test connection

#### Article Not Capturing

**Cause**: Content script execution failed

**Solution**:
- Check browser console for errors (F12)
- Ensure page has fully loaded
- Try refreshing the page and clicking again

## Extension Files

```
extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker (main logic)
├── content.js            # Content script utilities
├── options.html          # Settings page UI
├── options.js            # Settings page logic
├── options.css           # Settings page styles
└── icons/
    ├── icon.svg          # Vector icon source
    ├── icon16.png        # 16x16 icon
    ├── icon48.png        # 48x48 icon
    └── icon128.png       # 128x128 icon
```

## Permissions

The extension requires the following permissions:

- **activeTab**: Access the current tab's content
- **scripting**: Inject scripts to capture page content
- **storage**: Save API key in local storage

## Architecture

### Save Flow

1. User clicks extension icon
2. Background script injects content script
3. Content script captures `document.documentElement.outerHTML`
4. Data sent to background script
5. Background sends POST to `http://localhost:3001/api/articles`
6. Backend processes with Readability
7. Article saved to SQLite database
8. User receives notification

### Communication

- **Background → Content Script**: `chrome.scripting.executeScript()`
- **Options → Background**: `chrome.runtime.sendMessage()`
- **Background → Backend**: `fetch()` with API key header

## Icons

The extension includes placeholder icons. For production use, replace with custom icons:

### Option 1: Online Converter
1. Visit https://cloudconvert.com/svg-to-png
2. Upload `extension/icons/icon.svg`
3. Convert at 16x16, 48x48, and 128x128
4. Replace the placeholder PNG files

### Option 2: ImageMagick
```bash
cd extension/icons
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Option 3: Sharp (Node.js)
```bash
cd backend
npx sharp ../extension/icons/icon.svg -resize 16 ../extension/icons/icon16.png
npx sharp ../extension/icons/icon.svg -resize 48 ../extension/icons/icon48.png
npx sharp ../extension/icons/icon.svg -resize 128 ../extension/icons/icon128.png
```

## Development

### Debugging

**Background Script**:
1. Go to `chrome://extensions/`
2. Find "Bookmark Digest"
3. Click "Service worker" to open DevTools

**Options Page**:
1. Right-click extension icon → Options
2. Press F12 to open DevTools

**Content Script**:
1. Navigate to a web page
2. Press F12 to open DevTools
3. Check Console tab

### Reloading After Changes

1. Go to `chrome://extensions/`
2. Find "Bookmark Digest"
3. Click the refresh icon 🔄

### Console Logs

The extension logs to:
- Background script: Extension service worker console
- Content script: Page console (when saving)
- Options page: Options page console

## Browser Compatibility

- ✅ Chrome/Edge (Manifest V3)
- ⚠️ Firefox (Manifest V3 support in progress)
- ❌ Safari (Manifest V3 not supported)

## Known Limitations

- **In-page toasts do not render.** `background.js` calls `window.bdToast.show()`, but `window.bdToast` is never defined and `content.js` is neither declared in `manifest.json` nor injected, so only the toolbar badge appears. `content.js` is currently inert.
- **Icons are 1×1 placeholders.** `extension/icons/icon{16,48,128}.png` are 1×1 PNGs; regenerate them (see [Icons](#icons)) for real artwork.
- **Firefox MV3 support is partial.** `manifest.json` declares `background.service_worker`, whereas Firefox expects `background.scripts`.

## Security

- API keys stored in `chrome.storage.local` (not synced)
- HTTPS not required for localhost
- No third-party tracking or analytics
- No data sent to external servers

## License

Same as parent project (Bookmark Digest)
