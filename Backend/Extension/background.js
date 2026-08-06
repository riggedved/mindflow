// Clean, single-source background service worker for the MindFlow Extension
// Uses device-token flow: embedded device_token.json -> chrome.storage.local.device_token

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_DASHBOARD_URL = 'http://localhost:8080';

let API_BASE_URL = DEFAULT_API_BASE_URL;
let DASHBOARD_URL = DEFAULT_DASHBOARD_URL;

const configPromise = loadExtensionConfig();
configPromise.then((cfg) => {
  try {
    console.log('Extension config loaded', cfg);
  } catch (_) {}
});

async function loadExtensionConfig() {
  try {
    const configUrl = chrome.runtime.getURL('extension.config.json');
    const res = await fetch(configUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    if (cfg && cfg.api_base_url) {
      API_BASE_URL = String(cfg.api_base_url).replace(/\/$/, '');
    }
    if (cfg && cfg.dashboard_url) {
      DASHBOARD_URL = String(cfg.dashboard_url).replace(/\/$/, '');
    }
    return { api_base_url: API_BASE_URL, dashboard_url: DASHBOARD_URL };
  } catch (err) {
    console.warn('Extension config load failed; using defaults', err);
    API_BASE_URL = DEFAULT_API_BASE_URL;
    DASHBOARD_URL = DEFAULT_DASHBOARD_URL;
    return { api_base_url: API_BASE_URL, dashboard_url: DASHBOARD_URL };
  }
}

function getApiBaseUrl() {
  return (API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function getDashboardUrl() {
  return (DASHBOARD_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/, '');
}

const notificationData = {};

// Resolve the notification icon. We ship a simple PNG so notifications render.
const NOTIF_ICON_PNG = chrome.runtime.getURL('icons/icon48.png');
let notificationIconUrl = NOTIF_ICON_PNG;

function createNotification(options, cb) {
  // Build a safe, minimal notification options object. Some platforms or
  // chrome implementations are strict about required fields (type, title,
  // message, iconUrl), so ensure they exist. We'll prefer PNG and fall back
  // to SVG or no-icon if creation fails.
  try {
    const notificationId = `mindflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const base = {
      type: 'basic',
      title: options && options.title ? options.title : 'MindFlow',
      message: options && options.message ? options.message : '',
      requireInteraction: options && typeof options.requireInteraction === 'boolean' ? options.requireInteraction : false,
      priority: options && typeof options.priority === 'number' ? options.priority : 0
    };

    if (options && options.buttons) {
      base.buttons = options.buttons;
    }

    if (notificationIconUrl) {
      base.iconUrl = notificationIconUrl;
    }

    // Debug: log the notification options we're about to create
    console.log('Notification request (initial):', base);

    chrome.notifications.create(notificationId, base, (id) => {
      if (!chrome.runtime.lastError) {
        if (cb) cb(id);
        return;
      }

      const err = chrome.runtime.lastError.message || '';
      console.warn('createNotification initial icon failed:', err);

      // If the icon cannot be loaded, fall back to a notification without one.
      const noIcon = Object.assign({}, base, { iconUrl: undefined });
      delete noIcon.iconUrl;
      notificationIconUrl = undefined;
      console.log('Notification retry (no icon):', noIcon);
      chrome.notifications.create(notificationId, noIcon, (id3) => { if (cb) cb(id3); });
    });
  } catch (e) {
    console.error('createNotification fatal error:', e);
    try { if (cb) cb(null); } catch (_) {}
  }
}

console.log('🚀 MindFlow Extension: Background service worker started');

// Storage helpers
const getLocal = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const setLocal = (obj) => new Promise(resolve => chrome.storage.local.set(obj, resolve));
const getSync = (keys) => new Promise(resolve => chrome.storage.sync.get(keys, resolve));

async function ensureDeviceToken() {
  const { device_token: existingToken } = await getLocal(['device_token']);
  if (existingToken) {
    return existingToken;
  }
  try {
    await loadEmbeddedDeviceToken();
  } catch (err) {
    console.warn('Embedded device token reload failed:', err && err.message ? err.message : err);
  }
  const { device_token: refreshedToken } = await getLocal(['device_token']);
  return refreshedToken;
}

// On install: create context menu and attempt to load embedded token
chrome.runtime.onInstalled.addListener(() => {
  loadEmbeddedDeviceToken().catch(err => console.log('Device token load error:', err));
});

// Try loading embedded token on startup
(async () => {
  try { await loadEmbeddedDeviceToken(); } catch (e) { /* ignore */ }
})();

// Ensure context menu exists on startup (covers extension reload/update where onInstalled may not fire)
function ensureContextMenuExists() {
  try {
    // Remove any existing menu with the same id, then create it. This avoids
    // duplicate-id races and prevents chrome from logging unchecked lastError
    // messages when two workers try to create the same menu concurrently.
    chrome.contextMenus.remove('save-to-mindflow', () => {
      // Access chrome.runtime.lastError to avoid an "Unchecked runtime.lastError"
      // being printed when the item doesn't exist. We intentionally ignore that case.
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || '';
        if (msg.includes('Cannot find menu item') || msg.includes('not found')) {
          // expected when menu didn't exist yet; swallow it
          // console.debug('contextMenus.remove: item not found, continuing');
        } else {
          // unexpected remove error — log for diagnostics
          console.warn('contextMenus.remove error:', msg);
        }
      }

      chrome.contextMenus.create({ id: 'save-to-mindflow', title: '✨ Save to MindFlow', contexts: ['selection', 'link', 'image', 'video', 'page'] }, () => {
        if (chrome.runtime.lastError) {
          // If creation still fails for some reason, log it but don't throw
          console.error('Failed to create context menu:', chrome.runtime.lastError.message);
        }
      });
    });
  } catch (e) {
    console.error('Error creating context menu:', e);
  }
}

ensureContextMenuExists();

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-mindflow') return;

  console.log('🖱️ Save requested', info);

  await configPromise.catch(() => null);
  const apiBaseUrl = getApiBaseUrl();
  const dashboardBaseUrl = getDashboardUrl();

  const local = await getLocal(['device_token']);
  const sync = await getSync(['token', 'user']);
  let deviceToken = local?.device_token;
  const userToken = sync?.token;

  if (!deviceToken) {
    deviceToken = await ensureDeviceToken();
  }

  if (!deviceToken && !userToken) {
    createNotification({ type: 'basic', title: 'MindFlow Extension', message: '⚠️ Please sign in on MindFlow web app to link your extension', priority: 2, requireInteraction: true }, (id) => { if (!chrome.runtime.lastError) notificationData[id] = { signInHint: true, timestamp: Date.now() }; });
    return;
  }

  // Build item payload
  const pageUrl = tab?.url || info.pageUrl || '';
  const pageTitle = tab?.title || '';
  const pageHost = (() => {
    try {
      return pageUrl ? new URL(pageUrl).hostname : '';
    } catch (err) {
      return '';
    }
  })();
  const item = {
    timestamp: new Date().toISOString(),
    source_url: pageUrl,
    page_title: pageTitle,
  };

  if (info.selectionText) {
    item.type = 'note';
    item.content = info.selectionText.trim();
    item.preview_content = item.content;
  item.title = `Note from ${pageHost || 'page'}`;
  } else if (info.linkUrl) {
    const isPdf = /\.pdf(\?.*)?$/i.test(info.linkUrl);
    item.type = isPdf ? 'article' : 'link';
    item.content = info.linkUrl;
    item.preview_content = info.linkUrl;
    item.title = info.linkUrl;
  } else if (info.srcUrl && info.mediaType === 'image') {
    item.type = 'image';
    item.content = info.srcUrl;
    item.preview_content = info.srcUrl;
  item.title = pageHost ? `Image from ${pageHost}` : 'Saved image';
  } else if (info.srcUrl && info.mediaType === 'video') {
    item.type = 'video';
    item.content = info.srcUrl;
    item.preview_content = info.srcUrl;
  item.title = pageHost ? `Video from ${pageHost}` : 'Saved video';
  } else if (info.pageUrl) {
    const isPdf = /\.pdf(\?.*)?$/i.test(info.pageUrl);
    item.type = isPdf ? 'article' : 'link';
    item.content = info.pageUrl;
    item.preview_content = info.pageUrl;
    item.title = pageTitle || info.pageUrl;
  }

  item.url = pageUrl;
  item.pageTitle = pageTitle;

  if (!item.type) {
    createNotification({ type: 'basic', title: 'MindFlow', message: '❌ Could not determine content type', priority: 1 });
    return;
  }

  try {
    // Diagnostics: log whether we have a device token or user token (mask actual tokens)
    console.log('🔑 Token presence:', { deviceToken: !!deviceToken, userToken: !!userToken });
    console.log('📤 Sending item to backend:', item);

    // Immediately notify the source tab to show a loading toast while we
    // perform the network save. We prefer sendMessage, but if the content
    // script isn't present, try to inject a loading toast via scripting.
    const loadingToast = {
      title: 'One moment! Saving your content',
      message: 'Saving…',
      viewUrl: null,
      // ttl <= 0 means persistent until replaced
      ttl: 0,
      loading: true
    };

    if (tab && tab.id) {
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'ITEM_SAVING', inlineToast: loadingToast }, (resp) => {
          if (chrome.runtime.lastError) {
            // content script not available in that tab — attempt injection
            console.warn('tabs.sendMessage ITEM_SAVING failed:', chrome.runtime.lastError.message);
            try {
              if (chrome.scripting && chrome.scripting.executeScript) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id, allFrames: false },
                  func: (inlineToast) => {
                    try {
                      const id = 'mindflow-inline-toast';
                      let existing = document.getElementById(id);
                      function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>\\"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;',"'":'&#39;' })[c]); }
                      function buildLoadingHtml(title, message) {
                        return `
                          <div class="mf-toast-root">
                            <div class="mf-toast-content">
                              <div class="mf-spinner" aria-hidden="true"></div>
                              <div class="mf-toast-text">
                                <div class="mf-toast-title">${escapeHtml(title)}</div>
                                <div class="mf-toast-message">${escapeHtml(message)}</div>
                              </div>
                            </div>
                          </div>
                          <style>
                            .mf-toast-root{position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;opacity:0;transform:translateX(20px);transition:opacity .28s ease,transform .28s cubic-bezier(.2,.9,.2,1);backdrop-filter:blur(16px);background:rgba(25,25,35,0.6);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;color:#e0e0e0;box-shadow:0 8px 30px rgba(2,6,23,0.6);}
                            .mf-toast-root.mf-enter{opacity:1;transform:translateX(0)}
                            .mf-toast-content{display:flex;align-items:center;gap:12px}
                            .mf-spinner{width:22px;height:22px;border-radius:50%;position:relative;box-sizing:border-box;border:3px solid rgba(255,255,255,0.06);border-top-color:rgba(0,188,212,0.95);animation:mf-spin 1s linear infinite}
                            @keyframes mf-spin{to{transform:rotate(1turn)}}
                            .mf-toast-title{font-weight:700;margin-bottom:6px;color:#ffffff;font-size:14px}
                            .mf-toast-message{line-height:1.2;color:#cfcfcf;font-size:13px}
                          </style>
                        `;
                      }
                        if (existing) {
                          // If we previously injected using shadow DOM, update shadow root
                          if (existing._mf_shadow) {
                            existing._mf_shadow.innerHTML = buildLoadingHtml(inlineToast.title, inlineToast.message);
                            // ensure enter class is on the inner toast element inside the shadow root
                            try {
                              const inner = existing._mf_shadow.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                            } catch (e) { /* ignore */ }
                          } else {
                            existing.innerHTML = buildLoadingHtml(inlineToast.title, inlineToast.message);
                            try {
                              const inner = existing.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                              else existing.classList.add('mf-enter');
                            } catch (e) { try { existing.classList.add('mf-enter'); } catch (_) {} }
                          }
                          clearTimeout(existing._mf_to);
                          existing._mf_persistent = true;
                        } else {
                          // Create a host element and attach a shadow root so the toast
                          // is visually isolated from page CSS and CSP.
                          const host = document.createElement('div');
                          host.id = id;
                          host.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;';
                          try {
                            host._mf_shadow = host.attachShadow({ mode: 'open' });
                            host._mf_shadow.innerHTML = buildLoadingHtml(inlineToast.title, inlineToast.message);
                          } catch (err) {
                            // Fallback if shadow DOM not available
                            host.innerHTML = buildLoadingHtml(inlineToast.title, inlineToast.message);
                          }
                          host._mf_persistent = true;
                          // Append to documentElement to maximize chance of visibility
                          (document.body || document.documentElement).appendChild(host);
                          void host.offsetWidth;
                          try {
                            if (host._mf_shadow) {
                              const inner = host._mf_shadow.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                              else host.classList.add('mf-enter');
                            } else {
                              host.classList.add('mf-enter');
                            }
                          } catch (e) { try { host.classList.add('mf-enter'); } catch (_) {} }
                        }
                    } catch (e) { }
                  },
                  args: [loadingToast]
                }, (injectionResults) => {
                  if (chrome.runtime.lastError) {
                    console.warn('scripting.executeScript (loading) failed:', chrome.runtime.lastError.message);
                  } else {
                    console.log('Programmatic loading toast injected');
                  }
                });
              }
            } catch (e) {
              console.warn('Programmatic injection error for loading toast:', e);
            }
          } else {
            // content script received ITEM_SAVING and should show loading UI
            console.log('ITEM_SAVING sent to source tab');
          }
        });
      } catch (e) {
        // ignore
      }
    }

    // Normalize tokens: storage may sometimes contain an object or a JSON-encoded
    // string (defensive). Ensure we send a raw token string in the Authorization
    // header to avoid sending `[object Object]` which results in a 401.
    let normalizedDeviceToken = deviceToken;
    let normalizedUserToken = userToken;
    try {
      if (deviceToken && typeof deviceToken === 'object') {
        // e.g. { device_token: '...' }
        if (deviceToken.device_token) normalizedDeviceToken = deviceToken.device_token;
        else if (deviceToken.token) normalizedDeviceToken = deviceToken.token;
      } else if (deviceToken && typeof deviceToken === 'string' && deviceToken.trim().startsWith('{')) {
        // Possibly double-encoded JSON string
        const parsed = JSON.parse(deviceToken);
        if (parsed && parsed.device_token) normalizedDeviceToken = parsed.device_token;
        else if (parsed && parsed.token) normalizedDeviceToken = parsed.token;
      }
    } catch (e) {
      console.warn('Device token normalization error:', e);
    }

    try {
      if (userToken && typeof userToken === 'object') {
        if (userToken.token) normalizedUserToken = userToken.token;
      } else if (userToken && typeof userToken === 'string' && userToken.trim().startsWith('{')) {
        const parsedU = JSON.parse(userToken);
        if (parsedU && parsedU.token) normalizedUserToken = parsedU.token;
      }
    } catch (e) {
      console.warn('User token normalization error:', e);
    }

    const finalToken = normalizedDeviceToken || normalizedUserToken;
    const authHeader = finalToken ? `Bearer ${finalToken}` : undefined;
    console.log('🔐 Authorization header being sent (masked):', authHeader ? `Bearer ${String(finalToken).slice(0,6)}...` : authHeader);

    // Use keepalive where possible to reduce risk of service worker being stopped
    // before the request completes. Also log response for debugging.
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(`${apiBaseUrl}/api/v1/items/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(item),
      keepalive: true,
    });
    console.log('📥 Backend response status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Saved item, server response id:', data?.id);

      // Preferred behavior: show inline toast on the source tab (where the
      // user saved). Only create a system notification as a fallback when the
      // source tab can't receive messages (e.g. pages where content scripts
      // aren't allowed). Also, always notify dashboard tabs so they can
      // refresh their UI.
  const viewUrl = `${dashboardBaseUrl}/dashboard`;
      const inlinePayload = {
        type: 'ITEM_SAVED',
        item: data,
        inlineToast: {
          title: 'Saved to MindFlow ✅',
          message: `${getTypeEmoji(item.type)} ${item.type} saved successfully!`,
          viewUrl,
          // Increase TTL for improved visibility
          ttl: 6000
        }
      };

      // Try to send the inline toast to the source tab first. If it fails
      // (no listener, restricted page), fall back to a system notification.
      let sentToSource = false;
      if (tab && tab.id) {
        try {
          chrome.tabs.sendMessage(tab.id, inlinePayload, (resp) => {
            if (chrome.runtime.lastError) {
              // No listener in that tab — try programmatic injection as a
              // best-effort inline-toast fallback, then fall back to system
              // notification if that fails.
              console.warn('tabs.sendMessage to source tab failed:', chrome.runtime.lastError.message);

              try {
                // Attempt to inject a toast directly into the page using
                // chrome.scripting.executeScript. This requires the
                // 'scripting' permission in the manifest (added).
                if (chrome.scripting && chrome.scripting.executeScript) {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: false },
                    func: (inlineToast) => {
                      try {
                        const id = 'mindflow-inline-toast';
                        let existing = document.getElementById(id);
                        function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>\"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
                        function buildHtml(title, message, viewUrl) {
                          const titleHtml = title ? `<div class="mf-toast-title">${escapeHtml(title)}</div>` : '';
                          const messageHtml = `<div class="mf-toast-message">${escapeHtml(message)}</div>`;
                          const btnHtml = viewUrl ? `<div style="margin-top:12px;text-align:right"><a class="mf-toast-view-btn" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;border-radius:9999px;background:linear-gradient(90deg,#00bcd4,#8e44ad);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 6px 20px rgba(142,68,173,0.18);transition:transform .12s ease,box-shadow .12s ease">View in Dashboard</a></div>` : '';
                          return `
                            <div class="mf-toast-root">
                              <div class="mf-toast-content">
                                <div class="mf-toast-text-block">
                                  ${titleHtml}
                                  ${messageHtml}
                                  ${btnHtml}
                                </div>
                              </div>
                            </div>
                            <style>
                              .mf-toast-root{position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;opacity:0;transform:translateX(20px);transition:opacity .28s ease,transform .28s cubic-bezier(.2,.9,.2,1);backdrop-filter:blur(16px);background:rgba(25,25,35,0.6);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;color:#e0e0e0;box-shadow:0 8px 30px rgba(2,6,23,0.6)}
                              .mf-toast-root.mf-enter{opacity:1;transform:translateX(0)}
                              .mf-toast-content{display:flex;align-items:center;gap:12px}
                              .mf-toast-title{font-weight:700;margin-bottom:6px;color:#ffffff;font-size:14px}
                              .mf-toast-message{line-height:1.25;color:#cfcfcf;font-size:13px}
                              .mf-toast-view-btn:hover{transform:scale(1.02);box-shadow:0 10px 30px rgba(0,188,212,0.18)}
                              .mf-toast-view-btn:active{transform:scale(0.99)}
                            </style>
                          `;
                        }
                        function removeSoon(el) {
                          try {
                            // Remove the enter class from inner toast element whether
                            // it's in a shadow root or not.
                            try {
                              if (el && el._mf_shadow) {
                                const inner = el._mf_shadow.querySelector('.mf-toast-root');
                                if (inner) inner.classList.remove('mf-enter');
                              } else if (el) {
                                const inner = el.querySelector && el.querySelector('.mf-toast-root');
                                if (inner) inner.classList.remove('mf-enter');
                                else try { el.classList.remove('mf-enter'); } catch (_) {}
                              }
                            } catch (err) { /* ignore */ }
                            setTimeout(() => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (_) {} }, 220);
                          } catch (e) {}
                        }

                        const ttl = (inlineToast && inlineToast.ttl) ? inlineToast.ttl : 6000;
                        const title = inlineToast && inlineToast.title ? inlineToast.title : null;
                        const message = inlineToast && inlineToast.message ? inlineToast.message : (inlineToast && inlineToast.msg ? inlineToast.msg : 'Saved to MindFlow');
                        const viewUrl = inlineToast && inlineToast.viewUrl ? inlineToast.viewUrl : null;

                        if (existing) {
                          if (existing._mf_shadow) {
                            existing._mf_shadow.innerHTML = buildHtml(title, message, viewUrl);
                            try {
                              const inner = existing._mf_shadow.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                            } catch (e) { /* ignore */ }
                          } else {
                            existing.innerHTML = buildHtml(title, message, viewUrl);
                            try {
                              const inner = existing.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                              else existing.classList.add('mf-enter');
                            } catch (e) { try { existing.classList.add('mf-enter'); } catch (_) {} }
                          }
                          clearTimeout(existing._mf_to);
                        } else {
                          const host = document.createElement('div');
                          host.id = id;
                          host.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;';
                          try {
                            host._mf_shadow = host.attachShadow({ mode: 'open' });
                            host._mf_shadow.innerHTML = buildHtml(title, message, viewUrl);
                          } catch (err) {
                            host.innerHTML = buildHtml(title, message, viewUrl);
                          }
                          if (viewUrl) {
                            host.addEventListener('click', (e) => {
                              try {
                                const btn = e.target && (e.target.closest && e.target.closest('.mf-toast-view-btn')) ? e.target.closest('.mf-toast-view-btn') : null;
                                if (btn) {
                                  const href = btn.getAttribute('href');
                                  if (href) window.open(href, '_blank');
                                  removeSoon(host);
                                  return;
                                }
                              } catch (err) { /* ignore */ }
                            });
                          }
                          (document.body || document.documentElement).appendChild(host);
                          void host.offsetWidth;
                          try {
                            if (host._mf_shadow) {
                              const inner = host._mf_shadow.querySelector('.mf-toast-root');
                              if (inner) inner.classList.add('mf-enter');
                              else host.classList.add('mf-enter');
                            } else {
                              host.classList.add('mf-enter');
                            }
                          } catch (e) { try { host.classList.add('mf-enter'); } catch (_) {} }
                          existing = host;
                        }

                        existing._mf_to = setTimeout(() => { removeSoon(existing); }, ttl);
                      } catch (e) {
                        // swallowing errors in injected script
                      }
                    },
                    args: [inlinePayload.inlineToast]
                  }, (injectionResults) => {
                    if (chrome.runtime.lastError) {
                      console.warn('scripting.executeScript failed:', chrome.runtime.lastError.message);
                      // finally, fallback to a system notification
                      createNotification({ type: 'basic', title: inlinePayload.inlineToast.title || 'Saved to MindFlow', message: inlinePayload.inlineToast.message || 'Saved to MindFlow', priority: 2, requireInteraction: false, buttons: [{ title: 'View in Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { itemId: data.id, timestamp: Date.now() }; });
                    } else {
                      console.log('Programmatic inline toast injected into source tab');
                    }
                  });
                } else {
                  // scripting API not available — fall back to system notification
                  createNotification({ type: 'basic', title: inlinePayload.inlineToast.title || 'Saved to MindFlow', message: inlinePayload.inlineToast.message || 'Saved to MindFlow', priority: 2, requireInteraction: false, buttons: [{ title: 'View in Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { itemId: data.id, timestamp: Date.now() }; });
                }
              } catch (e) {
                console.error('Error during programmatic injection fallback:', e);
                createNotification({ type: 'basic', title: inlinePayload.inlineToast.title || 'Saved to MindFlow', message: inlinePayload.inlineToast.message || 'Saved to MindFlow', priority: 2, requireInteraction: false, buttons: [{ title: 'View in Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { itemId: data.id, timestamp: Date.now() }; });
              }
            } else {
              sentToSource = true;
              // don't create a system notification since the source tab will
              // show an inline toast
              console.log('Inline toast delivered to source tab');
            }
          });
        } catch (e) {
          console.warn('Error sending message to source tab, falling back to notification', e);
          createNotification({ type: 'basic', title: inlinePayload.inlineToast.title, message: inlinePayload.inlineToast.message, priority: 2, requireInteraction: false, buttons: [{ title: 'View in Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { itemId: data.id, timestamp: Date.now() }; });
        }
      } else {
        // No source tab info — show a system notification as a fallback
        createNotification({ type: 'basic', title: 'Saved to MindFlow', message: `${getTypeEmoji(item.type)} ${item.type} saved successfully!`, priority: 2, requireInteraction: false, buttons: [{ title: 'View in Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { itemId: data.id, timestamp: Date.now() }; });
      }

      // Also notify dashboard tabs so they can refresh their UI
      chrome.tabs.query({ url: `${dashboardBaseUrl}/*` }, (tabs) => {
        tabs.forEach(t => {
          if (!t.id) return;
          chrome.tabs.sendMessage(t.id, { type: 'ITEM_SAVED', item: data }, (resp) => {
            if (chrome.runtime.lastError) {
              // No listener in that tab — not an error for us
            }
          });
        });
      });
    } else if (res.status === 401) {
      // Clear both sync (user token) and local (device token) so the
      // extension no longer attempts to reuse an expired token. This will
      // prompt the user to re-link via the dashboard notification.
      await new Promise(r => chrome.storage.sync.clear(r));
      await new Promise(r => chrome.storage.local.remove(['device_token','device_user'], r));
  console.log('🔔 Creating session-expired notification');
  createNotification({ type: 'basic', title: 'MindFlow Extension', message: '⚠️ Session expired. Please sign in on MindFlow web app to re-link.', priority: 2, requireInteraction: true, buttons: [{ title: 'Open Dashboard' }] }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); if (!chrome.runtime.lastError) notificationData[id] = { expired: true, timestamp: Date.now() }; });
    } else {
      // Attempt to read error body for diagnostics
      let errBody = null;
      try { errBody = await res.json(); } catch (_) { try { errBody = await res.text(); } catch (_) { errBody = null; } }
      console.warn('❌ Save failed, status:', res.status, 'body:', errBody);
      throw new Error((errBody && (errBody.detail || JSON.stringify(errBody))) || `Save failed with status ${res.status}`);
    }
  } catch (e) {
    console.error('Save failed', e);
    const errorText = e && (e.message || `${e}`) ? String(e.message || `${e}`) : 'Failed to save';
    const failureMessage = `❌ ${errorText}`.slice(0, 200);

    if (tab && tab.id) {
      const failureToast = {
        title: 'Save failed',
        message: failureMessage,
        ttl: 6000,
        loading: false,
        viewUrl: `${dashboardBaseUrl}/dashboard`,
      };
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'ITEM_SAVE_FAILED', error: errorText, inlineToast: failureToast }, () => {
          if (chrome.runtime.lastError) {
            console.warn('tabs.sendMessage ITEM_SAVE_FAILED failed:', chrome.runtime.lastError.message);
            try {
              if (chrome.scripting && chrome.scripting.executeScript) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id, allFrames: false },
                  func: (toast) => {
                    try {
                      const id = 'mindflow-inline-toast';
                      const ttl = typeof toast.ttl === 'number' ? toast.ttl : 6000;
                      const title = toast.title || '';
                      const message = toast.message || 'Save failed';
                      const viewUrl = toast.viewUrl || null;
                      let host = document.getElementById(id);
                      if (!host) {
                        host = document.createElement('div');
                        host.id = id;
                        host.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;';
                        try {
                          host._mf_shadow = host.attachShadow({ mode: 'open' });
                        } catch (_) {
                          host._mf_shadow = null;
                        }
                        (document.body || document.documentElement).appendChild(host);
                      }
                      function escapeHtml(s) {
                        if (!s) return '';
                        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
                      }
                      const titleHtml = title ? `<div class="mf-toast-title" style="font-weight:700;margin-bottom:6px;color:#fee2e2;font-size:14px">${escapeHtml(title)}</div>` : '';
                      const messageHtml = `<div class="mf-toast-message" style="line-height:1.25;color:#fecaca;font-size:13px">${escapeHtml(message)}</div>`;
                      const btnHtml = viewUrl ? `<div style="margin-top:12px;text-align:right"><a class="mf-toast-view-btn" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;border-radius:9999px;background:linear-gradient(90deg,#f97316,#ef4444);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 6px 20px rgba(239,68,68,0.25);">View in MindFlow</a></div>` : '';
                      const toastHtml = `<div class="mf-toast-root" style="backdrop-filter:blur(16px);background:rgba(127,29,29,0.82);border:1px solid rgba(254,226,226,0.18);border-radius:14px;padding:12px 14px;color:#fee2e2;box-shadow:0 12px 40px rgba(127,29,29,0.35);font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px;">❌</span>${messageHtml}</div>${titleHtml}${btnHtml}</div>`;
                      if (host._mf_shadow) {
                        host._mf_shadow.innerHTML = toastHtml;
                      } else {
                        host.innerHTML = toastHtml;
                      }
                      host.style.opacity = '1';
                      void host.offsetWidth;
                      try {
                        const inner = host._mf_shadow ? host._mf_shadow.querySelector('.mf-toast-root') : host.querySelector('.mf-toast-root');
                        if (inner) inner.classList.add('mf-enter');
                        else host.classList.add('mf-enter');
                      } catch (_) { try { host.classList.add('mf-enter'); } catch (_) {} }
                      clearTimeout(host._mf_to);
                      if (ttl > 0) {
                        host._mf_to = setTimeout(() => {
                          try {
                            host.style.opacity = '0';
                            setTimeout(() => { if (host && host.parentNode) host.parentNode.removeChild(host); }, 220);
                          } catch (_) {}
                        }, ttl);
                      }
                    } catch (_) {}
                  },
                  args: [failureToast]
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('scripting.executeScript failure toast failed:', chrome.runtime.lastError.message);
                  }
                });
              }
            } catch (injectionErr) {
              console.warn('Programmatic failure toast injection error:', injectionErr);
            }
          }
        });
      } catch (sendErr) {
        console.warn('tabs.sendMessage ITEM_SAVE_FAILED threw:', sendErr);
      }
    }

    try {
      console.log('🔔 Creating failure notification');
      createNotification({ type: 'basic', title: 'MindFlow (Save failed)', message: failureMessage, priority: 1 }, (id) => { console.log('🔔 notification.create callback', id, chrome.runtime.lastError && chrome.runtime.lastError.message); });
    } catch (n) {
      // ignore notification errors
    }
  }
});

function getTypeEmoji(type) { const map = { note: '📝', link: '🔗', image: '🖼️', video: '🎥', article: '📄' }; return map[type] || '📄'; }

// Runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_AUTH') { chrome.storage.sync.get(['token', 'user'], (res) => sendResponse({ authenticated: !!res.token, user: res.user })); return true; }
  if (request.type === 'CLEAR_AUTH') { chrome.storage.sync.clear(() => sendResponse({ success: true })); return true; }
  if (request.type === 'CLEAR_DEVICE_TOKEN') { chrome.storage.local.remove(['device_token', 'device_user'], () => { try { chrome.runtime.sendMessage({ type: 'DEVICE_TOKEN_CLEARED' }).catch(()=>{}); } catch (e) {} sendResponse({ success: true }); }); return true; }
  if (request.type === 'TOKEN_SYNCED') { sendResponse({ success: true }); return true; }
});

chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && (changes.token || changes.user)) { try { chrome.runtime.sendMessage({ type: 'AUTH_UPDATED', authenticated: !!changes.token, user: changes.user?.newValue }).catch(()=>{}); } catch (e) {} } });

chrome.notifications.onClicked.addListener((id) => {
  const dashboardBaseUrl = getDashboardUrl();
  chrome.tabs.query({ url: `${dashboardBaseUrl}/*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: `${dashboardBaseUrl}/dashboard` });
    }
  });
  chrome.notifications.clear(id);
  if (notificationData[id]) delete notificationData[id];
});

chrome.notifications.onButtonClicked.addListener((id) => {
  const dashboardBaseUrl = getDashboardUrl();
  chrome.tabs.query({ url: `${dashboardBaseUrl}/*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: `${dashboardBaseUrl}/dashboard` });
    }
  });
  chrome.notifications.clear(id);
  if (notificationData[id]) delete notificationData[id];
});

async function loadEmbeddedDeviceToken() {
  try {
    const url = chrome.runtime.getURL('device_token.json');
  const r = await fetch(url); if (!r.ok) return; const obj = await r.json(); if (obj && obj.device_token) { await setLocal({ device_token: obj.device_token, device_user: obj.device_user || null }); try { chrome.runtime.sendMessage({ type: 'DEVICE_TOKEN_STORED' }).catch(()=>{}); } catch (e) {} }
  } catch (e) { /* ignore */ }
}

console.log('✨ MindFlow Extension: Background worker ready');
