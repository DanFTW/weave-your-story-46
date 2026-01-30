# Weave LinkedIn Auto-Capture Extension

A Chrome Extension (Manifest V3) that automatically captures new LinkedIn connections and saves them as memories in Weave.

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select this `extension` folder

## How It Works

1. **Content Script**: Runs on all `linkedin.com` pages and monitors for connection events:
   - Toast notifications ("You're now connected with...")
   - "Accept" button clicks on invitation cards
   - Profile page state changes (Connect → Message)

2. **Background Service Worker**: Manages authentication and sends events to Weave backend:
   - Stores auth token from Weave webapp
   - Queues events when offline or unauthenticated
   - Retries failed requests with exponential backoff

3. **Popup UI**: Shows connection status and statistics

## Authentication Flow

1. Click the extension icon
2. Click "Connect to Weave"
3. Log in to Weave (if not already logged in)
4. The webapp automatically sends the auth token to the extension
5. The extension starts capturing connections automatically

## Privacy

- The extension only runs on `linkedin.com`
- Profile data is only sent when a new connection event is detected
- All data is sent securely to your Weave account
- No data is shared with third parties

## Troubleshooting

- **"Not Connected" status**: Click "Connect to Weave" and log in
- **Events in queue**: Extension will retry automatically when authenticated
- **No captures**: Make sure you're browsing LinkedIn with the extension enabled
