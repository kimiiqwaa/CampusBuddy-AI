/* ═══════════════════════════════════════════════════════════════
   CampusBuddy AI 3.0 — Smart Study Planner
   Standalone module · window.Planner
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  var STORAGE_KEY = 'cb_planner_v3';

  // ── State ────────────────────────────────────────────────────
  var state = {
    subjects: [],
    sessions: [],
    generated: false,
    generatedAt: null
  };

  // ── Helpers ──────────────────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateFromStr(s) {
    // Parse YYYY-MM-DD as local midnight (avoids UTC offset shift)
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function toDateStr(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function daysBetween(a, b) {
    // b - a in days (truncated)
    return Math.floor((b - a) / 86400000);
  }

  function formatDate(dateStr) {
    var d = dateFromStr(dateStr);
    return d.toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function difficultyLabel(n) {
    return n === 1 ? 'Easy' : n === 2 ? 'Medium' : 'Hard';
  }

  function difficultyClass(n) {
    return n === 1 ? 'badge-easy' : n === 2 ? 'badge-medium' : 'badge-hard';
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  // ── Persistence ───────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Planner] save failed', e);
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.subjects) && Array.isArray(parsed.sessions)) {
        state = parsed;
      }
    } catch (e) {
      console.warn('[Planner] corrupted data, resetting', e);
      state = { subjects: [], sessions: [], generated: false, generatedAt: null };
      save();
    }
  }

  // ── Algorithm ─────────────────────────────────────────────────
  function generatePlan() {
    if (state.subjects.length === 0) {
      showPlannerToast('Add at least one subject before generating a plan.');
      return;
    }

    // Remove old generated sessions; keep manually-created ones (none in this flow)
    state.sessions = [];

    var today = dateFromStr(todayStr());

    // Build 14-day slot map: date → hoursScheduled per subject
    // and a global hours-scheduled per date (for total-day tracking)
    var days = [];
    for (var i = 0; i < 14; i++) {
      days.push(toDateStr(addDays(today, i)));
    }

    // Score each subject
    var scored = state.subjects.map(function (sub) {
      var examDate = dateFromStr(sub.examDate);
      var daysUntilExam = daysBetween(today, examDate);
      daysUntilExam = Math.max(0, daysUntilExam);
      var score = (4 - daysUntilExam / 10) * sub.difficulty * sub.priority;
      return { sub: sub, score: score, daysUntilExam: daysUntilExam };
    });

    // Sort by score descending so high-priority subjects fill first
    scored.sort(function (a, b) { return b.score - a.score; });

    // Per day per subject block counter
    // sessionsPerDay[dateStr][subjectId] = count
    var sessionsPerDay = {};
    // hoursUsedPerDay[dateStr] = hours scheduled (each block = 1 hour)
    var hoursUsedPerDay = {};
    days.forEach(function (d) {
      sessionsPerDay[d] = {};
      hoursUsedPerDay[d] = 0;
    });

    // We want to fill days round-robin across subjects weighted by score
    // Build a flat list of "wanted sessions" per subject, capped at 14*3
    var allSessions = [];

    scored.forEach(function (item) {
      var sub = item.sub;
      var examDate = dateFromStr(sub.examDate);

      days.forEach(function (dateStr) {
        var dayDate = dateFromStr(dateStr);
        // Don't schedule past exam day
        if (dayDate >= examDate) return;

        if (!sessionsPerDay[dateStr][sub.id]) sessionsPerDay[dateStr][sub.id] = 0;

        // Max 3 sessions per subject per day
        if (sessionsPerDay[dateStr][sub.id] >= 3) return;

        // Check total hours used on this day doesn't exceed subject's hoursPerDay
        if (hoursUsedPerDay[dateStr] >= sub.hoursPerDay) return;

        // Each block = 1 hour slot (50 min study + 10 min break)
        var slotIndex = hoursUsedPerDay[dateStr]; // 0-based → start at 08:00 + slotIndex hours
        var startHour = 8 + slotIndex;
        if (startHour >= 22) return; // don't schedule past 10 PM

        var startTime = String(startHour).padStart(2, '0') + ':00';
        var endHour = startHour;
        var endMin = 50;
        var endTime = String(endHour).padStart(2, '0') + ':50';

        allSessions.push({
          id: uid(),
          subjectId: sub.id,
          date: dateStr,
          startTime: startTime,
          endTime: endTime,
          completed: false,
          notes: ''
        });

        sessionsPerDay[dateStr][sub.id]++;
        hoursUsedPerDay[dateStr]++;
      });
    });

    // Sort by date then startTime
    allSessions.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      if (a.startTime < b.startTime) return -1;
      if (a.startTime > b.startTime) return 1;
      return 0;
    });

    state.sessions = allSessions;
    state.generated = true;
    state.generatedAt = new Date().toISOString();
    save();
    renderPlanner();
    showPlannerToast('Study plan generated! ' + allSessions.length + ' sessions scheduled.');
  }

  function clearPlan() {
    state.sessions = [];
    state.generated = false;
    state.generatedAt = null;
    save();
    renderPlanner();
    showPlannerToast('Plan cleared.');
  }

  // ── Subject CRUD ─────────────────────────────────────────────
  function addSubject(data) {
    var sub = {
      id: uid(),
      name: data.name.trim(),
      examDate: data.examDate,
      difficulty: clamp(parseInt(data.difficulty, 10), 1, 3),
      hoursPerDay: clamp(parseInt(data.hoursPerDay, 10), 1, 8),
      priority: clamp(parseInt(data.priority, 10), 1, 3),
      goal: (data.goal || '').trim(),
      color: data.color || '#60a5fa'
    };
    state.subjects.push(sub);
    save();
    renderPlanner();
  }

  function deleteSubject(id) {
    state.subjects = state.subjects.filter(function (s) { return s.id !== id; });
    state.sessions  = state.sessions.filter(function (s) { return s.subjectId !== id; });
    save();
    renderPlanner();
    showPlannerToast('Subject removed.');
  }

  function toggleSession(id) {
    var s = state.sessions.find(function (s) { return s.id === id; });
    if (s) {
      s.completed = !s.completed;
      save();
      renderPlanner();
    }
  }

  // ── Progress ─────────────────────────────────────────────────
  function overallProgress() {
    var total = state.sessions.length;
    var done  = state.sessions.filter(function (s) { return s.completed; }).length;
    return { total: total, done: done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function subjectProgress(subId) {
    var sessions = state.sessions.filter(function (s) { return s.subjectId === subId; });
    var total = sessions.length;
    var done  = sessions.filter(function (s) { return s.completed; }).length;
    return { total: total, done: done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // ── Modal ────────────────────────────────────────────────────
  function openModal() {
    var modal = document.getElementById('planner-modal');
    if (!modal) return;
    // Reset form
    var form = modal.querySelector('#planner-form');
    if (form) form.reset();
    // Default color
    var colorInput = modal.querySelector('#sub-color');
    if (colorInput) colorInput.value = '#60a5fa';
    // Set min date to today
    var dateInput = modal.querySelector('#sub-examDate');
    if (dateInput) dateInput.min = todayStr();
    modal.classList.add('open');
    var nameInput = modal.querySelector('#sub-name');
    if (nameInput) nameInput.focus();
  }

  function closeModal() {
    var modal = document.getElementById('planner-modal');
    if (modal) modal.classList.remove('open');
  }

  function handleModalSave() {
    var name       = (document.getElementById('sub-name')       || {}).value || '';
    var examDate   = (document.getElementById('sub-examDate')   || {}).value || '';
    var difficulty = (document.getElementById('sub-difficulty') || {}).value || '2';
    var hoursPerDay= (document.getElementById('sub-hoursPerDay')|| {}).value || '2';
    var priority   = (document.getElementById('sub-priority')   || {}).value || '2';
    var goal       = (document.getElementById('sub-goal')       || {}).value || '';
    var color      = (document.getElementById('sub-color')      || {}).value || '#60a5fa';

    // Validate
    var errors = [];
    if (!name.trim()) errors.push('Subject name is required.');
    if (!examDate) {
      errors.push('Exam date is required.');
    } else if (examDate < todayStr()) {
      errors.push('Exam date must be today or in the future.');
    }
    var hp = parseInt(hoursPerDay, 10);
    if (isNaN(hp) || hp < 1 || hp > 8) errors.push('Hours/Day must be between 1 and 8.');

    if (errors.length) {
      showPlannerToast(errors[0]);
      return;
    }

    addSubject({ name, examDate, difficulty, hoursPerDay, priority, goal, color });
    closeModal();
    showPlannerToast('Subject "' + name.trim() + '" added!');
  }

  // ── Toast ────────────────────────────────────────────────────
  function showPlannerToast(msg) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.classList.remove('visible'); }, 3000);
  }

  // ── Rendering ─────────────────────────────────────────────────
  function renderPlanner() {
    var container = document.getElementById('planner-view');
    if (!container) return;

    var prog = overallProgress();

    // ── Toolbar ──  (wrapped in .pl-view for CSS padding/max-width)
    var toolbarHTML = '<div class="pl-toolbar">' +
      '<div class="pl-toolbar-left">' +
        '<h2 class="pl-title">📅 Smart Study Planner</h2>' +
        (state.generated ? '<span class="pl-gen-badge">Plan generated</span>' : '') +
      '</div>' +
      '<div class="pl-toolbar-right">' +
        '<button class="pl-btn pl-btn-primary" id="pl-add-btn">+ Add Subject</button>' +
        '<button class="pl-btn pl-btn-secondary" id="pl-gen-btn">⚡ Generate Plan</button>' +
        '<button class="pl-btn pl-btn-ghost" id="pl-clear-btn">🗑 Clear Plan</button>' +
      '</div>' +
    '</div>';

    // ── Overall progress ──
    var overallHTML = '';
    if (state.sessions.length > 0) {
      overallHTML = '<div class="pl-overall-progress">' +
        '<div class="pl-op-label">' +
          '<span>Overall Progress</span>' +
          '<span class="pl-op-stat">' + prog.done + ' / ' + prog.total + ' sessions (' + prog.pct + '%)</span>' +
        '</div>' +
        '<div class="pl-progress-track"><div class="pl-progress-fill" style="width:' + prog.pct + '%"></div></div>' +
      '</div>';
    }

    // ── Subject cards ──
    var subjectsHTML = '';
    if (state.subjects.length === 0) {
      subjectsHTML = '<div class="pl-empty-state">' +
        '<div class="pl-empty-icon">📚</div>' +
        '<h3>No subjects yet</h3>' +
        '<p>Click <strong>+ Add Subject</strong> to start building your study plan.</p>' +
      '</div>';
    } else {
      var cards = state.subjects.map(function (sub) {
        var sp = subjectProgress(sub.id);
        var today = dateFromStr(todayStr());
        var examDate = dateFromStr(sub.examDate);
        var daysLeft = daysBetween(today, examDate);
        var daysText = daysLeft > 0 ? daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' until exam'
                     : daysLeft === 0 ? 'Exam is today!'
                     : 'Exam passed';
        return '<div class="pl-subject-card" style="--sub-color:' + sub.color + '">' +
          '<div class="pl-sc-header">' +
            '<div class="pl-sc-dot" style="background:' + sub.color + '"></div>' +
            '<div class="pl-sc-info">' +
              '<div class="pl-sc-name">' + esc(sub.name) + '</div>' +
              '<div class="pl-sc-meta">' +
                '<span class="pl-badge ' + difficultyClass(sub.difficulty) + '">' + difficultyLabel(sub.difficulty) + '</span>' +
                '<span class="pl-sc-days">' + esc(daysText) + '</span>' +
              '</div>' +
              '<div class="pl-sc-date">📅 ' + formatDate(sub.examDate) + '</div>' +
            '</div>' +
            '<button class="pl-delete-btn" data-delete-id="' + sub.id + '" title="Remove subject" aria-label="Delete ' + esc(sub.name) + '">✕</button>' +
          '</div>' +
          (sub.goal ? '<div class="pl-sc-goal">🎯 ' + esc(sub.goal) + '</div>' : '') +
          '<div class="pl-sc-progress">' +
            '<div class="pl-sc-prog-label">' +
              '<span>' + sp.done + '/' + sp.total + ' sessions</span>' +
              '<span>' + sp.pct + '%</span>' +
            '</div>' +
            '<div class="pl-progress-track"><div class="pl-progress-fill" style="width:' + sp.pct + '%;background:' + sub.color + '"></div></div>' +
          '</div>' +
        '</div>';
      });
      subjectsHTML = '<div class="pl-subjects-section">' +
        '<h3 class="pl-section-title">Subjects</h3>' +
        '<div class="pl-subject-grid">' + cards.join('') + '</div>' +
      '</div>';
    }

    // ── Weekly calendar (next 2 weeks Mon–Sun grids) ──
    var calHTML = '';
    if (state.sessions.length > 0 || state.subjects.length > 0) {
      calHTML = buildCalendarHTML();
    }

    container.innerHTML = '<div class="pl-view">' + toolbarHTML + overallHTML + subjectsHTML + calHTML + '</div>';

    // ── Bind toolbar buttons ──
    var addBtn   = document.getElementById('pl-add-btn');
    var genBtn   = document.getElementById('pl-gen-btn');
    var clearBtn = document.getElementById('pl-clear-btn');

    if (addBtn)   addBtn.addEventListener('click', openModal);
    if (genBtn)   genBtn.addEventListener('click', generatePlan);
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (state.sessions.length === 0) { showPlannerToast('No plan to clear.'); return; }
      if (confirm('Clear all scheduled sessions?')) clearPlan();
    });

    // ── Bind delete buttons ──
    container.querySelectorAll('[data-delete-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete-id');
        if (confirm('Remove this subject and its sessions?')) deleteSubject(id);
      });
    });

    // ── Bind session checkboxes ──
    container.querySelectorAll('[data-session-id]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        toggleSession(cb.getAttribute('data-session-id'));
      });
    });
  }

  function buildCalendarHTML() {
    var today = dateFromStr(todayStr());

    // Build an index: date → sessions[]
    var sessionsByDate = {};
    state.sessions.forEach(function (s) {
      if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
      sessionsByDate[s.date].push(s);
    });

    // Build subject lookup
    var subMap = {};
    state.subjects.forEach(function (s) { subMap[s.id] = s; });

    // DAY_NAMES starting Monday
    var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Find Monday of current week
    var todayDow = today.getDay(); // 0 Sun … 6 Sat
    var offsetToMon = todayDow === 0 ? -6 : 1 - todayDow;
    var weekStart = addDays(today, offsetToMon);

    var weeksHTML = '';
    for (var w = 0; w < 2; w++) {
      var wStart = addDays(weekStart, w * 7);
      var wEnd   = addDays(wStart, 6);
      var wLabel = formatDate(toDateStr(wStart)) + ' – ' + formatDate(toDateStr(wEnd));

      var cellsHTML = '';
      for (var d = 0; d < 7; d++) {
        var dayDate    = addDays(wStart, d);
        var dayStr     = toDateStr(dayDate);
        var isToday    = dayStr === todayStr();
        var isPast     = dayDate < today;
        var daySessions = sessionsByDate[dayStr] || [];

        var sessItems = daySessions.map(function (s) {
          var sub = subMap[s.subjectId];
          if (!sub) return '';
          return '<label class="pl-session-item' + (s.completed ? ' completed' : '') + '">' +
            '<input type="checkbox" data-session-id="' + s.id + '"' + (s.completed ? ' checked' : '') + '>' +
            '<span class="pl-sess-dot" style="background:' + sub.color + '"></span>' +
            '<span class="pl-sess-name">' + esc(sub.name) + '</span>' +
            '<span class="pl-sess-time">' + s.startTime + '–' + s.endTime + '</span>' +
          '</label>';
        }).join('');

        cellsHTML += '<div class="pl-cal-cell' + (isToday ? ' today' : '') + (isPast ? ' past' : '') + '">' +
          '<div class="pl-cal-day-label">' +
            '<span class="pl-cal-dow">' + DAY_NAMES[d] + '</span>' +
            '<span class="pl-cal-date">' + dayDate.getDate() + '</span>' +
          '</div>' +
          '<div class="pl-cal-sessions">' +
            (sessItems || '<span class="pl-cal-empty">—</span>') +
          '</div>' +
        '</div>';
      }

      weeksHTML += '<div class="pl-week-block">' +
        '<div class="pl-week-label">' + wLabel + '</div>' +
        '<div class="pl-cal-grid">' + cellsHTML + '</div>' +
      '</div>';
    }

    return '<div class="pl-calendar-section">' +
      '<h3 class="pl-section-title">2-Week Schedule</h3>' +
      weeksHTML +
    '</div>';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Modal HTML (injected once) ────────────────────────────────
  function injectModalIfMissing() {
    if (document.getElementById('planner-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'planner-modal';
    modal.className = 'pl-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pl-modal-title');
    modal.innerHTML =
      '<div class="pl-modal">' +
        '<div class="pl-modal-header">' +
          '<h3 id="pl-modal-title">Add Subject</h3>' +
          '<button class="pl-modal-close btn-icon" id="pl-modal-close-btn" aria-label="Close">✕</button>' +
        '</div>' +
        '<form id="planner-form" class="pl-modal-body" novalidate>' +
          '<div class="pl-field">' +
            '<label for="sub-name">Subject Name <span class="pl-req">*</span></label>' +
            '<input type="text" id="sub-name" placeholder="e.g. Mathematics" maxlength="80" autocomplete="off">' +
          '</div>' +
          '<div class="pl-field">' +
            '<label for="sub-examDate">Exam Date <span class="pl-req">*</span></label>' +
            '<input type="date" id="sub-examDate">' +
          '</div>' +
          '<div class="pl-field-row">' +
            '<div class="pl-field">' +
              '<label for="sub-difficulty">Difficulty</label>' +
              '<select id="sub-difficulty">' +
                '<option value="1">1 — Easy</option>' +
                '<option value="2" selected>2 — Medium</option>' +
                '<option value="3">3 — Hard</option>' +
              '</select>' +
            '</div>' +
            '<div class="pl-field">' +
              '<label for="sub-priority">Priority</label>' +
              '<select id="sub-priority">' +
                '<option value="1">1 — Low</option>' +
                '<option value="2" selected>2 — Medium</option>' +
                '<option value="3">3 — High</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="pl-field-row">' +
            '<div class="pl-field">' +
              '<label for="sub-hoursPerDay">Hours / Day</label>' +
              '<input type="number" id="sub-hoursPerDay" min="1" max="8" value="2">' +
            '</div>' +
            '<div class="pl-field">' +
              '<label for="sub-color">Color</label>' +
              '<input type="color" id="sub-color" value="#60a5fa" class="pl-color-input">' +
            '</div>' +
          '</div>' +
          '<div class="pl-field">' +
            '<label for="sub-goal">Goal (optional)</label>' +
            '<textarea id="sub-goal" rows="2" placeholder="e.g. Score A+ in finals" maxlength="200"></textarea>' +
          '</div>' +
        '</form>' +
        '<div class="pl-modal-footer">' +
          '<button class="pl-btn pl-btn-ghost" id="pl-modal-cancel-btn">Cancel</button>' +
          '<button class="pl-btn pl-btn-primary" id="pl-modal-save-btn">Add Subject</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.getElementById('pl-modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('pl-modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('pl-modal-save-btn').addEventListener('click', handleModalSave);

    // Submit on Enter in form (except textarea)
    document.getElementById('planner-form').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleModalSave();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ── Planner view toggle ───────────────────────────────────────
  function showPlannerView() {
    var plannerView = document.getElementById('planner-view');
    var contentArea = document.querySelector('.content-area');
    if (!plannerView || !contentArea) return;

    // Toggle visibility
    var isOpen = plannerView.style.display !== 'none' && plannerView.dataset.active === '1';
    if (isOpen) {
      plannerView.style.display = 'none';
      plannerView.dataset.active = '0';
      contentArea.style.display = '';
    } else {
      contentArea.style.display = 'none';
      plannerView.style.display = 'block';
      plannerView.dataset.active = '1';
      renderPlanner();
    }
  }

  // ── Public init ───────────────────────────────────────────────
  function init() {
    load();
    injectModalIfMissing();
    // Always render on init — called lazily by script.js when the view is first opened
    renderPlanner();
  }

  // ── Expose public API ─────────────────────────────────────────
  global.Planner = {
    init: init,
    generatePlan: generatePlan,
    clearPlan: clearPlan,
    addSubject: addSubject,
    deleteSubject: deleteSubject,
    toggleSession: toggleSession,
    renderPlanner: renderPlanner,
    openModal: openModal,
    closeModal: closeModal
  };

}(window));
