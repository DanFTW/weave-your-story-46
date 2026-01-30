/**
 * Weave LinkedIn Auto-Capture Background Service Worker
 * Handles authentication and API communication
 */

const SUPABASE_URL = 'https://yatadupadielakuenxui.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/linkedin-connection-event`;

// Storage keys
const AUTH_TOKEN_KEY = 'weave_auth_token';
const AUTH_EXPIRY_KEY = 'weave_auth_expiry';

// Event queue for retry logic
let eventQueue = [];
let isProcessingQueue = false;

/**
 * Get stored auth token
 */
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_TOKEN_KEY, AUTH_EXPIRY_KEY], (result) => {
      const token = result[AUTH_TOKEN_KEY];
      const expiry = result[AUTH_EXPIRY_KEY];
      
      // Check if token is expired
      if (token && expiry && Date.now() < expiry) {
        resolve(token);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Store auth token
 */
async function setAuthToken(token, expiresIn = 3600) {
  const expiry = Date.now() + (expiresIn * 1000);
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [AUTH_TOKEN_KEY]: token,
      [AUTH_EXPIRY_KEY]: expiry,
    }, resolve);
  });
}

/**
 * Clear auth token
 */
async function clearAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([AUTH_TOKEN_KEY, AUTH_EXPIRY_KEY], resolve);
  });
}

/**
 * Send connection event to backend
 */
async function sendToBackend(data, retryCount = 0) {
  const token = await getAuthToken();
  
  if (!token) {
    console.log('[Weave BG] No auth token - queuing event');
    eventQueue.push({ data, retryCount });
    return { success: false, reason: 'not_authenticated' };
  }
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (response.status === 401) {
      // Token expired or invalid
      await clearAuthToken();
      eventQueue.push({ data, retryCount });
      return { success: false, reason: 'token_expired' };
    }
    
    const result = await response.json();
    console.log('[Weave BG] Backend response:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('[Weave BG] API error:', error);
    
    // Retry with exponential backoff
    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        sendToBackend(data, retryCount + 1);
      }, delay);
    } else {
      eventQueue.push({ data, retryCount });
    }
    
    return { success: false, reason: 'network_error' };
  }
}

/**
 * Process queued events
 */
async function processQueue() {
  if (isProcessingQueue || eventQueue.length === 0) return;
  
  const token = await getAuthToken();
  if (!token) return;
  
  isProcessingQueue = true;
  
  while (eventQueue.length > 0) {
    const item = eventQueue.shift();
    await sendToBackend(item.data, item.retryCount);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  isProcessingQueue = false;
}

/**
 * Get extension status
 */
async function getStatus() {
  const token = await getAuthToken();
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['weave_last_event', 'weave_events_sent'], (result) => {
      resolve({
        isAuthenticated: !!token,
        lastEvent: result.weave_last_event || null,
        eventsSent: result.weave_events_sent || 0,
        queueLength: eventQueue.length,
      });
    });
  });
}

/**
 * Update event counter and last event
 */
async function updateEventStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['weave_events_sent'], (result) => {
      const count = (result.weave_events_sent || 0) + 1;
      chrome.storage.local.set({
        weave_events_sent: count,
        weave_last_event: new Date().toISOString(),
      }, resolve);
    });
  });
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONNECTION_DETECTED') {
    console.log('[Weave BG] Connection event received:', message.data);
    
    sendToBackend(message.data).then(async (result) => {
      if (result.success) {
        await updateEventStats();
      }
      sendResponse(result);
    });
    
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SET_AUTH_TOKEN') {
    setAuthToken(message.token, message.expiresIn).then(() => {
      processQueue();
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_AUTH') {
    clearAuthToken().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  }
  
  if (message.type === 'PROCESS_QUEUE') {
    processQueue().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// External message handler for webapp communication
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Only accept messages from trusted origins
  const trustedOrigins = [
    'https://weave-your-story-46.lovable.app',
    'https://id-preview--8d2eeb0c-d818-441e-b5a7-935341a59544.lovable.app',
    'http://localhost:8080',
  ];
  
  if (!trustedOrigins.some(origin => sender.origin?.startsWith(origin.replace(/:\d+$/, '')))) {
    console.log('[Weave BG] Rejected message from untrusted origin:', sender.origin);
    sendResponse({ success: false, reason: 'untrusted_origin' });
    return true;
  }
  
  if (message.type === 'SET_AUTH_TOKEN') {
    console.log('[Weave BG] Auth token received from webapp');
    setAuthToken(message.token, message.expiresIn).then(() => {
      processQueue();
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  }
});

// Try to process queue periodically
setInterval(processQueue, 30000);

console.log('[Weave BG] Background service worker started');
