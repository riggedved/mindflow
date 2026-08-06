// Listen for messages from the web app
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'PING_EXTENSION') {
    window.postMessage({ 
      type: 'EXTENSION_ALIVE', 
      source: 'mindflow-extension',
      version: '1.0.0'
    }, '*');
  }
  
  
});

// On MindFlow dashboard, automatically sync token
if (window.location.hostname === 'localhost' || window.location.hostname.includes('mindflow')) {
  
  // Announce extension is installed (used by the web app to hide install UI)
  window.postMessage({ 
    type: 'EXTENSION_INSTALLED', 
    source: 'mindflow-extension',
    version: '1.0.0'
  }, '*');
  
  // Send again after a delay (in case dashboard loads after content script)
  setTimeout(() => {
    window.postMessage({ 
      type: 'EXTENSION_INSTALLED', 
      source: 'mindflow-extension',
      version: '1.0.0'
    }, '*');
  }, 1000);
}

// Listen for messages from background script (e.g., item saved)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'ITEM_SAVING') {
    // Show loading state (persistent until replaced)
    try {
      showCaptureAnimation();
      if (message.inlineToast) showInlineToast(message.inlineToast);
      else showInlineToast({ title: 'One moment! Saving your content', message: 'Saving…', ttl: 0, loading: true });
    } catch (e) {}
  }

  if (message.type === 'ITEM_SAVED') {
    // Forward to dashboard page
    window.postMessage({
      type: 'MINDFLOW_ITEM_SAVED',
      item: message.item,
      source: 'mindflow-extension'
    }, '*');
    // Show a small in-page confirmation on the source tab
    try {
      showCaptureAnimation();
      // If the background provided inlineToast options, pass them through
      if (message.inlineToast) showInlineToast(message.inlineToast);
      else showInlineToast('Saved to MindFlow');
    } catch (e) {
      // ignore
    }
  }

  if (message.type === 'ITEM_SAVE_FAILED') {
    try {
      const inline = message.inlineToast || {
        title: 'Save failed',
        message: `❌ ${message.error || 'Failed to save'}`,
        ttl: 6000,
      };
      inline.loading = false;
      showInlineToast(inline);
    } catch (e) {
      // ignore toast errors
    }
  }
  
  sendResponse({ received: true });
  return true;
});

// Add visual feedback when content is being captured
let captureOverlay = null;

function showCaptureAnimation() {
  // Create a subtle flash animation
  if (!captureOverlay) {
    captureOverlay = document.createElement('div');
    captureOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(99, 102, 241, 0.1);
      pointer-events: none;
      z-index: 999999;
      animation: mindflow-capture 0.6s ease-out;
    `;
    
    // Add keyframe animation
    if (!document.getElementById('mindflow-capture-styles')) {
      const style = document.createElement('style');
      style.id = 'mindflow-capture-styles';
      style.textContent = `
        @keyframes mindflow-capture {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(captureOverlay);
    
    setTimeout(() => {
      if (captureOverlay && captureOverlay.parentNode) {
        captureOverlay.parentNode.removeChild(captureOverlay);
      }
      captureOverlay = null;
    }, 600);
  }
}


function showInlineToast(input) {
  try {
    const id = 'mindflow-inline-toast';
    let existing = document.getElementById(id);

    // Normalize input
  let title = null;
  let message = null;
  let viewUrl = null;
  // default stay time (ms) — increased for better visibility
  let ttl = 6000;

    if (typeof input === 'string') {
      message = input;
    } else if (input && typeof input === 'object') {
      title = input.title || null;
      message = input.message || '';
      viewUrl = input.viewUrl || null;
      ttl = typeof input.ttl === 'number' ? input.ttl : ttl;
      // support loading flag for spinner
      var loading = !!input.loading;
    }

    // If an existing toast exists, update contents and reset timer
    if (existing) {
      // replace inner HTML with new content
      existing.innerHTML = buildToastHtml(title, message, viewUrl, loading);
      try {
        const inner = existing.querySelector && existing.querySelector('.mf-toast-root');
        if (inner) inner.classList.add('mf-enter');
        else existing.classList.add('mf-enter');
      } catch (e) { try { existing.classList.add('mf-enter'); } catch(_) {} }
      clearTimeout(existing._mf_to);
      existing._mf_persistent = false;
    } else {
      const div = document.createElement('div');
      div.id = id;
      div.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;max-width:420px;';
      div.innerHTML = buildToastHtml(title, message, viewUrl, loading);

      // click handling for the 'View in Dashboard' anchor/button
      if (viewUrl) {
        div.addEventListener('click', (e) => {
          const btn = e.target && (e.target.closest && e.target.closest('.mf-toast-view-btn')) ? e.target.closest('.mf-toast-view-btn') : null;
          if (btn) {
            const href = btn.getAttribute('href') || viewUrl;
            if (href) window.open(href, '_blank');
            removeToastSoon(div);
            return;
          }
        });
      }

      document.body.appendChild(div);
      // force reflow and trigger enter on the inner toast element for animation
      void div.offsetWidth;
      try {
        const inner = div.querySelector('.mf-toast-root');
        if (inner) inner.classList.add('mf-enter');
        else div.classList.add('mf-enter');
      } catch (e) { try { div.classList.add('mf-enter'); } catch(_) {} }
      existing = div;
    }

    // If ttl is <= 0 treat as persistent until explicitly replaced
    if (ttl > 0) {
      existing._mf_to = setTimeout(() => {
        existing.style.opacity = '0';
        setTimeout(() => { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); }, 220);
      }, ttl);
      existing._mf_persistent = false;
    } else {
      existing._mf_persistent = true;
    }
  } catch (e) {
    // ignore
  }

  function buildToastHtml(title, message, viewUrl, loading) {
    const titleHtml = title ? `<div class="mf-toast-title">${escapeHtml(title)}</div>` : '';
    const spinnerHtml = loading ? `<div class="mf-spinner" aria-hidden="true"></div>` : '';
    const messageHtml = `<div class="mf-toast-message">${escapeHtml(message)}</div>`;
    const btnHtml = viewUrl ? `<div style="margin-top:12px;text-align:right"><a class="mf-toast-view-btn" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;border-radius:9999px;background:linear-gradient(90deg,#00bcd4,#8e44ad);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 6px 20px rgba(142,68,173,0.18);transition:transform .12s ease,box-shadow .12s ease">View in Dashboard</a></div>` : '';
    const style = `
      <style>
        .mf-toast-root{position:relative;font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif}
        .mf-toast-title{font-weight:700;margin-bottom:6px;color:#ffffff;font-size:14px}
        .mf-toast-message{line-height:1.25;color:#cfcfcf;font-size:13px}
        .mf-spinner{display:inline-block;vertical-align:middle;margin-right:8px;width:18px;height:18px;border-radius:50%;border:3px solid rgba(255,255,255,0.06);border-top-color:rgba(0,188,212,0.95);animation:mf-spin 1s linear infinite}
        @keyframes mf-spin{to{transform:rotate(1turn)}}
      </style>
    `;
    return `${style}<div class="mf-toast-root"><div style="display:flex;align-items:center;gap:10px">${spinnerHtml}${messageHtml}</div>${btnHtml}</div>`;
  }

  function removeToastSoon(el) {
    try {
      el.style.opacity = '0';
      setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 200);
    } catch (e) {}
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>\"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
}

// Listen for context menu events (capture initiated)
document.addEventListener('contextmenu', (e) => {
  // Check if user has selection or clicked on media
  const hasSelection = window.getSelection().toString().trim().length > 0;
  const isImage = e.target.tagName === 'IMG';
  const isVideo = e.target.tagName === 'VIDEO';
  const isLink = e.target.tagName === 'A' || e.target.closest('a');
});
