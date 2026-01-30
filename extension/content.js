/**
 * Weave LinkedIn Auto-Capture Content Script
 * Detects new LinkedIn connections via DOM observation
 */

// Throttle storage key prefix
const THROTTLE_PREFIX = 'weave_li_throttle_';
const THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Profile URL normalization pattern
const PROFILE_URL_PATTERN = /linkedin\.com\/in\/([^\/\?#]+)/;

// Connection detection selectors
const TOAST_SELECTORS = [
  '[data-test-artdeco-toast-item__message]',
  '.artdeco-toast-item__message',
  '.artdeco-toast-item',
  '.msg-overlay-bubble-header',
];

const CONNECTION_SUCCESS_PHRASES = [
  "you're now connected",
  'now connected with',
  'invitation accepted',
  'connection request accepted',
  'connected with',
];

// Profile page selectors for data extraction
const PROFILE_SELECTORS = {
  name: [
    'h1.text-heading-xlarge',
    '.pv-text-details__left-panel h1',
    '.pv-top-card--list li:first-child',
    '[data-generated-suggestion-target] h1',
  ],
  headline: [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '[data-generated-suggestion-target] .text-body-medium',
  ],
  location: [
    '.text-body-small.inline.t-black--light.break-words',
    '.pv-text-details__left-panel .text-body-small',
  ],
  avatar: [
    '.pv-top-card-profile-picture__image',
    '.pv-top-card__photo',
    'img.profile-photo-edit__preview',
  ],
  company: [
    '[aria-label*="Current company"]',
    '.pv-text-details__right-panel span',
    '.inline-show-more-text',
  ],
};

/**
 * Extract text content from first matching selector
 */
function extractText(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return null;
}

/**
 * Extract avatar URL from first matching selector
 */
function extractAvatarUrl(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.src) {
      return el.src;
    }
  }
  return null;
}

/**
 * Extract public identifier from URL
 */
function extractPublicIdentifier(url) {
  const match = url?.match(PROFILE_URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Normalize profile URL to canonical form
 */
function normalizeProfileUrl(url) {
  const identifier = extractPublicIdentifier(url);
  if (identifier) {
    return `https://www.linkedin.com/in/${identifier}/`;
  }
  return url;
}

/**
 * Check if profile was recently sent (throttle)
 */
async function isThrottled(profileUrl) {
  const key = THROTTLE_PREFIX + normalizeProfileUrl(profileUrl);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const timestamp = result[key];
      if (timestamp && Date.now() - timestamp < THROTTLE_DURATION_MS) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Mark profile as recently sent (set throttle)
 */
async function setThrottle(profileUrl) {
  const key = THROTTLE_PREFIX + normalizeProfileUrl(profileUrl);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: Date.now() }, resolve);
  });
}

/**
 * Extract profile data from current page
 */
function extractProfileData() {
  const profileUrl = normalizeProfileUrl(window.location.href);
  const publicIdentifier = extractPublicIdentifier(window.location.href);
  
  return {
    source: 'linkedin_extension',
    event: 'connection_added',
    profile_url: profileUrl,
    public_identifier: publicIdentifier,
    full_name: extractText(PROFILE_SELECTORS.name),
    headline: extractText(PROFILE_SELECTORS.headline),
    company: extractText(PROFILE_SELECTORS.company),
    location: extractText(PROFILE_SELECTORS.location),
    avatar_url: extractAvatarUrl(PROFILE_SELECTORS.avatar),
    occurred_at: new Date().toISOString(),
  };
}

/**
 * Extract profile data from a profile link element
 */
function extractProfileDataFromElement(element) {
  // Find the profile link
  const profileLink = element.querySelector('a[href*="/in/"]') || 
                      element.closest('a[href*="/in/"]');
  
  if (!profileLink) return null;
  
  const profileUrl = normalizeProfileUrl(profileLink.href);
  const publicIdentifier = extractPublicIdentifier(profileLink.href);
  
  // Try to find name and other data near the link
  const container = profileLink.closest('[data-view-name]') || 
                    profileLink.closest('.invitation-card') ||
                    profileLink.closest('.artdeco-list__item') ||
                    profileLink.parentElement?.parentElement;
  
  let fullName = null;
  let headline = null;
  let avatarUrl = null;
  
  if (container) {
    // Try various patterns for name
    const nameEl = container.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
                   container.querySelector('.invitation-card__title') ||
                   container.querySelector('.artdeco-entity-lockup__title');
    if (nameEl) fullName = nameEl.textContent?.trim();
    
    // Try for headline
    const headlineEl = container.querySelector('.entity-result__primary-subtitle') ||
                       container.querySelector('.invitation-card__subtitle') ||
                       container.querySelector('.artdeco-entity-lockup__subtitle');
    if (headlineEl) headline = headlineEl.textContent?.trim();
    
    // Try for avatar
    const avatarEl = container.querySelector('img.presence-entity__image') ||
                     container.querySelector('img.EntityPhoto-circle-3') ||
                     container.querySelector('img[alt*="profile"]');
    if (avatarEl) avatarUrl = avatarEl.src;
  }
  
  return {
    source: 'linkedin_extension',
    event: 'connection_added',
    profile_url: profileUrl,
    public_identifier: publicIdentifier,
    full_name: fullName,
    headline: headline,
    company: null,
    location: null,
    avatar_url: avatarUrl,
    occurred_at: new Date().toISOString(),
  };
}

/**
 * Send connection event to background script
 */
async function sendConnectionEvent(data) {
  // Check throttle first
  if (await isThrottled(data.profile_url)) {
    console.log('[Weave] Throttled - already sent recently:', data.profile_url);
    return;
  }
  
  console.log('[Weave] Sending connection event:', data);
  
  // Set throttle before sending
  await setThrottle(data.profile_url);
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'CONNECTION_DETECTED',
    data: data,
  });
}

/**
 * Check if text indicates a connection success
 */
function isConnectionSuccessText(text) {
  const lowerText = text.toLowerCase();
  return CONNECTION_SUCCESS_PHRASES.some(phrase => lowerText.includes(phrase));
}

/**
 * Handle toast notification detection
 */
function handleToastNotification(toastElement) {
  const text = toastElement.textContent || '';
  
  if (isConnectionSuccessText(text)) {
    console.log('[Weave] Connection toast detected:', text);
    
    // Try to extract profile from the toast or current page
    // If on a profile page, use that data
    if (window.location.href.includes('/in/')) {
      const data = extractProfileData();
      if (data.public_identifier) {
        sendConnectionEvent(data);
      }
    }
    
    // Also check for profile links in toast
    const profileData = extractProfileDataFromElement(toastElement);
    if (profileData?.public_identifier) {
      sendConnectionEvent(profileData);
    }
  }
}

/**
 * Handle button state changes (Connect → Message)
 */
function handleButtonChange(button) {
  const ariaLabel = button.getAttribute('aria-label') || '';
  const text = button.textContent || '';
  
  // Check if this is a "Message" button (indicates connection)
  if (ariaLabel.toLowerCase().includes('message') || 
      text.toLowerCase().includes('message')) {
    
    // Verify we're on a profile page
    if (window.location.href.includes('/in/')) {
      console.log('[Weave] Profile connected - Message button detected');
      const data = extractProfileData();
      if (data.public_identifier) {
        sendConnectionEvent(data);
      }
    }
  }
}

/**
 * Set up MutationObserver for DOM changes
 */
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        
        // Check for toast notifications
        for (const selector of TOAST_SELECTORS) {
          if (node.matches?.(selector)) {
            handleToastNotification(node);
          }
          const toasts = node.querySelectorAll?.(selector);
          toasts?.forEach(handleToastNotification);
        }
        
        // Check for "Accept" button clicks that complete
        if (node.matches?.('button') && 
            (node.textContent?.toLowerCase().includes('accept') ||
             node.getAttribute('aria-label')?.toLowerCase().includes('accept'))) {
          // Watch for this button to be replaced
          const parent = node.parentElement;
          if (parent) {
            const btnObserver = new MutationObserver(() => {
              const messageBtn = parent.querySelector('button[aria-label*="Message"]');
              if (messageBtn) {
                handleButtonChange(messageBtn);
                btnObserver.disconnect();
              }
            });
            btnObserver.observe(parent, { childList: true, subtree: true });
            setTimeout(() => btnObserver.disconnect(), 10000);
          }
        }
      }
      
      // Check for attribute changes on buttons
      if (mutation.type === 'attributes' && 
          mutation.target instanceof HTMLElement &&
          mutation.target.tagName === 'BUTTON') {
        handleButtonChange(mutation.target);
      }
    }
  });
  
  // Observe the entire document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'class'],
  });
  
  console.log('[Weave] LinkedIn Auto-Capture observer started');
}

/**
 * Handle "Accept" button clicks on invitation cards
 */
function setupAcceptButtonListener() {
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    
    const text = button.textContent?.toLowerCase() || '';
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (text.includes('accept') || ariaLabel.includes('accept')) {
      console.log('[Weave] Accept button clicked');
      
      // Find the invitation card/container
      const card = button.closest('.invitation-card') ||
                   button.closest('[data-view-name*="invitation"]') ||
                   button.closest('.artdeco-list__item');
      
      if (card) {
        // Wait a moment for the action to complete
        setTimeout(() => {
          const profileData = extractProfileDataFromElement(card);
          if (profileData?.public_identifier) {
            sendConnectionEvent(profileData);
          }
        }, 1000);
      }
    }
  }, true);
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupObserver();
    setupAcceptButtonListener();
  });
} else {
  setupObserver();
  setupAcceptButtonListener();
}
