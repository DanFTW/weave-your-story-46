/**
 * Weave LinkedIn Auto-Capture Popup Script
 */

const WEAVE_URL = 'https://weave-your-story-46.lovable.app';

// DOM elements
const authIndicator = document.getElementById('authIndicator');
const authStatus = document.getElementById('authStatus');
const captureIndicator = document.getElementById('captureIndicator');
const captureStatus = document.getElementById('captureStatus');
const eventsSent = document.getElementById('eventsSent');
const queueLength = document.getElementById('queueLength');
const notConnectedView = document.getElementById('notConnectedView');
const connectedView = document.getElementById('connectedView');
const loginBtn = document.getElementById('loginBtn');
const openWeaveBtn = document.getElementById('openWeaveBtn');
const logoutBtn = document.getElementById('logoutBtn');
const lastEventText = document.getElementById('lastEventText');

/**
 * Format time ago
 */
function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Update UI based on status
 */
function updateUI(status) {
  if (status.isAuthenticated) {
    authIndicator.className = 'status-indicator active';
    authStatus.textContent = 'Connected to Weave';
    captureIndicator.className = 'status-indicator active';
    captureStatus.textContent = 'Capture Active';
    notConnectedView.classList.add('hidden');
    connectedView.classList.remove('hidden');
    
    if (status.lastEvent) {
      lastEventText.textContent = `Last capture: ${formatTimeAgo(status.lastEvent)}`;
    } else {
      lastEventText.textContent = 'Browsing LinkedIn will capture new connections automatically.';
    }
  } else {
    authIndicator.className = 'status-indicator inactive';
    authStatus.textContent = 'Not Connected';
    captureIndicator.className = 'status-indicator inactive';
    captureStatus.textContent = 'Capture Inactive';
    notConnectedView.classList.remove('hidden');
    connectedView.classList.add('hidden');
  }
  
  eventsSent.textContent = status.eventsSent || 0;
  queueLength.textContent = status.queueLength || 0;
  
  if (status.queueLength > 0) {
    queueLength.style.color = '#f59e0b';
  } else {
    queueLength.style.color = '#667eea';
  }
}

/**
 * Fetch and display status
 */
async function refreshStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      updateUI(response);
    }
  });
}

/**
 * Open Weave login page
 */
function openLogin() {
  chrome.tabs.create({
    url: `${WEAVE_URL}/flow/linkedin-live?extension=connect`,
  });
  window.close();
}

/**
 * Open Weave dashboard
 */
function openDashboard() {
  chrome.tabs.create({
    url: `${WEAVE_URL}/flow/linkedin-live`,
  });
  window.close();
}

/**
 * Logout / disconnect
 */
function logout() {
  chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }, () => {
    refreshStatus();
  });
}

// Event listeners
loginBtn.addEventListener('click', openLogin);
openWeaveBtn.addEventListener('click', openDashboard);
logoutBtn.addEventListener('click', logout);

// Initial status check
refreshStatus();

// Refresh status periodically
setInterval(refreshStatus, 2000);
