/* ═══════════════════════════════════════════════════════════════
   CampusBuddy AI 3.0 — Smart Focus Timer (Pomodoro)
   Standalone module — no imports, loaded via <script> tag
   localStorage key: 'cb_timer_v3'
   ═══════════════════════════════════════════════════════════════ */

window.Timer = (function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  const STORAGE_KEY   = 'cb_timer_v3';
  const CIRCUMFERENCE = 2 * Math.PI * 52; // 326.726…

  /* ── Default state ─────────────────────────────────────────── */
  function defaultState() {
    return {
      mode: 'focus',
      durations: { focus: 25, short: 5, long: 15 },
      status: 'idle',
      startedAt: null,
      pausedAt: null,
      elapsed: 0,
      sessionsToday: 0,
      totalFocusMinutes: 0,
      lastActiveDate: null,
      streak: 0,
      focusCount: 0,         // track focus sessions in current cycle for auto-switch
      history: []
    };
  }

  /* ── Persistence ───────────────────────────────────────────── */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = Object.assign(defaultState(), JSON.parse(raw));

      // Handle page refresh while running
      if (s.status === 'running' && s.startedAt) {
        s.elapsed += Date.now() - s.startedAt;
        s.startedAt = Date.now();
      }

      // Check streak validity
      const today = todayStr();
      const yesterday = yesterdayStr();
      if (s.lastActiveDate && s.lastActiveDate !== today && s.lastActiveDate !== yesterday) {
        s.streak = 0;
      }

      // Reset sessionsToday if lastActiveDate is not today
      if (s.lastActiveDate !== today) {
        s.sessionsToday = 0;
      }

      return s;
    } catch (_) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  /* ── Date helpers ──────────────────────────────────────────── */
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /* ── Audio beep (AudioContext, no external files) ──────────── */
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Three rising tones
      [0, 0.18, 0.36].forEach(function (offset, i) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 520 + i * 120;
        g.gain.setValueAtTime(0, ctx.currentTime + offset);
        g.gain.linearRampToValueAtTime(1, ctx.currentTime + offset + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.28);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.3);
      });
    } catch (_) {}
  }

  /* ── Module state ──────────────────────────────────────────── */
  var state        = loadState();
  var tickHandle   = null;

  /* ── Computed helpers ──────────────────────────────────────── */
  function totalMs() {
    return state.durations[state.mode] * 60 * 1000;
  }

  function computeRemaining() {
    if (state.status === 'idle') return totalMs();
    if (state.status === 'paused') return Math.max(0, totalMs() - state.elapsed);
    // running
    return Math.max(0, totalMs() - state.elapsed - (Date.now() - state.startedAt));
  }

  function formatMMSS(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ── Tick loop ─────────────────────────────────────────────── */
  function startTick() {
    if (tickHandle !== null) return;
    tickHandle = setInterval(onTick, 250);
  }

  function stopTick() {
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function onTick() {
    var remaining = computeRemaining();
    updateDisplay(remaining);
    if (remaining <= 0 && state.status === 'running') {
      onComplete();
    }
  }

  /* ── Timer controls ────────────────────────────────────────── */
  function start() {
    if (state.status !== 'idle') return;
    state.status    = 'running';
    state.startedAt = Date.now();
    state.elapsed   = 0;
    saveState();
    startTick();
    renderButtons();
  }

  function pause() {
    if (state.status !== 'running') return;
    state.elapsed  += Date.now() - state.startedAt;
    state.startedAt = null;
    state.pausedAt  = Date.now();
    state.status    = 'paused';
    saveState();
    stopTick();
    renderButtons();
    updateDisplay(computeRemaining());
  }

  function resume() {
    if (state.status !== 'paused') return;
    state.startedAt = Date.now();
    state.pausedAt  = null;
    state.status    = 'running';
    saveState();
    startTick();
    renderButtons();
  }

  function reset() {
    stopTick();
    state.status    = 'idle';
    state.elapsed   = 0;
    state.startedAt = null;
    state.pausedAt  = null;
    saveState();
    renderButtons();
    updateDisplay(totalMs());
  }

  function switchMode(mode) {
    stopTick();
    state.mode      = mode;
    state.status    = 'idle';
    state.elapsed   = 0;
    state.startedAt = null;
    state.pausedAt  = null;
    saveState();
    renderModeTabs();
    renderButtons();
    updateDisplay(totalMs());
  }

  /* ── Session completion ────────────────────────────────────── */
  function onComplete() {
    stopTick();
    playBeep();

    var completedMode = state.mode;

    // Update stats for focus sessions
    if (completedMode === 'focus') {
      var today = todayStr();
      var yesterday = yesterdayStr();

      // Streak logic
      if (state.lastActiveDate === yesterday) {
        state.streak += 1;
      } else if (state.lastActiveDate === today) {
        // streak stays
      } else {
        state.streak = 1;
      }

      state.lastActiveDate  = today;
      state.sessionsToday  += 1;
      state.totalFocusMinutes += state.durations.focus;
      state.focusCount     += 1;

      // Update history
      updateHistory(today, state.durations.focus);
    }

    // Auto-switch: after every 4 focus sessions → long break, else short break
    var nextMode;
    if (completedMode === 'focus') {
      nextMode = (state.focusCount % 4 === 0) ? 'long' : 'short';
    } else {
      nextMode = 'focus';
    }

    state.mode      = nextMode;
    state.status    = 'idle';
    state.elapsed   = 0;
    state.startedAt = null;
    state.pausedAt  = null;

    saveState();
    renderAll();
  }

  /* ── History helpers ───────────────────────────────────────── */
  function updateHistory(date, minutes) {
    var entry = null;
    for (var i = 0; i < state.history.length; i++) {
      if (state.history[i].date === date) { entry = state.history[i]; break; }
    }
    if (entry) {
      entry.sessions += 1;
      entry.minutes  += minutes;
    } else {
      state.history.push({ date: date, sessions: 1, minutes: minutes });
    }
    // Keep last 7 days only
    state.history.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (state.history.length > 7) {
      state.history = state.history.slice(state.history.length - 7);
    }
  }

  function getLast7Days() {
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var dateStr = d.toISOString().slice(0, 10);
      var found   = null;
      for (var j = 0; j < state.history.length; j++) {
        if (state.history[j].date === dateStr) { found = state.history[j]; break; }
      }
      days.push(found || { date: dateStr, sessions: 0, minutes: 0 });
    }
    return days;
  }

  /* ── Rendering ─────────────────────────────────────────────── */
  function getContainer() {
    return document.getElementById('timer-view');
  }

  function renderAll() {
    var container = getContainer();
    if (!container) return;
    container.innerHTML = buildHTML();
    bindEvents();
    updateDisplay(computeRemaining());
    renderBarChart();
  }

  function buildHTML() {
    var modLabels = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };

    // Mode tabs
    var tabs = ['focus', 'short', 'long'].map(function (m) {
      var active = m === state.mode ? ' timer-tab--active' : '';
      return '<button class="timer-tab' + active + '" data-timer-mode="' + m + '">' + modLabels[m] + '</button>';
    }).join('');

    // SVG ring
    var svgSize = 120;
    var r       = 52;
    var cx      = 60;
    var cy      = 60;

    var ringHTML = [
      '<svg class="timer-svg" viewBox="0 0 120 120" width="' + svgSize + '" height="' + svgSize + '" aria-hidden="true">',
      '  <circle class="timer-ring-bg" cx="' + cx + '" cy="' + cy + '" r="' + r + '"',
      '    fill="none" stroke-width="8"/>',
      '  <circle id="timer-ring-fg" class="timer-ring-fg" cx="' + cx + '" cy="' + cy + '" r="' + r + '"',
      '    fill="none" stroke-width="8"',
      '    stroke-dasharray="' + CIRCUMFERENCE.toFixed(2) + '"',
      '    stroke-dashoffset="0"',
      '    transform="rotate(-90 ' + cx + ' ' + cy + ')"/>',
      '</svg>',
    ].join('');

    // Center time display
    var displayHTML = '<div class="timer-face">' + ringHTML + '<div id="timer-display" class="timer-display">00:00</div></div>';

    // Control buttons
    var btnHTML = '<div class="timer-controls" id="timer-controls"></div>';

    // Stats row
    var statsHTML = [
      '<div class="timer-stats">',
      '  <div class="timer-stat"><span class="timer-stat-val" id="stat-sessions">' + state.sessionsToday + '</span><span class="timer-stat-lbl">Sessions Today</span></div>',
      '  <div class="timer-stat"><span class="timer-stat-val" id="stat-focus-mins">' + state.totalFocusMinutes + '</span><span class="timer-stat-lbl">Focus Mins</span></div>',
      '  <div class="timer-stat"><span class="timer-stat-val" id="stat-streak">' + state.streak + '</span><span class="timer-stat-lbl">Day Streak 🔥</span></div>',
      '</div>',
    ].join('');

    // Bar chart
    var chartHTML = '<div class="timer-chart-wrap"><div class="timer-chart-title">Last 7 Days</div><div class="timer-chart" id="timer-bar-chart"></div><div class="timer-chart-labels" id="timer-chart-labels"></div></div>';

    // Custom durations (collapsible)
    var customHTML = [
      '<details class="timer-custom">',
      '  <summary class="timer-custom-toggle">⚙ Custom Durations</summary>',
      '  <div class="timer-custom-body">',
      '    <label class="timer-custom-label">Focus <input type="number" class="timer-custom-input" id="input-focus" min="1" max="60" value="' + state.durations.focus + '"> min</label>',
      '    <label class="timer-custom-label">Short Break <input type="number" class="timer-custom-input" id="input-short" min="1" max="60" value="' + state.durations.short + '"> min</label>',
      '    <label class="timer-custom-label">Long Break <input type="number" class="timer-custom-input" id="input-long" min="1" max="60" value="' + state.durations.long + '"> min</label>',
      '    <button class="timer-custom-apply" id="apply-custom">Apply</button>',
      '  </div>',
      '</details>',
    ].join('');

    return [
      '<div class="timer-card">',
      '  <div class="timer-header">',
      '    <span class="timer-title">⏱ Smart Focus Timer</span>',
      '  </div>',
      '  <div class="timer-tabs" role="tablist" aria-label="Timer mode">' + tabs + '</div>',
      '  ' + displayHTML,
      '  ' + btnHTML,
      '  ' + statsHTML,
      '  ' + chartHTML,
      '  ' + customHTML,
      '</div>',
    ].join('');
  }

  function renderModeTabs() {
    var container = getContainer();
    if (!container) return;
    var tabs = container.querySelectorAll('.timer-tab');
    tabs.forEach(function (btn) {
      var active = btn.dataset.timerMode === state.mode;
      btn.classList.toggle('timer-tab--active', active);
    });
  }

  function renderButtons() {
    var ctrl = document.getElementById('timer-controls');
    if (!ctrl) return;
    var html = '';
    if (state.status === 'idle') {
      html  = '<button class="timer-btn timer-btn--primary" id="timer-start">▶ Start</button>';
      html += '<button class="timer-btn timer-btn--secondary" id="timer-reset" disabled>↺ Reset</button>';
    } else if (state.status === 'running') {
      html  = '<button class="timer-btn timer-btn--pause" id="timer-pause">⏸ Pause</button>';
      html += '<button class="timer-btn timer-btn--secondary" id="timer-reset">↺ Reset</button>';
    } else if (state.status === 'paused') {
      html  = '<button class="timer-btn timer-btn--primary" id="timer-resume">▶ Resume</button>';
      html += '<button class="timer-btn timer-btn--secondary" id="timer-reset">↺ Reset</button>';
    }
    ctrl.innerHTML = html;
    bindControlEvents();
  }

  function updateDisplay(remaining) {
    var display = document.getElementById('timer-display');
    var ring    = document.getElementById('timer-ring-fg');
    if (display) display.textContent = formatMMSS(remaining);

    if (ring) {
      var proportion = (totalMs() > 0) ? (remaining / totalMs()) : 1;
      proportion = Math.max(0, Math.min(1, proportion));
      ring.style.strokeDashoffset = ((1 - proportion) * CIRCUMFERENCE).toFixed(3);
    }

    // Sync live stats
    var sSession = document.getElementById('stat-sessions');
    var sFocus   = document.getElementById('stat-focus-mins');
    var sStreak  = document.getElementById('stat-streak');
    if (sSession) sSession.textContent = state.sessionsToday;
    if (sFocus)   sFocus.textContent   = state.totalFocusMinutes;
    if (sStreak)  sStreak.textContent  = state.streak;
  }

  function renderBarChart() {
    var chartEl  = document.getElementById('timer-bar-chart');
    var labelEl  = document.getElementById('timer-chart-labels');
    if (!chartEl || !labelEl) return;

    var days = getLast7Days();
    var max  = 1;
    days.forEach(function (d) { if (d.sessions > max) max = d.sessions; });

    chartEl.innerHTML = days.map(function (d) {
      var pct = Math.round((d.sessions / max) * 100);
      var title = d.date + ': ' + d.sessions + ' session' + (d.sessions !== 1 ? 's' : '') + ', ' + d.minutes + ' min';
      return '<div class="timer-bar-wrap" title="' + title + '"><div class="timer-bar" style="height:' + (d.sessions === 0 ? 4 : pct) + '%"></div></div>';
    }).join('');

    labelEl.innerHTML = days.map(function (d) {
      var parts = d.date.split('-');
      var month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(parts[1], 10) - 1];
      return '<span class="timer-chart-lbl">' + parseInt(parts[2], 10) + ' ' + month + '</span>';
    }).join('');
  }

  /* ── Event binding ─────────────────────────────────────────── */
  function bindControlEvents() {
    var btnStart  = document.getElementById('timer-start');
    var btnPause  = document.getElementById('timer-pause');
    var btnResume = document.getElementById('timer-resume');
    var btnReset  = document.getElementById('timer-reset');

    if (btnStart)  btnStart.addEventListener('click', start);
    if (btnPause)  btnPause.addEventListener('click', pause);
    if (btnResume) btnResume.addEventListener('click', resume);
    if (btnReset)  btnReset.addEventListener('click', reset);
  }

  function bindEvents() {
    var container = getContainer();
    if (!container) return;

    // Mode tabs
    container.querySelectorAll('[data-timer-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchMode(btn.dataset.timerMode);
      });
    });

    // Apply custom durations
    var applyBtn = document.getElementById('apply-custom');
    if (applyBtn) {
      applyBtn.addEventListener('click', applyCustomDurations);
    }

    // Buttons (start/pause etc. are inside #timer-controls, bound by renderButtons)
    bindControlEvents();
  }

  function applyCustomDurations() {
    var focusInput = document.getElementById('input-focus');
    var shortInput = document.getElementById('input-short');
    var longInput  = document.getElementById('input-long');

    function clamp(val) { return Math.max(1, Math.min(60, parseInt(val, 10) || 1)); }

    state.durations.focus = clamp(focusInput.value);
    state.durations.short = clamp(shortInput.value);
    state.durations.long  = clamp(longInput.value);

    // Keep input values synced after clamping
    focusInput.value = state.durations.focus;
    shortInput.value = state.durations.short;
    longInput.value  = state.durations.long;

    reset(); // reset resets elapsed and saves
    saveState();
    updateDisplay(totalMs());
  }

  /* ── Styles ────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('timer-styles')) return;
    var style = document.createElement('style');
    style.id  = 'timer-styles';
    style.textContent = [
      /* Card wrapper */
      '.timer-card{background:var(--bg-card,rgba(14,21,37,0.7));border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:20px;padding:24px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:18px;max-width:380px;margin:0 auto;box-shadow:var(--shadow-card);}',
      /* Header */
      '.timer-header{width:100%;display:flex;align-items:center;justify-content:center;}',
      '.timer-title{font-size:1rem;font-weight:600;color:var(--text-primary,#f0f4ff);letter-spacing:0.3px;}',
      /* Mode tabs */
      '.timer-tabs{display:flex;gap:6px;background:var(--bg-input,rgba(255,255,255,0.05));padding:4px;border-radius:12px;}',
      '.timer-tab{padding:6px 14px;border:none;border-radius:8px;font-size:0.8rem;font-weight:500;cursor:pointer;color:var(--text-secondary,#94a3b8);background:transparent;transition:all 0.2s;}',
      '.timer-tab:hover{color:var(--text-primary,#f0f4ff);}',
      '.timer-tab--active{background:var(--accent-blue,#60a5fa) !important;color:#fff !important;box-shadow:0 2px 8px rgba(96,165,250,0.35);}',
      /* Face */
      '.timer-face{position:relative;width:140px;height:140px;display:flex;align-items:center;justify-content:center;}',
      '.timer-svg{position:absolute;top:0;left:0;width:140px;height:140px;}',
      /* SVG circles */
      '.timer-ring-bg{stroke:var(--border,rgba(255,255,255,0.08));}',
      '.timer-ring-fg{stroke:var(--accent-blue,#60a5fa);transition:stroke-dashoffset 0.25s linear;}',
      /* Countdown text */
      '.timer-display{position:relative;font-size:2rem;font-weight:700;font-family:var(--font-mono,"JetBrains Mono",monospace);color:var(--text-primary,#f0f4ff);letter-spacing:2px;z-index:1;text-align:center;}',
      /* Control buttons */
      '.timer-controls{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}',
      '.timer-btn{padding:9px 22px;border:none;border-radius:10px;font-size:0.88rem;font-weight:600;cursor:pointer;transition:all 0.2s;outline:none;}',
      '.timer-btn--primary{background:var(--accent-blue,#60a5fa);color:#fff;box-shadow:0 3px 12px rgba(96,165,250,0.35);}',
      '.timer-btn--primary:hover{filter:brightness(1.1);}',
      '.timer-btn--pause{background:var(--accent-amber,#fbbf24);color:#1a1a1a;box-shadow:0 3px 12px rgba(251,191,36,0.3);}',
      '.timer-btn--pause:hover{filter:brightness(1.08);}',
      '.timer-btn--secondary{background:var(--bg-input,rgba(255,255,255,0.08));color:var(--text-secondary,#94a3b8);border:1px solid var(--border);}',
      '.timer-btn--secondary:hover:not(:disabled){background:var(--bg-chip-hover,rgba(96,165,250,0.2));color:var(--text-primary,#f0f4ff);}',
      '.timer-btn:disabled{opacity:0.4;cursor:not-allowed;}',
      /* Stats */
      '.timer-stats{display:flex;gap:8px;width:100%;justify-content:center;}',
      '.timer-stat{display:flex;flex-direction:column;align-items:center;background:var(--bg-input,rgba(255,255,255,0.05));border-radius:10px;padding:8px 14px;flex:1;min-width:0;}',
      '.timer-stat-val{font-size:1.4rem;font-weight:700;color:var(--accent-blue,#60a5fa);line-height:1;}',
      '.timer-stat-lbl{font-size:0.68rem;color:var(--text-muted,#475569);margin-top:3px;text-align:center;white-space:nowrap;}',
      /* Bar chart */
      '.timer-chart-wrap{width:100%;}',
      '.timer-chart-title{font-size:0.75rem;font-weight:600;color:var(--text-secondary,#94a3b8);margin-bottom:6px;text-align:center;letter-spacing:0.5px;text-transform:uppercase;}',
      '.timer-chart{display:flex;gap:4px;align-items:flex-end;height:52px;background:var(--bg-input,rgba(255,255,255,0.04));border-radius:8px;padding:6px 8px 0;}',
      '.timer-bar-wrap{flex:1;display:flex;align-items:flex-end;height:100%;}',
      '.timer-bar{width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,var(--accent-violet,#a78bfa),var(--accent-blue,#60a5fa));transition:height 0.3s;min-height:4px;}',
      '.timer-chart-labels{display:flex;gap:4px;margin-top:4px;}',
      '.timer-chart-lbl{flex:1;text-align:center;font-size:0.6rem;color:var(--text-muted,#475569);}',
      /* Custom durations */
      '.timer-custom{width:100%;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,0.08));overflow:hidden;}',
      '.timer-custom-toggle{font-size:0.8rem;font-weight:500;color:var(--text-secondary,#94a3b8);cursor:pointer;padding:8px 12px;list-style:none;background:var(--bg-input,rgba(255,255,255,0.04));}',
      '.timer-custom-toggle::-webkit-details-marker{display:none;}',
      '.timer-custom-toggle:hover{color:var(--text-primary,#f0f4ff);}',
      '.timer-custom-body{padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;}',
      '.timer-custom-label{font-size:0.78rem;color:var(--text-secondary,#94a3b8);display:flex;align-items:center;gap:6px;}',
      '.timer-custom-input{width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--border,rgba(255,255,255,0.1));background:var(--bg-input,rgba(255,255,255,0.06));color:var(--text-primary,#f0f4ff);font-size:0.82rem;text-align:center;}',
      '.timer-custom-apply{margin-left:auto;padding:6px 14px;border:none;border-radius:8px;background:var(--accent-blue,#60a5fa);color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;}',
      '.timer-custom-apply:hover{filter:brightness(1.1);}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Public init ───────────────────────────────────────────── */
  function init() {
    injectStyles();
    renderAll();

    // If we restored a running state, resume the tick
    if (state.status === 'running') {
      startTick();
    }
  }

  return { init: init };
})();
