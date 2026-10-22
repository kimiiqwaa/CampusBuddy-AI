window.I18n = (function () {
  let _lang = 'en';

  const T = {
    en: {
      // GENERAL / NAV
      'nav.chat': 'Chat',
      'nav.planner': 'Study Planner',
      'nav.timer': 'Focus Timer',
      'nav.dashboard': 'Dashboard',
      'app.tagline': 'Your Smart Campus, One Chat Away.',
      'app.version': 'v3.0 Ultimate',

      // TOPBAR
      'topbar.greeting.morning': 'Good morning! 👋',
      'topbar.greeting.afternoon': 'Good afternoon! 👋',
      'topbar.greeting.evening': 'Good evening! 👋',
      'topbar.subtitle': 'How can I help you today?',
      'topbar.subtitle.sub': 'Ask me anything about academics, exams, campus services, or study strategies.',

      // STATUS
      'status.online': 'Online · Ready to help',
      'status.offline': 'Offline',
      'status.typing': 'Typing…',

      // CHAT
      'chat.placeholder': 'Ask me anything about campus life…',
      'chat.hint': 'Press Enter to send · Shift+Enter for new line · Bilingual: EN / BM',
      'chat.clear': 'Clear Conversation',
      'chat.save': 'Save Conversation',
      'chat.cleared': 'Conversation cleared.',
      'chat.saved': 'Conversation saved!',
      'chat.empty.title': 'Start a conversation!',
      'chat.empty.sub': 'Type your question below or click a suggestion above.',
      'chat.copy': 'Copy',
      'chat.copied': 'Copied!',
      'chat.mode.faq': 'FAQ Mode',
      'chat.mode.ai': 'AI Mode',
      'chat.ai.unavailable': 'AI Mode requires a backend. Using FAQ mode.',

      // PLANNER
      'planner.title': 'Study Planner',
      'planner.add': 'Add Subject',
      'planner.generate': 'Generate Plan',
      'planner.clear': 'Clear Plan',
      'planner.empty.title': 'No subjects added yet',
      'planner.empty.sub': 'Add your subjects and exam dates to generate a personalised study timetable.',
      'planner.subject.name': 'Subject Name',
      'planner.subject.examDate': 'Exam Date',
      'planner.subject.difficulty': 'Difficulty',
      'planner.subject.hoursPerDay': 'Hours per Day',
      'planner.subject.priority': 'Priority',
      'planner.subject.goal': 'Learning Goal',
      'planner.subject.color': 'Color',
      'planner.difficulty.easy': 'Easy',
      'planner.difficulty.medium': 'Medium',
      'planner.difficulty.hard': 'Hard',
      'planner.priority.low': 'Low',
      'planner.priority.medium': 'Medium',
      'planner.priority.high': 'High',
      'planner.days': '{n} days until exam',
      'planner.progress': '{n}% complete',
      'planner.sessions': '{n} sessions',
      'planner.noSessions': 'No sessions scheduled',
      'planner.generated': 'Plan generated!',
      'planner.cleared': 'Plan cleared.',
      'planner.saved': 'Plan saved.',

      // TIMER
      'timer.title': 'Focus Timer',
      'timer.focus': 'Focus',
      'timer.short': 'Short Break',
      'timer.long': 'Long Break',
      'timer.start': 'Start',
      'timer.pause': 'Pause',
      'timer.resume': 'Resume',
      'timer.reset': 'Reset',
      'timer.sessions': 'Sessions Today',
      'timer.totalMins': 'Focus Minutes',
      'timer.streak': 'Day Streak',
      'timer.complete': 'Session complete! 🎉',
      'timer.custom': 'Custom Durations',

      // DASHBOARD
      'dash.welcome': 'Welcome back! 🎓',
      'dash.today': "Today's Schedule",
      'dash.upcoming': 'Upcoming Exams',
      'dash.progress': 'Study Progress',
      'dash.focusSummary': 'Focus Summary',
      'dash.motivation': 'Daily Motivation',
      'dash.noExams': 'No upcoming exams',
      'dash.noSchedule': 'No sessions today',
      'dash.weeklyOverview': 'Weekly Overview',

      // BUTTONS / COMMON
      'btn.save': 'Save',
      'btn.cancel': 'Cancel',
      'btn.delete': 'Delete',
      'btn.edit': 'Edit',
      'btn.close': 'Close',
      'btn.confirm': 'Confirm',
      'btn.done': 'Done',
      'btn.addSubject': 'Add Subject',
      'btn.studyTip': 'Random Study Tip',

      // SIDEBAR
      'sidebar.views': 'Views',
      'sidebar.features': 'Features',
      'sidebar.tools': 'Tools',
      'sidebar.academic': 'Academic Help',
      'sidebar.exam': 'Exam Preparation',
      'sidebar.campus': 'Campus Services',
      'sidebar.tips': 'Study Tips',
      'sidebar.status': 'AI Assistant Online',
      'sidebar.footer': 'IBM AI Workshop Demo · 2025',

      // ERRORS
      'error.nameRequired': 'Subject name is required.',
      'error.examDateRequired': 'Exam date is required.',
      'error.examDatePast': 'Exam date must be today or in the future.',
      'error.hoursInvalid': 'Hours per day must be between 1 and 8.',
      'error.noSubjects': 'Add at least one subject before generating a plan.',
    },

    ms: {
      // GENERAL / NAV
      'nav.chat': 'Sembang',
      'nav.planner': 'Perancang Belajar',
      'nav.timer': 'Pemasa Fokus',
      'nav.dashboard': 'Papan Pemuka',
      'app.tagline': 'Kampus Pintar Anda, Satu Sembang Sahaja.',
      'app.version': 'v3.0 Unggul',

      // TOPBAR
      'topbar.greeting.morning': 'Selamat pagi! 👋',
      'topbar.greeting.afternoon': 'Selamat petang! 👋',
      'topbar.greeting.evening': 'Selamat malam! 👋',
      'topbar.subtitle': 'Apa yang boleh saya bantu hari ini?',
      'topbar.subtitle.sub': 'Tanya saya apa-apa tentang akademik, peperiksaan, perkhidmatan kampus, atau strategi belajar.',

      // STATUS
      'status.online': 'Dalam talian · Sedia membantu',
      'status.offline': 'Luar talian',
      'status.typing': 'Sedang menaip…',

      // CHAT
      'chat.placeholder': 'Tanya saya apa-apa tentang kehidupan kampus…',
      'chat.hint': 'Tekan Enter untuk hantar · Shift+Enter baris baru · Dwibahasa: EN / BM',
      'chat.clear': 'Kosongkan Perbualan',
      'chat.save': 'Simpan Perbualan',
      'chat.cleared': 'Perbualan dikosongkan.',
      'chat.saved': 'Perbualan disimpan!',
      'chat.empty.title': 'Mulakan perbualan!',
      'chat.empty.sub': 'Taip soalan anda di bawah atau klik cadangan di atas.',
      'chat.copy': 'Salin',
      'chat.copied': 'Disalin!',
      'chat.mode.faq': 'Mod FAQ',
      'chat.mode.ai': 'Mod AI',
      'chat.ai.unavailable': 'Mod AI memerlukan backend. Menggunakan mod FAQ.',

      // PLANNER
      'planner.title': 'Perancang Belajar',
      'planner.add': 'Tambah Subjek',
      'planner.generate': 'Jana Rancangan',
      'planner.clear': 'Kosongkan Rancangan',
      'planner.empty.title': 'Tiada subjek ditambah lagi',
      'planner.empty.sub': 'Tambah subjek dan tarikh peperiksaan anda untuk menjana jadual belajar yang diperibadikan.',
      'planner.subject.name': 'Nama Subjek',
      'planner.subject.examDate': 'Tarikh Peperiksaan',
      'planner.subject.difficulty': 'Tahap Kesukaran',
      'planner.subject.hoursPerDay': 'Jam Sehari',
      'planner.subject.priority': 'Keutamaan',
      'planner.subject.goal': 'Matlamat Belajar',
      'planner.subject.color': 'Warna',
      'planner.difficulty.easy': 'Mudah',
      'planner.difficulty.medium': 'Sederhana',
      'planner.difficulty.hard': 'Susah',
      'planner.priority.low': 'Rendah',
      'planner.priority.medium': 'Sederhana',
      'planner.priority.high': 'Tinggi',
      'planner.days': '{n} hari sebelum peperiksaan',
      'planner.progress': '{n}% selesai',
      'planner.sessions': '{n} sesi',
      'planner.noSessions': 'Tiada sesi dijadualkan',
      'planner.generated': 'Rancangan dijana!',
      'planner.cleared': 'Rancangan dikosongkan.',
      'planner.saved': 'Rancangan disimpan.',

      // TIMER
      'timer.title': 'Pemasa Fokus',
      'timer.focus': 'Fokus',
      'timer.short': 'Rehat Pendek',
      'timer.long': 'Rehat Panjang',
      'timer.start': 'Mulakan',
      'timer.pause': 'Jeda',
      'timer.resume': 'Sambung',
      'timer.reset': 'Tetapkan Semula',
      'timer.sessions': 'Sesi Hari Ini',
      'timer.totalMins': 'Minit Fokus',
      'timer.streak': 'Rantaian Hari',
      'timer.complete': 'Sesi selesai! 🎉',
      'timer.custom': 'Tempoh Tersuai',

      // DASHBOARD
      'dash.welcome': 'Selamat kembali! 🎓',
      'dash.today': 'Jadual Hari Ini',
      'dash.upcoming': 'Peperiksaan Akan Datang',
      'dash.progress': 'Kemajuan Belajar',
      'dash.focusSummary': 'Ringkasan Fokus',
      'dash.motivation': 'Motivasi Harian',
      'dash.noExams': 'Tiada peperiksaan akan datang',
      'dash.noSchedule': 'Tiada sesi hari ini',
      'dash.weeklyOverview': 'Tinjauan Mingguan',

      // BUTTONS / COMMON
      'btn.save': 'Simpan',
      'btn.cancel': 'Batal',
      'btn.delete': 'Padam',
      'btn.edit': 'Edit',
      'btn.close': 'Tutup',
      'btn.confirm': 'Sahkan',
      'btn.done': 'Selesai',
      'btn.addSubject': 'Tambah Subjek',
      'btn.studyTip': 'Tip Belajar Rawak',

      // SIDEBAR
      'sidebar.views': 'Paparan',
      'sidebar.features': 'Ciri-ciri',
      'sidebar.tools': 'Alatan',
      'sidebar.academic': 'Bantuan Akademik',
      'sidebar.exam': 'Persediaan Peperiksaan',
      'sidebar.campus': 'Perkhidmatan Kampus',
      'sidebar.tips': 'Tip Belajar',
      'sidebar.status': 'Pembantu AI Dalam Talian',
      'sidebar.footer': 'Demo Bengkel AI IBM · 2025',

      // ERRORS
      'error.nameRequired': 'Nama subjek diperlukan.',
      'error.examDateRequired': 'Tarikh peperiksaan diperlukan.',
      'error.examDatePast': 'Tarikh peperiksaan mesti hari ini atau pada masa hadapan.',
      'error.hoursInvalid': 'Jam sehari mestilah antara 1 dan 8.',
      'error.noSubjects': 'Tambah sekurang-kurangnya satu subjek sebelum menjana rancangan.',
    },
  };

  function t(key, vars) {
    const str = (T[_lang] && T[_lang][key]) || T.en[key] || key;
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] !== undefined ? vars[k] : _;
    });
  }

  function setLang(lang) {
    _lang = lang === 'ms' ? 'ms' : 'en';
  }

  function getLang() {
    return _lang;
  }

  function applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var attr = el.getAttribute('data-i18n-attr');
      var val = t(key);
      if (attr) {
        el.setAttribute(attr, val);
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
  }

  return { t: t, setLang: setLang, getLang: getLang, applyAll: applyAll };
})();
