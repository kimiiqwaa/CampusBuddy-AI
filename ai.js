/* ═══════════════════════════════════════════════════════════════
   CampusBuddy AI 3.0 — AI Mode Module
   IBM AI Workshop · 2025
   ═══════════════════════════════════════════════════════════════
   SECURITY: API keys are NEVER stored here or in the browser.
   All model credentials live exclusively on the backend server.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

(function () {

  // ── Storage keys ─────────────────────────────────────────────
  const KEY_ENDPOINT = 'cb_ai_endpoint';
  const KEY_MODE     = 'cb_ai_mode';

  // ── State ─────────────────────────────────────────────────────
  let endpoint            = localStorage.getItem(KEY_ENDPOINT) || '';
  let mode                = localStorage.getItem(KEY_MODE)     || 'faq';
  let conversationHistory = [];   // { role: 'user'|'assistant', content: string }
  let isConnecting        = false;

  // ── Internal helpers ──────────────────────────────────────────

  /**
   * Trim conversationHistory to the last N messages (default 10).
   */
  function trimHistory(max) {
    max = max || 10;
    if (conversationHistory.length > max) {
      conversationHistory = conversationHistory.slice(-max);
    }
  }

  /**
   * Show a toast notification. Uses script.js showToast when available,
   * falls back to a lightweight inline implementation.
   */
  function toast(message, duration) {
    duration = duration || 3200;
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    setTimeout(function () { el.classList.remove('visible'); }, duration);
  }

  /**
   * Refresh every bound UI element to reflect current state.
   * Safe to call at any time — silently skips missing elements.
   */
  function syncUI() {
    var faqBtn      = document.getElementById('ai-mode-btn-faq');
    var aiBtn       = document.getElementById('ai-mode-btn-ai');
    var configSec   = document.getElementById('ai-config-section');
    var statusEl    = document.getElementById('ai-status-text');
    var inputEl     = document.getElementById('ai-endpoint-input');
    var countEl     = document.getElementById('ai-context-count');

    // Mode toggle active state
    if (faqBtn) faqBtn.classList.toggle('active', mode === 'faq');
    if (aiBtn)  aiBtn.classList.toggle('active', mode === 'ai');

    // Show/hide AI config section
    if (configSec) configSec.style.display = (mode === 'ai') ? '' : 'none';

    // Endpoint input
    if (inputEl && inputEl.value === '') inputEl.value = endpoint;

    // Status indicator
    if (statusEl) {
      if (isConnecting) {
        statusEl.textContent = '⏳ Connecting…';
        statusEl.className = 'ai-status connecting';
      } else if (isConfigured()) {
        statusEl.textContent = '✅ Connected — ' + endpoint;
        statusEl.className = 'ai-status connected';
      } else {
        statusEl.textContent = '⚠️ Not configured';
        statusEl.className = 'ai-status not-configured';
      }
    }

    // Context counter
    if (countEl) {
      var n = conversationHistory.length;
      countEl.textContent = n + ' message' + (n === 1 ? '' : 's') + ' in context';
    }
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Returns true when a valid HTTPS endpoint is stored.
   */
  function isConfigured() {
    return typeof endpoint === 'string' &&
           endpoint.length > 0 &&
           endpoint.startsWith('https://');
  }

  /**
   * Validate and persist a backend endpoint URL.
   * @param {string} url
   */
  function setEndpoint(url) {
    url = (url || '').trim();

    if (!url) {
      toast('⚠️ Please enter a backend URL.');
      syncUI();
      return;
    }

    if (!url.startsWith('https://')) {
      toast('🔒 Endpoint must start with https://  —  plain HTTP is not allowed.');
      syncUI();
      return;
    }

    // Basic URL structure check
    try {
      new URL(url); // throws if malformed
    } catch (_) {
      toast('⚠️ Invalid URL. Please enter a well-formed https:// address.');
      syncUI();
      return;
    }

    endpoint = url;
    localStorage.setItem(KEY_ENDPOINT, endpoint);
    toast('✅ Backend endpoint saved.');
    syncUI();
  }

  /**
   * Switch between 'faq' and 'ai' modes.
   * If switching to 'ai' without a configured endpoint, shows a warning
   * and leaves the mode as 'faq'.
   * @param {'faq'|'ai'} newMode
   */
  function setMode(newMode) {
    if (newMode !== 'faq' && newMode !== 'ai') return;

    if (newMode === 'ai' && !isConfigured()) {
      toast('⚠️ AI Mode requires a backend endpoint. Enter one below and click Connect first.');
      syncUI();
      return;
    }

    mode = newMode;
    localStorage.setItem(KEY_MODE, mode);
    syncUI();
  }

  /**
   * Returns the current mode string.
   * @returns {'faq'|'ai'}
   */
  function getMode() {
    return mode;
  }

  /**
   * Send a user message to the AI backend.
   *
   * - If mode === 'faq': returns null (caller should use knowledge base).
   * - If mode === 'ai' and not configured: returns null and shows warning.
   * - If mode === 'ai' and configured: posts to endpoint, returns a Promise
   *   that resolves to { text: string, source: 'ai'|'error' }.
   *
   * @param {string} userText
   * @param {string} [lang]
   * @returns {Promise<{text:string, source:string}>|null}
   */
  function sendMessage(userText, lang) {
    if (mode === 'faq') return null;

    if (!isConfigured()) {
      toast('⚠️ AI Mode is not configured. Please set a backend endpoint.');
      return null;
    }

    // Add to history
    conversationHistory.push({ role: 'user', content: userText });
    trimHistory(10);
    syncUI();

    var payload = {
      messages: conversationHistory.slice(),   // snapshot
      lang: lang || 'en'
    };

    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw new Error('HTTP ' + res.status + ': ' + (body || res.statusText));
        });
      }
      return res.json();
    })
    .then(function (data) {
      var text = (data && (data.text || data.content || data.reply || data.message)) || '';
      if (!text) throw new Error('Empty response from backend.');
      conversationHistory.push({ role: 'assistant', content: text });
      trimHistory(10);
      syncUI();
      return { text: text, source: 'ai' };
    })
    .catch(function (err) {
      var msg = '⚠️ AI request failed: ' + (err.message || 'Network error');
      syncUI();
      return { text: msg, source: 'error' };
    });
  }

  /**
   * Render the AI configuration panel into #ai-config-panel.
   * Idempotent — calling it again re-renders without duplication.
   */
  function renderAIPanel() {
    var panel = document.getElementById('ai-config-panel');
    if (!panel) return;

    panel.innerHTML = [
      '<div class="ai-panel-inner">',

      '  <!-- Mode toggle -->',
      '  <div class="ai-section">',
      '    <div class="ai-section-label">Response Mode</div>',
      '    <div class="ai-mode-toggle" role="group" aria-label="Response mode">',
      '      <button id="ai-mode-btn-faq" class="ai-toggle-btn' + (mode === 'faq' ? ' active' : '') + '"',
      '              aria-pressed="' + (mode === 'faq') + '">',
      '        📚 FAQ Mode',
      '      </button>',
      '      <button id="ai-mode-btn-ai" class="ai-toggle-btn' + (mode === 'ai' ? ' active' : '') + '"',
      '              aria-pressed="' + (mode === 'ai') + '">',
      '        🤖 AI Mode',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- AI config section (hidden in FAQ mode) -->',
      '  <div id="ai-config-section" style="display:' + (mode === 'ai' ? '' : 'none') + '">',

      '    <div class="ai-section">',
      '      <div class="ai-section-label">Backend Endpoint</div>',
      '      <div class="ai-endpoint-row">',
      '        <input id="ai-endpoint-input"',
      '               type="url"',
      '               class="ai-input"',
      '               placeholder="https://your-worker.workers.dev"',
      '               value="' + escapeAttr(endpoint) + '"',
      '               aria-label="AI backend endpoint URL" />',
      '        <button id="ai-connect-btn" class="ai-btn">Connect</button>',
      '      </div>',
      '      <div id="ai-status-text" class="ai-status' + (isConfigured() ? ' connected' : ' not-configured') + '">',
      '        ' + (isConfigured() ? '✅ Connected — ' + escapeHtml(endpoint) : '⚠️ Not configured'),
      '      </div>',
      '    </div>',

      !isConfigured()
        ? [
            '    <div class="ai-notice ai-notice--setup">',
            '      <strong>Setup required</strong><br>',
            '      AI Mode requires a secure backend. API keys must never be exposed in browser JavaScript.',
            '      See <code>README</code> for setup instructions.',
            '    </div>'
          ].join('\n')
        : '',

      '  </div>',

      '  <!-- Context info -->',
      '  <div class="ai-section ai-context-row">',
      '    <span id="ai-context-count" class="ai-context-label">',
      '      ' + conversationHistory.length + ' message' + (conversationHistory.length === 1 ? '' : 's') + ' in context',
      '    </span>',
      '    <button id="ai-clear-context-btn" class="ai-btn ai-btn--ghost">Clear Context</button>',
      '  </div>',

      '  <!-- Security notice -->',
      '  <p class="ai-security-notice">',
      '    🔒 Your API credentials are stored securely on your backend, never in this page.',
      '  </p>',

      '</div>'
    ].join('\n');

    // ── Wire up events ───────────────────────────────────────────
    var faqBtn     = document.getElementById('ai-mode-btn-faq');
    var aiBtn      = document.getElementById('ai-mode-btn-ai');
    var connectBtn = document.getElementById('ai-connect-btn');
    var inputEl    = document.getElementById('ai-endpoint-input');
    var clearCtx   = document.getElementById('ai-clear-context-btn');

    if (faqBtn) {
      faqBtn.addEventListener('click', function () {
        setMode('faq');
        renderAIPanel();
      });
    }

    if (aiBtn) {
      aiBtn.addEventListener('click', function () {
        setMode('ai');
        renderAIPanel();
      });
    }

    if (connectBtn && inputEl) {
      connectBtn.addEventListener('click', function () {
        isConnecting = true;
        syncUI();
        setEndpoint(inputEl.value);
        isConnecting = false;
        syncUI();
        renderAIPanel();
      });

      // Also allow Enter key in the input
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') connectBtn.click();
      });
    }

    if (clearCtx) {
      clearCtx.addEventListener('click', function () {
        conversationHistory = [];
        toast('🗑️ AI context cleared.');
        syncUI();
        var countEl = document.getElementById('ai-context-count');
        if (countEl) countEl.textContent = '0 messages in context';
      });
    }
  }

  // ── Utility: minimal HTML escaping ───────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ── init ──────────────────────────────────────────────────────

  /**
   * Initialise the module. Call once after DOM ready.
   * Renders the AI panel if the target element exists.
   */
  function init() {
    // Guard: if saved mode is 'ai' but endpoint is now gone, fall back to 'faq'
    if (mode === 'ai' && !isConfigured()) {
      mode = 'faq';
      localStorage.setItem(KEY_MODE, mode);
    }

    renderAIPanel();
    syncUI();
  }

  // ── Expose public API ─────────────────────────────────────────
  window.AIMode = {
    init:         init,
    isConfigured: isConfigured,
    sendMessage:  sendMessage,
    setEndpoint:  setEndpoint,
    getMode:      getMode,
    setMode:      setMode,
    renderAIPanel: renderAIPanel   // exposed so host page can re-render on demand
  };

})();
