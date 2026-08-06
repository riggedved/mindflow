// Popup script for MindFlow Extension
const API_BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:8080';

console.log('🎨 Popup script loaded');

// Simplified popup: only show whether extension is linked via device token
const notLinkedState = document.getElementById('not-authenticated');
const linkedState = document.getElementById('authenticated');
const loadingState = document.getElementById('loading');

const openBtn = document.getElementById('signin-btn');
const unlinkBtn = document.getElementById('logout-btn');

const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📦 Popup initialized (device-token flow)');
  await refreshState();
});

async function refreshState() {
  const res = await chrome.storage.local.get(['device_token', 'device_user']);
  if (res.device_token) {
    showLinkedState(res.device_user);
  } else {
    showNotLinkedState();
  }
}

function showNotLinkedState() {
  notLinkedState.classList.remove('hidden');
  linkedState.classList.add('hidden');
  loadingState.classList.add('hidden');
}

function showLinkedState(user) {
  notLinkedState.classList.add('hidden');
  linkedState.classList.remove('hidden');
  loadingState.classList.add('hidden');

  if (user) {
    userName.textContent = user.name || 'Linked Device';
    userEmail.textContent = user.email || '';
    if (user.avatar) {
      userAvatar.src = user.avatar;
      userAvatar.style.display = 'block';
    }
  }
}

// Open dashboard
openBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: FRONTEND_URL });
});

// Unlink (clear local device token) — revocation must be done in backend separately
unlinkBtn.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove(['device_token', 'device_user']);
    chrome.runtime.sendMessage({ type: 'CLEAR_DEVICE_TOKEN' });
    await refreshState();
  } catch (e) {
    console.error('Error unlinking device', e);
  }
});

// Listen for background notifications to refresh
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEVICE_TOKEN_CLEARED' || message.type === 'DEVICE_TOKEN_STORED') {
    refreshState();
  }
  sendResponse({ received: true });
});

console.log('✨ Popup script ready (device-token flow)');
