# Bookmark Digest Browser Extension

Manifest V3 browser extension for capturing web articles and saving them to your local Bookmark Digest
backend. It runs in Chromium browsers (Chrome, Edge) and in Firefox-based browsers (Firefox 128+, Zen).

## Installation

### Chrome / Edge

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** and select the `extension/` folder

### Firefox / Zen

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `extension/manifest.json`

Temporary add-ons disappear when the browser restarts. For a permanent install, package the folder
(`npx web-ext build --source-dir extension`) and either sign the result as an unlisted add-on on
[addons.mozilla.org](https://addons.mozilla.org/developers/) or load the unsigned XPI in a build that
accepts it (Developer Edition and Nightly do; release Firefox requires a signature).

Firefox 128 or newer is required: the manifest declares both `background.service_worker` (Chrome) and
`background.scripts` (Firefox), and the `data_collection_permissions` block used for AMO signing is
rejected outright by Firefox 127 and older.

## Features

- **One-Click Saving**: Click the extension icon on any article to save it
- **Paywall Bypass**: Captures rendered DOM (works if you're logged in)
- **API Key Authentication**: Secure communication with backend
- **Connection Testing**: Verify backend connectivity from options page
- **Status Feedback**: A colored toolbar badge shows capturing / processing / saved / failed (see [Known Limitations](#known-limitations))

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

3. **Configure Extension** (the options page also opens automatically on first install):
   - Chrome/Edge: right-click the extension icon → **Options**
   - Firefox/Zen: `about:addons` → Bookmark Digest → **Preferences**
   - Paste your API key
   - Click **Save Settings**
   - Click **Test Connection** to verify

### Backend Server

The extension connects to `http://localhost:3001` by default. To change this:

1. Update the `host_permissions` array in `extension/manifest.json`
2. Update the `API_BASE` constant in `extension/background.js` (saving) **and**
   `extension/options.js` (the options page's connection test)
3. Reload the extension

Firefox match patterns cannot include a port, so `host_permissions` must be `http://localhost/*` (or
`http://your-host/*`); the port belongs only in `API_BASE`.

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

#### "Connection failed" while the backend is running (Firefox)

**Cause**: Firefox ignores host permissions that contain a port. With `http://localhost:3001/*` in
`host_permissions`, the extension has no cross-origin access, and `fetch` fails with a CORS/NetworkError
even though the server is up.

**Solution**:
1. Use `http://localhost/*` in `host_permissions` (no port); keep `http://localhost:3001` in `API_BASE`
2. Reload the temporary add-on in `about:debugging`
3. Check `about:addons` → Bookmark Digest → **Permissions** that localhost access is enabled

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
├── background.js          # Background script (service worker in Chrome, event page in Firefox)
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
- **storage**: Save API key in extension storage
- **host_permissions** (`http://localhost/*`): Talk to the local backend. Firefox shows this in the
  install prompt and users can revoke it from the extensions panel. Match patterns cannot contain a port
  in Firefox, so the port lives only in `API_BASE`.

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

- **Background → Content Script**: `api.scripting.executeScript()`
- **Options → Background**: `api.runtime.sendMessage()`
- **Background → Backend**: `fetch()` with API key header

`api` is `browser` when it exists (Firefox) and `chrome` otherwise. Both are used in their
promise-returning form, which Chrome MV3 supports when no callback is passed.

## Icons

The PNGs are generated from `extension/icons/icon.svg` with the backend's sharp dependency:

```bash
npm run icons
```

Edit the SVG, then re-run that command. The committed PNGs are already generated, so this is only
needed when the artwork changes.

## Development

### Debugging

**Background Script**:
- Chrome/Edge: `chrome://extensions/` → Bookmark Digest → **Service worker**
- Firefox/Zen: `about:debugging#/runtime/this-firefox` → Bookmark Digest → **Inspect**

**Options Page**:
1. Right-click extension icon → Options
2. Press F12 to open DevTools

**Content Script**:
1. Navigate to a web page
2. Press F12 to open DevTools
3. Check Console tab

### Reloading After Changes

- Chrome/Edge: `chrome://extensions/` → refresh icon 🔄
- Firefox/Zen: `about:debugging#/runtime/this-firefox` → **Reload** (temporary add-ons)

### Console Logs

The extension logs to:
- Background script: service worker console (Chrome) / event page console (Firefox)
- Content script: Page console (when saving)
- Options page: Options page console

## Browser Compatibility

- ✅ Chrome/Edge 121+ (Manifest V3, service worker background)
- ✅ Firefox 121+ (Manifest V3, event page background)
- ✅ Zen and other Firefox derivatives (same engine and manifest)
- ❌ Safari (uses a different extension format)

## Known Limitations

- **In-page toasts do not render.** `background.js` calls `window.bdToast.show()`, but `window.bdToast` is never defined and `content.js` is neither declared in `manifest.json` nor injected, so only the toolbar badge appears. `content.js` is currently inert.

## Security

- API keys stored in extension storage (`storage.local`, not synced)
- HTTPS not required for localhost
- No third-party tracking or analytics
- No data sent to external servers

## License

Same as parent project (Bookmark Digest)
