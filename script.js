/* ═══════════════════════════════════════════════════════════════
   CampusBuddy AI — Script
   IBM AI Workshop · 2025
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY   = 'campusBuddy_history';
const LANG_KEY      = 'campusBuddy_lang';
const THEME_KEY     = 'campusBuddy_theme';
const TYPING_DELAY  = 900;   // ms simulated thinking
const TYPING_RANGE  = 600;   // extra random ms

// ── State ──────────────────────────────────────────────────────
let currentLang    = localStorage.getItem(LANG_KEY)  || 'en';
let currentTheme   = localStorage.getItem(THEME_KEY) || 'dark';
let isTyping       = false;
let chatHistory    = [];

// ── DOM References ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const chatMessages    = $('chatMessages');
const chatInput       = $('chatInput');
const sendBtn         = $('sendBtn');
const clearChatBtn    = $('clearChatBtn');
const clearChatTopBtn = $('clearChatTopBtn');
const saveConvBtn     = $('saveConvBtn');
const studyTipBtn     = $('studyTipBtn');
const themeToggle     = $('themeToggle');
const sidebar         = $('sidebar');
const sidebarOpen     = $('sidebarOpen');
const sidebarClose    = $('sidebarClose');
const sidebarOverlay  = $('sidebarOverlay');
const toastEl         = $('toast');
const dynamicGreeting = $('dynamicGreeting');

// ══════════════════════════════════════════════════════════════
//  INTENT ENGINE — normalise + keyword bag matching
// ══════════════════════════════════════════════════════════════

/**
 * Normalise raw input for matching:
 *  - lowercase
 *  - strip punctuation
 *  - collapse whitespace
 *  - expand common Malay contractions / prefix-root forms
 */
function normalise(text) {
  let s = text.toLowerCase();

  // Expand common Malay colloquial contractions / particles
  const contractions = [
    [/\bnak\b/g,       'ingin'],        // nak → ingin (want to)
    [/\bnak\b/g,       'nak'],
    [/\bmacam mana\b/g,'bagaimana'],
    [/\bcamne\b/g,     'bagaimana'],
    [/\bcem mana\b/g,  'bagaimana'],
    [/\bkena\b/g,      'perlu'],        // kena → perlu (need to)
    [/\ble\b/g,        ''],
    [/\bla\b/g,        ''],
    [/\blah\b/g,       ''],
    [/\bnyer\b/g,      'nya'],
    [/\btgh\b/g,       'tengah'],
    [/\bsaya nak\b/g,  'saya ingin'],
    [/\bnk\b/g,        'ingin'],
    [/\bbuat\b/g,      'buat lakukan'], // duplicate tokens help matching
    [/\burus\b/g,      'urus uruskan pengurusan'],
    [/\bkelola\b/g,    'urus pengurusan'],
    [/\batur\b/g,      'atur susun pengurusan jadual'],
    [/\bmanage\b/g,    'manage urus pengurusan'],
    [/\bplanning\b/g,  'planning perancangan jadual'],
    [/\btimetable\b/g, 'timetable jadual waktu'],
    [/\bschedule\b/g,  'schedule jadual'],
    [/\bkokuriku\b/g,  'kokurikulum'],
    [/\bko-k\b/g,      'kokurikulum'],
    [/\bassign\b/g,    'assignment tugasan'],
    [/\bprocrastinat/g,'procrastinate tangguh lengah'],
    [/\btangguh-tangguh\b/g, 'tangguh'],
    [/\bbuang masa\b/g,'tangguh masa terbuang'],
    [/\bmotivat/g,     'motivate motivasi semangat'],
    [/\bsemangat\b/g,  'semangat motivasi'],
    [/\bwellbeing\b/g, 'wellbeing kesejahteraan mental'],
    [/\bkesihat/g,     'kesihatan health'],
    [/\btips?\b/g,     'tip'],
    [/\bcaranya\b/g,   'cara bagaimana'],
    [/\bbagaimana nak\b/g, 'bagaimana cara'],
    [/\bbagaimana cara\b/g,'cara'],
  ];

  for (const [pat, rep] of contractions) {
    s = s.replace(pat, rep);
  }

  // Strip punctuation (keep spaces and alphanumeric + Malay chars)
  s = s.replace(/[^\w\s]/g, ' ');

  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Detect likely language from raw input text.
 *
 * Algorithm:
 *  1. Use whole-word matching (word boundary via regex) to avoid false
 *     substring hits (e.g. "manage" must not score "nak").
 *  2. Count dedicated Malay signal words  → msScore
 *  3. Count dedicated English signal words → enScore
 *  4. Decision:
 *       msScore > enScore  AND msScore >= 2  → 'ms'
 *       enScore > msScore  AND enScore >= 2  → 'en'
 *       tied / uncertain                    → currentLang (user's toggle)
 *
 * NOTE: This function always operates on the RAW (un-normalised) input so
 * that normalise() expansions cannot corrupt the language signal.
 */
function detectLang(raw) {
  // ── Malay-exclusive signal words ──────────────────────────────────────
  // Only words that are clearly Malay and unlikely to appear in English text.
  // Deliberately excludes cognates / short ambiguous tokens like "cara","masa".
  const MALAY_SIGNALS = [
    'bagaimana','macam mana','camne','cem mana',
    'saya','kami','awak','kamu','anda',
    'nak','boleh','tidak','tak','hendak',
    'belajar','pelajar','universiti','peperiksaan',
    'tugasan','jadual','ulangkaji','ulang kaji',
    'tekanan','ujian','perpustakaan','biasiswa',
    'kursus','pendaftaran','kuliah','pensyarah','fakulti',
    'nota','laporan','esei','markah','pointer',
    'pengurusan','matlamat','konsentrasi','tangguh',
    'prokrastinat','semangat','cemerlang','bersedia',
    'terima kasih','tolong','bantu','harap','minta',
    'jumpa lagi','selamat tinggal','selamat pagi',
    'selamat petang','selamat malam',
    'bermotivasi','berkesan','berjaya','perlukan',
    // Additional unambiguous Malay words
    'assalamualaikum','waalaikumsalam','helo',
    'tanya','pasal','tentang','kepada','dengan',
    'untuk','daripada','dalam','antara','sebelum',
    'selepas','apakah','mengapa','adakah','jika',
    'apabila','supaya','kerana','walaupun',
    'daftar','mohon','hantar','semak',
  ];

  // ── English-exclusive signal words ────────────────────────────────────
  // Short, unambiguous English words that are never Malay.
  const ENGLISH_SIGNALS = [
    'how','what','when','where','why','which','who',
    'can','could','should','would','will','does','do',
    'give','help','need','want','find','make','tell',
    'the','this','that','these','those',
    'my','your','our','their','its',
    'some','any','few','more','most',
    'please','thanks','thank you',
    'study','exam','assignment','university',
    'schedule','manage','prepare','improve',
    'tips','advice','suggest','explain',
    'about','with','from','into','onto',
    'and','but','for','not','are','is','am','was','were',
  ];

  // Use word-boundary matching to avoid substring false-positives
  const lc = raw.toLowerCase();

  function countSignals(signals) {
    let hits = 0;
    for (const w of signals) {
      // Build a word-boundary regex; escape any regex metacharacters in the word
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('\\b' + escaped + '\\b').test(lc)) hits++;
    }
    return hits;
  }

  const msScore = countSignals(MALAY_SIGNALS);
  const enScore = countSignals(ENGLISH_SIGNALS);

  // Clear Malay dominance
  if (msScore > enScore && msScore >= 2) return 'ms';
  // Clear English dominance
  if (enScore > msScore && enScore >= 2) return 'en';
  // Tied with sufficient signal — Malay wins (BM signals are more distinctive)
  if (msScore >= 2 && msScore === enScore) return 'ms';
  // Single strong Malay signal with no English signals (e.g. "Assalamualaikum")
  if (msScore >= 1 && enScore === 0) return 'ms';
  // Uncertain / insufficient → honour the user's toggle preference
  return currentLang;
}

// ══════════════════════════════════════════════════════════════
//  KNOWLEDGE BASE
// ══════════════════════════════════════════════════════════════

const KB = {

  // ── Study Tips (sidebar generator) ───────────────────────
  studyTips: [
    "🍅 **Pomodoro Technique**: Study for 25 minutes, then take a 5-minute break. After 4 cycles, take a longer 20-minute break. This trains focus without burnout.",
    "🧠 **Active Recall**: Instead of re-reading, close your notes and try to write down everything you remember. It's proven to strengthen long-term memory.",
    "🗂️ **Spaced Repetition**: Review material at increasing intervals — 1 day later, then 3 days, then a week. Apps like Anki automate this.",
    "📝 **Cornell Note-Taking**: Divide your page into notes, cues, and a summary section. This structure makes revision faster and more effective.",
    "🤝 **Teach to Learn**: Explain a concept to a friend or even to yourself aloud. If you can teach it, you truly understand it.",
    "🎯 **Single-tasking**: Close social media, silence your phone, and work on one subject at a time. Multitasking reduces learning efficiency by up to 40%.",
    "💧 **Stay Hydrated**: Your brain is 75% water. Even mild dehydration reduces concentration. Keep a water bottle at your desk.",
    "😴 **Sleep is Non-Negotiable**: Memory consolidation happens during sleep. Studying until 4am before an exam is less effective than sleeping at midnight.",
    "🌿 **Study Environment**: A clean, well-lit, quiet space signals your brain to focus. Keep your study area reserved only for studying.",
    "📅 **Weekly Review**: Every Sunday, spend 20 minutes reviewing everything covered that week. This prevents the 'blank mind' feeling before exams.",
    "🎵 **Background Music**: Lo-fi, classical, or ambient music can boost focus for some students. Avoid music with lyrics when reading complex material.",
    "✍️ **Handwrite Key Concepts**: Writing by hand engages your brain more deeply than typing. Summarize complex concepts by hand for better retention.",
    "📊 **Mind Mapping**: Draw visual maps connecting ideas. Great for subjects with lots of interconnected concepts — law, biology, business.",
    "⏰ **Time-blocking**: Assign specific hours in your calendar for each subject. Treat study blocks like classes you cannot skip.",
    "🔁 **Review Before Sleep**: Spend 10 minutes reviewing key notes before bed. Your brain processes and consolidates them during sleep.",
  ],

  // ── Motivation Messages ───────────────────────────────────
  motivations: [
    "Every expert was once a beginner. Keep going! 💪",
    "Your hard work today is your success tomorrow. 🌟",
    "One step at a time — you're making progress! 🚀",
    "Believe in your ability to learn and grow. 🌱",
    "Consistency beats intensity. Show up every day! 🏆",
    "Difficulties in your studies are opportunities in disguise. 🔑",
    "You don't have to be perfect — you just have to keep moving. 🌊",
  ],

  // ══════════════════════════════════════════════════════════
  //  FAQ DATABASE
  //  Each entry:
  //    keywords : string[]  — individual tokens that score +1 when found
  //    phrases  : string[]  — exact sub-strings that score +3 (high signal)
  //    en / ms  : response strings
  // ══════════════════════════════════════════════════════════
  faqs: [

    // ─────────────────────────────────────────────────────────
    // 1. GREETINGS
    // ─────────────────────────────────────────────────────────
    {
      id: 'greet',
      keywords: ['hello','hi','hey','salam','assalamualaikum','hola','greetings','morning','afternoon','evening','hei','selamat'],
      phrases:  ['selamat pagi','selamat petang','selamat malam','good morning','good afternoon','good evening'],
      en: `👋 Hello! I'm **CampusBuddy AI**, your intelligent student assistant.\n\nI can help you with:\n- 🎓 **Academic questions** — courses, GPA, assignments\n- 📝 **Exam preparation** — study strategies & revision tips\n- 🏛️ **Campus services** — library, facilities, student support\n- 💡 **Study techniques** — productivity methods & motivation\n- ⏰ **Time management** — schedules, planning, focus\n\nWhat can I help you with today?`,
      ms: `👋 Halo! Saya **CampusBuddy AI**, pembantu pelajar pintar anda.\n\nSaya boleh membantu anda dengan:\n- 🎓 **Soalan akademik** — kursus, GPA, tugasan\n- 📝 **Persediaan peperiksaan** — strategi belajar & tip ulangkaji\n- 🏛️ **Perkhidmatan kampus** — perpustakaan, kemudahan, sokongan pelajar\n- 💡 **Teknik belajar** — kaedah produktiviti & motivasi\n- ⏰ **Pengurusan masa** — jadual, perancangan, tumpuan\n\nApa yang boleh saya bantu anda hari ini?`,
    },

    // ─────────────────────────────────────────────────────────
    // 2. TIME MANAGEMENT  ← PRIMARY FIX for "Bagaimana nak urus masa belajar?"
    // ─────────────────────────────────────────────────────────
    {
      id: 'time_management',
      keywords: [
        // English
        'time','manage','management','schedule','timetable','plan','planning',
        'organise','organize','priorit','deadline','procrastinat','efficient',
        'productive','productivity','balance','routine','daily','weekly','block',
        // Malay
        'masa','urus','uruskan','uruskan','pengurusan','jadual','waktu','atur',
        'susun','rancang','perancangan','kelola','kelolakan','prior','efisien',
        'produktif','produktiviti','rutin','harian','mingguan','bahagi',
        'buat jadual','jadual belajar','agih','tetapkan','fokus','lengah',
        'lengah',
      ],
      phrases: [
        'time management','manage time','manage my time','urus masa',
        'uruskan masa','pengurusan masa','jadual belajar','jadual waktu',
        'study schedule','study timetable','buat jadual','susun masa',
        'rancang masa','cara urus masa','bagaimana urus masa',
        'how to manage time','how to plan','cara belajar teratur',
        'agih masa belajar','bahagi masa',
      ],
      en: `⏰ **Time Management for Students**\n\nGood time management is one of the most powerful academic skills you can develop.\n\n**1. Prioritise with the Eisenhower Matrix**\nSort your tasks into 4 boxes:\n- **Urgent + Important** → Do it now\n- **Not Urgent + Important** → Schedule it\n- **Urgent + Not Important** → Delegate it\n- **Neither** → Eliminate it\n\n**2. Build a Weekly Study Timetable**\n- Block specific hours for each subject every week\n- Reserve mornings for your hardest subjects (peak focus time)\n- Include breaks, meals, exercise, and personal time\n\n**3. Use the Pomodoro Technique**\n- Study for **25 minutes**, then take a **5-minute break**\n- After 4 cycles, take a **20-minute long break**\n- This prevents mental fatigue and maintains concentration\n\n**4. Daily To-Do Lists**\n- Each morning, write your **top 3 must-do tasks**\n- Tick them off as you complete — this builds momentum\n- Don't carry more than 5–6 tasks per day\n\n**5. Eliminate Time Drains**\n- Set phone-free study zones (use apps like Forest or Focus@Will)\n- Batch similar tasks together (e.g., all readings before all writings)\n- Learn to say no to non-essential commitments\n\n💡 **Quick formula:** Plan weekly on Sunday → Review daily each morning → Reflect each night.`,
      ms: `⏰ **Pengurusan Masa untuk Pelajar**\n\nPengurusan masa yang baik adalah salah satu kemahiran akademik paling berkuasa yang boleh anda bangunkan.\n\n**1. Utamakan dengan Matriks Eisenhower**\nSusun tugas anda ke dalam 4 kotak:\n- **Mendesak + Penting** → Buat sekarang\n- **Tidak Mendesak + Penting** → Jadualkan\n- **Mendesak + Tidak Penting** → Wakilkan\n- **Tiada** → Buang\n\n**2. Bina Jadual Belajar Mingguan**\n- Blok masa tertentu untuk setiap subjek setiap minggu\n- Simpan waktu pagi untuk subjek paling susah (masa tumpuan puncak)\n- Sertakan rehat, makan, senaman, dan masa peribadi\n\n**3. Gunakan Teknik Pomodoro**\n- Belajar selama **25 minit**, kemudian rehat **5 minit**\n- Selepas 4 kitaran, rehat **20 minit** yang lebih panjang\n- Ini mencegah keletihan mental dan mengekalkan konsentrasi\n\n**4. Senarai Tugasan Harian**\n- Setiap pagi, tulis **3 tugasan utama** yang perlu diselesaikan\n- Tandakan apabila selesai — ini membina momentum\n- Jangan bawa lebih dari 5–6 tugasan sehari\n\n**5. Hapuskan Pembaziran Masa**\n- Tetapkan zon belajar tanpa telefon (guna aplikasi seperti Forest)\n- Kumpulkan tugas serupa (contoh: semua bacaan dahulu, kemudian semua penulisan)\n- Belajar berkata tidak kepada komitmen yang tidak penting\n\n💡 **Formula ringkas:** Rancang mingguan setiap Ahad → Semak harian setiap pagi → Refleksi setiap malam.`,
    },

    // ─────────────────────────────────────────────────────────
    // 3. PROCRASTINATION
    // ─────────────────────────────────────────────────────────
    {
      id: 'procrastination',
      keywords: [
        'procrastinat','delay','lazy','malas','tangguh','lengah','tertangguh',
        'lewat','lambat','last minute','last-minute','distract','distraction',
        'social media','phone','tiktok','scrolling','buang masa','waste time',
      ],
      phrases: [
        'stop procrastinating','overcome procrastination','how to stop being lazy',
        'keep procrastinating','i keep procrastinat','procrastinate how to',
        'cara atasi tangguh','cara nak belajar','tak boleh fokus',
        'susah nak mulakan','cannot start','hard to start','keep delaying',
        'suka tangguh kerja','masalah tangguh','prokrastinat',
      ],
      en: `🦥 **Overcoming Procrastination**\n\nProcrastination is the gap between intention and action — here's how to close it.\n\n**Why We Procrastinate:**\n- The task feels too big or overwhelming\n- Fear of failure or perfectionism\n- Immediate rewards (social media) feel better than delayed rewards (good grades)\n\n**Proven Strategies:**\n\n🚀 **The 2-Minute Rule** — If a task takes less than 2 minutes, do it immediately. Don't add it to your list.\n\n🔪 **Break It Down** — "Study for exams" is overwhelming. "Read chapter 3 pages 45–60" is actionable. Always break down big tasks.\n\n⏱️ **Commit to Just 5 Minutes** — Tell yourself you'll only work for 5 minutes. Getting started is the hardest part; you'll usually continue past 5 minutes.\n\n🌍 **Change Your Environment** — Move to a different room, a library, or a café. New environment = fresh mental state.\n\n📵 **Remove Temptations First** — Phone in another room, social media blockers on (Cold Turkey, Freedom). Don't rely on willpower alone.\n\n🎯 **Implementation Intentions** — Instead of "I'll study later," say: *"I will study Chapter 2 at 3pm in the library."* Specific plans get done.\n\n> 💡 Self-compassion matters: don't beat yourself up for procrastinating. Simply restart without guilt.`,
      ms: `🦥 **Mengatasi Sikap Tangguh-Tangguh (Prokrastinasi)**\n\nProkrastinasi adalah jurang antara niat dan tindakan — inilah cara menutupnya.\n\n**Mengapa Kita Bertangguh:**\n- Tugasan terasa terlalu besar atau menakutkan\n- Takut gagal atau terlalu mahu sempurna\n- Ganjaran segera (media sosial) terasa lebih baik daripada ganjaran tertunda (gred baik)\n\n**Strategi Terbukti:**\n\n🚀 **Peraturan 2 Minit** — Jika tugasan mengambil masa kurang dari 2 minit, buat segera. Jangan masukkan ke dalam senarai anda.\n\n🔪 **Pecahkan Tugasan** — "Belajar untuk peperiksaan" terlalu besar. "Baca bab 3 halaman 45–60" lebih mudah dilaksanakan. Sentiasa pecahkan tugasan besar.\n\n⏱️ **Komitmen Hanya 5 Minit** — Beritahu diri anda bahawa anda hanya akan bekerja selama 5 minit. Memulakan adalah bahagian yang paling susah; anda biasanya akan terus melepasi 5 minit.\n\n🌍 **Tukar Persekitaran** — Pindah ke bilik lain, perpustakaan, atau kafe. Persekitaran baru = keadaan mental segar.\n\n📵 **Buang Godaan Dahulu** — Telefon di bilik lain, penyekat media sosial dihidupkan. Jangan bergantung pada kehendak semata-mata.\n\n🎯 **Niat Pelaksanaan** — Daripada "Saya akan belajar nanti," katakan: *"Saya akan belajar Bab 2 pada pukul 3 petang di perpustakaan."* Rancangan spesifik lebih mudah dilaksanakan.\n\n> 💡 Belas kasihan diri penting: jangan marah diri sendiri kerana bertangguh. Mulakan semula tanpa rasa bersalah.`,
    },

    // ─────────────────────────────────────────────────────────
    // 4. STUDY MOTIVATION
    // ─────────────────────────────────────────────────────────
    {
      id: 'motivation',
      keywords: [
        'motivat','inspire','inspired','semangat','dorongan','boost','mood',
        'unmotivated','low motivation','no motivation','give up','quit',
        'malas belajar','tak semangat','hilang semangat','jemu','bosan belajar',
        'penat','tired of','burnt out','burnout','fed up',
      ],
      phrases: [
        'stay motivated','get motivated','how to be motivated','cara nak semangat',
        'cara dapatkan motivasi','hilang motivasi','no drive','lost motivation',
        'tak ada semangat','susah nak belajar','how to keep going',
        'feel like giving up','rasa nak berhenti',
      ],
      en: `🔥 **Finding & Keeping Study Motivation**\n\nMotivation fluctuates — the key is to build systems, not rely on feelings.\n\n**Reconnect with Your "Why"**\n- Write down *why* your degree matters to you personally\n- Visualise where you want to be in 3 years — what does success look like?\n- Put your goals somewhere visible (phone wallpaper, mirror, desk)\n\n**Build Momentum with Small Wins**\n- Start with the easiest task first to build confidence\n- Celebrate small completions — finishing a chapter counts!\n- Track progress visually (habit tracker apps, sticker charts)\n\n**Design a Motivating Environment**\n- Clean your study space — clutter drains energy\n- Use inspiring background playlists (lo-fi, study music on YouTube)\n- Study with friends who are also serious about their goals\n\n**Manage Energy, Not Just Time**\n- Identify your peak energy hours and schedule hard work then\n- Eat well, sleep 7–9 hours, and exercise regularly\n- Take proper breaks — a rested brain learns faster\n\n**When Everything Still Feels Hard:**\n- Talk to a counsellor — the university counselling centre is free\n- Read or watch stories of successful people who struggled too\n- Remember: feeling unmotivated is temporary; quitting is permanent\n\n> ✨ "Motivation gets you started. Habit keeps you going." — Jim Ryun`,
      ms: `🔥 **Mencari & Mengekalkan Motivasi Belajar**\n\nMotivasi naik turun — kuncinya adalah membina sistem, bukan bergantung pada perasaan.\n\n**Sambung Semula dengan 'Mengapa' Anda**\n- Tulis *mengapa* ijazah anda penting bagi anda secara peribadi\n- Bayangkan tempat yang anda ingin berada dalam 3 tahun — apakah kejayaan?\n- Letakkan matlamat anda di tempat yang nampak (wallpaper telefon, cermin, meja)\n\n**Bina Momentum dengan Kemenangan Kecil**\n- Mulakan dengan tugasan termudah dahulu untuk membina keyakinan\n- Raikan penyelesaian kecil — menyelesaikan satu bab itu dikira!\n- Jejak kemajuan secara visual (aplikasi penjejak tabiat, carta pelekat)\n\n**Reka Persekitaran yang Memotivasikan**\n- Bersihkan ruang belajar anda — kekacauan menguras tenaga\n- Gunakan senarai main latar belakang yang menginspirasi\n- Belajar dengan rakan-rakan yang juga serius dengan matlamat mereka\n\n**Urus Tenaga, Bukan Hanya Masa**\n- Kenal pasti waktu tenaga puncak anda dan jadualkan kerja keras ketika itu\n- Makan dengan baik, tidur 7–9 jam, dan bersenam secara teratur\n- Ambil rehat yang betul — otak yang berehat belajar lebih pantas\n\n**Bila Semuanya Masih Terasa Susah:**\n- Bercakap dengan kaunselor — pusat kaunseling universiti adalah percuma\n- Baca atau tonton kisah orang berjaya yang juga pernah berjuang\n- Ingat: rasa tidak bermotivasi adalah sementara; berhenti adalah kekal\n\n> ✨ "Motivasi memulakan anda. Tabiat yang mengekalkan anda." — Jim Ryun`,
    },

    // ─────────────────────────────────────────────────────────
    // 5. REVISION TECHNIQUES
    // ─────────────────────────────────────────────────────────
    {
      id: 'revision',
      keywords: [
        'revise','revision','ulangkaji','ulang kaji','review','recall','flashcard',
        'flash card','note','notes','nota','summarise','summarize','ringkasan',
        'spaced repetition','active recall','mind map','mind mapping','peta minda',
        'cornell','highlight','highlighter','past paper','soalan lama','soalan lepas',
      ],
      phrases: [
        'how to revise','revision tips','cara ulangkaji','cara buat nota',
        'study notes','best way to revise','how to take notes','effective revision',
        'ulangkaji berkesan','teknik ulangkaji','buat ringkasan',
        'cara hafal','cara ingat','how to memorise','how to remember',
      ],
      en: `📖 **Effective Revision Techniques**\n\nPassive re-reading is the least effective study method. Use these instead:\n\n**🧠 Active Recall (Most Powerful)**\nClose your notes and try to write down everything you know from memory. Check what you missed. Repeat. This is 2x more effective than re-reading.\n\n**🗂️ Spaced Repetition**\nReview material at increasing intervals:\n- After 1 day → 3 days → 1 week → 2 weeks\n- Apps: **Anki** (free), **Quizlet**\n\n**📝 Cornell Note System**\n- Right column: Main notes during lecture\n- Left column: Key questions / cues\n- Bottom section: Summary in your own words\n- Review by covering notes and answering cues from memory\n\n**🗺️ Mind Mapping**\n- Start with the main topic in the centre\n- Branch out to subtopics, then details\n- Great for visual learners and subjects with many connections\n\n**📄 Practice Past Papers**\n- The single best preparation for exams\n- Time yourself strictly\n- Mark your own answers against model answers\n\n**🔊 Teach Back Method**\n- Explain a concept aloud as if teaching someone else\n- Identifies gaps in understanding immediately\n\n> 🎯 Combine 2–3 techniques per subject for maximum retention.`,
      ms: `📖 **Teknik Ulangkaji yang Berkesan**\n\nMembaca semula secara pasif adalah kaedah belajar yang paling kurang berkesan. Gunakan teknik ini sebaliknya:\n\n**🧠 Ingatan Aktif (Paling Berkuasa)**\nTutup nota anda dan cuba tulis semua yang anda tahu dari ingatan. Semak apa yang terlepas. Ulang. Ini 2x lebih berkesan daripada membaca semula.\n\n**🗂️ Pengulangan Berjarak**\nUlangkaji bahan pada selang yang semakin meningkat:\n- Selepas 1 hari → 3 hari → 1 minggu → 2 minggu\n- Aplikasi: **Anki** (percuma), **Quizlet**\n\n**📝 Sistem Nota Cornell**\n- Kolum kanan: Nota utama semasa kuliah\n- Kolum kiri: Soalan / petanda utama\n- Bahagian bawah: Ringkasan dengan kata-kata anda sendiri\n- Ulangkaji dengan menutup nota dan menjawab petanda dari ingatan\n\n**🗺️ Peta Minda**\n- Mulakan dengan topik utama di tengah\n- Cabang ke subtopik, kemudian butiran\n- Sesuai untuk pelajar visual dan subjek dengan banyak perkaitan\n\n**📄 Latih Soalan Peperiksaan Lama**\n- Persediaan terbaik untuk peperiksaan\n- Tetapkan masa dengan ketat\n- Tandakan jawapan anda sendiri berbanding jawapan model\n\n**🔊 Kaedah Ajar Balik**\n- Terangkan konsep dengan kuat seolah-olah mengajar orang lain\n- Mengenal pasti jurang dalam pemahaman dengan serta-merta\n\n> 🎯 Gabungkan 2–3 teknik setiap subjek untuk ingatan maksimum.`,
    },

    // ─────────────────────────────────────────────────────────
    // 6. EXAM PREPARATION
    // ─────────────────────────────────────────────────────────
    {
      id: 'exam',
      keywords: [
        'exam','test','quiz','final','peperiksaan','ujian','kuiz','akhir',
        'mid','midterm','semester exam','prep','preparation','persediaan',
        'jawab','soalan','answer','question','format peperiksaan',
      ],
      phrases: [
        'exam tips','exam preparation','how to prepare for exam',
        'cara persediaan peperiksaan','tips peperiksaan','study for exam',
        'belajar untuk peperiksaan','persediaan ujian','sebelum peperiksaan',
        'hari peperiksaan','exam day','teknik menjawab',
      ],
      en: `📝 **Exam Preparation Guide**\n\nHere's a proven approach:\n\n**1. Start Early**\nBegin revising at least 2 weeks before exams. Last-minute cramming is far less effective.\n\n**2. Understand the Format**\nCheck with your lecturer or faculty office for exam format details (MCQ, essay, open-book, etc.).\n\n**3. Use Active Study Methods**\n- Practice past papers under timed conditions\n- Use flashcards for definitions and formulas\n- Form or join a study group\n\n**4. Manage Exam Day**\n- Sleep at least 7 hours the night before\n- Eat a proper meal and stay hydrated\n- Arrive early and read all questions before starting\n- Attempt all questions — never leave blanks\n\n> ⚠️ For specific exam dates and schedules, always check your official university portal or contact your faculty directly.`,
      ms: `📝 **Panduan Persediaan Peperiksaan**\n\nBerikut adalah pendekatan yang terbukti berkesan:\n\n**1. Mulakan Awal**\nMula mengulangkaji sekurang-kurangnya 2 minggu sebelum peperiksaan. Belajar secara tergesa-gesa jauh kurang berkesan.\n\n**2. Fahami Format Peperiksaan**\nSemak dengan pensyarah atau pejabat fakulti anda untuk maklumat format peperiksaan (MCQ, esei, buku terbuka, dll.).\n\n**3. Gunakan Kaedah Belajar Aktif**\n- Latih soalan peperiksaan lampau dalam masa yang ditetapkan\n- Gunakan kad imbas untuk definisi dan formula\n- Bentuk atau sertai kumpulan belajar\n\n**4. Uruskan Hari Peperiksaan**\n- Tidur sekurang-kurangnya 7 jam malam sebelum peperiksaan\n- Makan dengan betul dan kekal terhidrat\n- Tiba awal dan baca semua soalan sebelum menjawab\n- Cuba semua soalan — jangan tinggalkan jawapan kosong\n\n> ⚠️ Untuk tarikh dan jadual peperiksaan yang spesifik, sila semak portal rasmi universiti anda atau hubungi fakulti anda secara langsung.`,
    },

    // ─────────────────────────────────────────────────────────
    // 7. GPA / CGPA
    // ─────────────────────────────────────────────────────────
    {
      id: 'gpa',
      keywords: [
        'gpa','cgpa','grade','pointer','markah','result','keputusan',
        'improve gpa','naik gpa','tingkatkan gpa','dean','merit','fail',
        'repeat','ulang','retake','academic standing','probation',
      ],
      phrases: [
        'how to improve gpa','cara tingkatkan gpa','cara naik pointer',
        'gpa calculation','calculate gpa','how is gpa calculated',
        'what is cgpa','what is gpa','apakah cgpa','apakah gpa',
      ],
      en: `🎓 **Understanding Your GPA / CGPA**\n\nYour **CGPA (Cumulative Grade Point Average)** is the weighted average of all your course grades.\n\n**Typical Grade Scale (varies by university):**\n| Grade | Marks | Points |\n|-------|-------|--------|\n| A+/A  | 90–100 | 4.00 |\n| A-    | 85–89  | 3.70 |\n| B+    | 80–84  | 3.30 |\n| B     | 75–79  | 3.00 |\n| B-    | 70–74  | 2.70 |\n| C+    | 65–69  | 2.30 |\n| C     | 60–64  | 2.00 |\n| D     | 50–59  | 1.00 |\n| F     | Below 50 | 0.00 |\n\n**To improve your GPA:**\n- Focus on high-credit courses — they impact CGPA more\n- Attend every lecture and tutorial consistently\n- Submit all assignments on time (no zero marks)\n- Seek help from lecturers during office hours\n- Consider repeating failed subjects to replace the F grade\n\n> ⚠️ Always verify your university's exact grade scale via your student portal or academic handbook.`,
      ms: `🎓 **Memahami GPA / CGPA Anda**\n\n**CGPA (Purata Nilai Gred Kumulatif)** anda adalah purata berwajaran semua gred kursus anda.\n\n**Skala Gred Tipikal (berbeza mengikut universiti):**\n| Gred | Markah | Mata |\n|------|--------|------|\n| A+/A  | 90–100 | 4.00 |\n| A-    | 85–89  | 3.70 |\n| B+    | 80–84  | 3.30 |\n| B     | 75–79  | 3.00 |\n| B-    | 70–74  | 2.70 |\n| C+    | 65–69  | 2.30 |\n| C     | 60–64  | 2.00 |\n| D     | 50–59  | 1.00 |\n| F     | Di bawah 50 | 0.00 |\n\n**Untuk meningkatkan GPA anda:**\n- Tumpukan pada kursus berkredit tinggi — ia memberi kesan lebih kepada CGPA\n- Hadiri setiap kuliah dan tutorial secara konsisten\n- Serahkan semua tugasan tepat pada masanya (tiada markah sifar)\n- Dapatkan bantuan daripada pensyarah semasa waktu pejabat\n- Pertimbangkan untuk mengulang subjek yang gagal bagi menggantikan gred F\n\n> ⚠️ Sentiasa sahkan skala gred tepat universiti anda melalui portal pelajar atau buku panduan akademik anda.`,
    },

    // ─────────────────────────────────────────────────────────
    // 8. ASSIGNMENT PLANNING
    // ─────────────────────────────────────────────────────────
    {
      id: 'assignment',
      keywords: [
        'assignment','tugasan','essay','esei','report','laporan','project',
        'projek','citation','cite','rujukan','reference','plagiar',
        'submission','hantar','deadline','due date','tarikh hantar',
        'rubric','marking','pemarkahan','thesis','dissertation',
      ],
      phrases: [
        'how to write assignment','cara tulis tugasan','cara buat laporan',
        'assignment planning','plan my assignment','manage assignment',
        'avoid plagiarism','elak plagiarisme','citation style','gaya petikan',
        'how to cite','cara petik','how to reference',
      ],
      en: `📄 **Assignment Planning & Academic Integrity**\n\n**Planning Your Assignment:**\n1. **Read the brief carefully** — understand what is being asked\n2. **Break it into parts**: research → outline → draft → edit → submit\n3. **Work backwards from deadline**: if due Friday, aim to finish draft by Wednesday\n4. **Start with research** — gather sources before writing a single word\n\n**Writing Strong Assignments:**\n- Structure: Introduction → Body (arguments + evidence) → Conclusion\n- Use credible sources: peer-reviewed journals, official reports, textbooks\n- Follow the marking rubric — each criterion is a checklist\n- Proofread: grammar, spelling, flow, and references\n\n**Citation Styles:**\n- **APA 7th** — social sciences, psychology, education\n- **IEEE** — engineering, computer science\n- **Harvard** — business and management\n- **Chicago** — humanities\n\n**Avoiding Plagiarism:**\n- Always cite sources, even when paraphrasing\n- Use Turnitin, Grammarly, or free plagiarism checkers\n- Original ideas should dominate; sources should support them\n\n> ⚠️ Academic misconduct can result in serious penalties. When in doubt, cite it.`,
      ms: `📄 **Perancangan Tugasan & Integriti Akademik**\n\n**Merancang Tugasan Anda:**\n1. **Baca arahan dengan teliti** — fahami apa yang diminta\n2. **Pecahkan kepada bahagian**: penyelidikan → rangka → draf → edit → hantar\n3. **Kira mundur dari tarikh akhir**: jika perlu dihantar Jumaat, sasarkan untuk siapkan draf Rabu\n4. **Mulakan dengan penyelidikan** — kumpul sumber sebelum menulis sepatah pun\n\n**Menulis Tugasan yang Kuat:**\n- Struktur: Pengenalan → Isi kandungan (hujah + bukti) → Kesimpulan\n- Gunakan sumber yang boleh dipercayai: jurnal berwasit, laporan rasmi, buku teks\n- Ikuti rubrik pemarkahan — setiap kriteria adalah senarai semak\n- Semak semula: tatabahasa, ejaan, aliran, dan rujukan\n\n**Gaya Petikan:**\n- **APA 7th** — sains sosial, psikologi, pendidikan\n- **IEEE** — kejuruteraan, sains komputer\n- **Harvard** — perniagaan dan pengurusan\n- **Chicago** — kemanusiaan\n\n**Mengelakkan Plagiarisme:**\n- Sentiasa petik sumber, walaupun ketika memparafrasa\n- Gunakan Turnitin, Grammarly, atau alat pemeriksa plagiarisme percuma\n- Idea asal harus mendominasi; sumber harus menyokongnya\n\n> ⚠️ Salah laku akademik boleh mengakibatkan hukuman yang serius. Apabila ragu-ragu, petik.`,
    },

    // ─────────────────────────────────────────────────────────
    // 9. ACADEMIC STRESS & WELLBEING
    // ─────────────────────────────────────────────────────────
    {
      id: 'stress',
      keywords: [
        'stress','anxiety','overwhelm','mental','burnout','depress','worry',
        'tekanan','gelisah','penat','counsell','wellbeing','kesejahteraan',
        'mental health','kesihatan mental','cemas','takut','rasa takut',
        'panic','panik','overthink','overthinking','pressure','low mood',
        'feeling down','sedih','lonely','keseorangan','isolated',
      ],
      phrases: [
        'feeling stressed','academic stress','manage stress','how to cope',
        'cara atasi tekanan','tekanan akademik','cara hadapi tekanan',
        'mental health support','bantuan kesihatan mental',
        'feel overwhelmed','terlalu tertekan','rasa overwhelmed',
        'counselling centre','pusat kaunseling',
      ],
      en: `🧠 **Managing Academic Stress & Wellbeing**\n\nFeeling stressed is normal — what matters is how you respond.\n\n**Immediate Relief (5 minutes):**\n- **4-7-8 Breathing**: Inhale 4s → Hold 7s → Exhale 8s. Repeat 4 times.\n- Take a short walk outside — fresh air resets your nervous system\n- Drink water and step away from your screen for 5 minutes\n\n**Long-Term Strategies:**\n- Break large tasks into smaller, manageable steps\n- Maintain a consistent sleep schedule (7–9 hours)\n- Exercise 3× per week — even a 20-minute walk counts\n- Limit caffeine after 2pm\n- Practice gratitude: write 3 things you're grateful for each day\n- Keep a journal — writing down worries reduces their weight\n\n**Social Connection:**\n- Talk to friends, family, or a trusted mentor\n- Don't isolate — reach out even when it feels hard\n\n**Seek Professional Help:**\nIf stress or anxiety is significantly affecting your life, please reach out to your **University Counselling Centre**. Sessions are usually **free and confidential** for students.\n\n> 💙 You are not alone. Asking for help is a sign of strength, not weakness.`,
      ms: `🧠 **Mengatasi Tekanan Akademik & Kesejahteraan**\n\nMerasa tertekan adalah normal — yang penting adalah cara anda bertindak balas.\n\n**Bantuan Segera (5 minit):**\n- **Pernafasan 4-7-8**: Tarik nafas 4s → Tahan 7s → Lepaskan 8s. Ulang 4 kali.\n- Berjalan keluar sebentar — udara segar menetapkan semula sistem saraf anda\n- Minum air dan jauhkan diri dari skrin selama 5 minit\n\n**Strategi Jangka Panjang:**\n- Pecahkan tugas besar kepada langkah-langkah kecil yang boleh diurus\n- Kekalkan jadual tidur yang konsisten (7–9 jam)\n- Bersenam 3× seminggu — walaupun berjalan 20 minit dikira\n- Hadkan kafein selepas pukul 2 petang\n- Amalkan rasa syukur: tulis 3 perkara yang anda syukuri setiap hari\n- Simpan jurnal — menulis kebimbangan mengurangkan beratnya\n\n**Hubungan Sosial:**\n- Bercakap dengan rakan, keluarga, atau mentor yang dipercayai\n- Jangan mengasingkan diri — hubungi walaupun terasa susah\n\n**Dapatkan Bantuan Profesional:**\nJika tekanan atau kebimbangan memberi kesan ketara kepada kehidupan anda, sila hubungi **Pusat Kaunseling Universiti** anda. Sesi biasanya **percuma dan sulit** untuk pelajar.\n\n> 💙 Anda tidak bersendirian. Meminta bantuan adalah tanda kekuatan, bukan kelemahan.`,
    },

    // ─────────────────────────────────────────────────────────
    // 10. COURSE REGISTRATION
    // ─────────────────────────────────────────────────────────
    {
      id: 'registration',
      keywords: [
        'register','registration','course','daftar','pendaftaran','enroll',
        'add drop','add-drop','subject','semester','matric','matrikulasi',
        'prerequisite','prasyarat','timetable clash','clash waktu',
        'drop course','withdraw','tarik diri','tukar kursus',
      ],
      phrases: [
        'course registration','how to register','cara daftar kursus',
        'pendaftaran kursus','add drop period','tempoh tambah gugur',
        'how to add a course','how to drop a course','register for classes',
      ],
      en: `📋 **Course Registration Guide**\n\n**Steps:**\n1. Log in to your **Student Portal**\n2. Navigate to the **Academic / Registration** section\n3. Select courses based on your program requirements and prerequisites\n4. Confirm your timetable has no clashes\n5. Submit registration and save your confirmation\n\n**Tips:**\n- Register early — popular classes fill up fast\n- Check prerequisites before adding a course\n- Consult your academic advisor if unsure\n- The add/drop period usually lasts 1–2 weeks after semester starts\n- Maximum credit load per semester is typically 20–22 credits\n\n> ⚠️ Registration dates and procedures vary. Refer to your official academic calendar or contact the Registrar's Office.`,
      ms: `📋 **Panduan Pendaftaran Kursus**\n\n**Langkah-langkah:**\n1. Log masuk ke **Portal Pelajar** anda\n2. Navigasi ke bahagian **Akademik / Pendaftaran**\n3. Pilih kursus berdasarkan keperluan program dan prasyarat\n4. Sahkan jadual waktu tidak ada pertindihan\n5. Hantar pendaftaran dan simpan pengesahan anda\n\n**Petua:**\n- Daftar awal — kelas popular cepat penuh\n- Semak prasyarat sebelum menambah kursus\n- Berunding dengan penasihat akademik jika tidak pasti\n- Tempoh tambah/gugur biasanya berlangsung 1–2 minggu selepas semester bermula\n- Beban kredit maksimum setiap semester biasanya 20–22 kredit\n\n> ⚠️ Tarikh dan prosedur pendaftaran berbeza. Rujuk kalendar akademik rasmi atau hubungi Pejabat Pendaftar.`,
    },

    // ─────────────────────────────────────────────────────────
    // 11. LIBRARY SERVICES
    // ─────────────────────────────────────────────────────────
    {
      id: 'library',
      keywords: [
        'library','perpustakaan','book','buku','journal','resource','reading',
        'bilik bacaan','database','e-book','e-journal','borrow','pinjam',
        'librarian','pustakawan','study room','bilik belajar','database',
        'jstor','scopus','ieee','mendeley','zotero',
      ],
      phrases: [
        'library services','library hours','library location','perpustakaan universiti',
        'borrow a book','pinjam buku','online library','perpustakaan dalam talian',
        'how to use the library','cara guna perpustakaan',
      ],
      en: `📚 **University Library Services**\n\nYour library is one of the most powerful academic resources available to you.\n\n**Physical Services:**\n- Study rooms and quiet reading halls\n- Print, scan, and photocopy facilities\n- Reference and information desks\n- Group discussion rooms (usually bookable)\n\n**Digital Services:**\n- Online databases: JSTOR, Scopus, IEEE Xplore, EBSCOhost\n- E-books and e-journals (access with your student login)\n- Interlibrary loan requests for items not in your collection\n\n**How to Get the Most from Your Library:**\n- Use your student ID or library card to borrow books\n- Book a study room in advance during exam season\n- Ask a librarian for help — they're experts at finding academic sources\n- Use citation tools like Mendeley, Zotero (free) or EndNote\n\n> 📍 For exact location, opening hours, and procedures, check your library's official website or student portal.`,
      ms: `📚 **Perkhidmatan Perpustakaan Universiti**\n\nPerpustakaan anda adalah salah satu sumber akademik paling berkuasa yang tersedia untuk anda.\n\n**Perkhidmatan Fizikal:**\n- Bilik belajar dan dewan bacaan yang tenang\n- Kemudahan cetak, imbas, dan fotokopi\n- Meja rujukan dan maklumat\n- Bilik perbincangan berkumpulan (biasanya boleh ditempah)\n\n**Perkhidmatan Digital:**\n- Pangkalan data dalam talian: JSTOR, Scopus, IEEE Xplore, EBSCOhost\n- E-buku dan e-jurnal (akses dengan log masuk pelajar anda)\n- Permintaan pinjaman antara perpustakaan untuk item yang tidak ada dalam koleksi\n\n**Cara Memanfaatkan Perpustakaan Anda:**\n- Gunakan kad pelajar atau kad perpustakaan untuk meminjam buku\n- Tempah bilik belajar terlebih dahulu semasa musim peperiksaan\n- Minta bantuan pustakawan — mereka pakar mencari sumber akademik\n- Gunakan alat petikan seperti Mendeley, Zotero (percuma) atau EndNote\n\n> 📍 Untuk lokasi tepat, waktu operasi, dan prosedur, semak laman web rasmi perpustakaan atau portal pelajar anda.`,
    },

    // ─────────────────────────────────────────────────────────
    // 12. GROUP ASSIGNMENTS
    // ─────────────────────────────────────────────────────────
    {
      id: 'group_work',
      keywords: [
        'group','kumpulan','team','pasukan','group work','teamwork','kerja kumpulan',
        'group assignment','tugasan kumpulan','group project','projek kumpulan',
        'conflict','konflik','free rider','member','ahli','group member',
        'collaboration','kolaborasi','contribution','sumbangan',
      ],
      phrases: [
        'group assignment tips','cara buat kerja kumpulan','teamwork tips',
        'dealing with group conflict','menangani konflik kumpulan',
        'how to manage group work','manage group project','member not contributing',
        'ahli kumpulan tak buat kerja','free rider problem',
      ],
      en: `🤝 **Managing Group Assignments Successfully**\n\nGroup work builds real-world collaboration skills — but it needs structure.\n\n**Setting Up for Success:**\n1. **Assign roles early** — Leader, Secretary, Researcher, Editor, Presenter\n2. **Set a shared deadline** that is 2 days before the actual submission\n3. **Use collaboration tools** — Google Docs, Notion, Trello, WhatsApp Groups\n4. **Create a task list** with each person's name against their responsibility\n\n**Communication Tips:**\n- Hold regular short check-ins (15 min, twice a week)\n- Document decisions in writing so everyone is aligned\n- Address issues early — problems get worse if ignored\n\n**Dealing with Non-Contributing Members:**\n- Have a private, respectful conversation first\n- Inform your lecturer early if the problem persists\n- Document all contributions for assessment purposes\n\n**Presenting Together:**\n- Practice as a group at least once before the real presentation\n- Each member should be able to answer questions about all sections\n\n> 💡 Great teamwork is a skill employers value above almost everything else on your CV.`,
      ms: `🤝 **Mengurus Tugasan Kumpulan dengan Berjaya**\n\nKerja kumpulan membina kemahiran kolaborasi dunia nyata — tetapi ia memerlukan struktur.\n\n**Persediaan untuk Berjaya:**\n1. **Tetapkan peranan awal** — Ketua, Setiausaha, Penyelidik, Editor, Pembentang\n2. **Tetapkan tarikh akhir bersama** yang 2 hari sebelum penghantaran sebenar\n3. **Gunakan alat kolaborasi** — Google Docs, Notion, Trello, Kumpulan WhatsApp\n4. **Buat senarai tugas** dengan nama setiap orang berbanding tanggungjawab mereka\n\n**Tip Komunikasi:**\n- Adakan semakan pendek yang kerap (15 minit, dua kali seminggu)\n- Dokumentasikan keputusan secara bertulis supaya semua orang selaras\n- Tangani isu awal — masalah bertambah teruk jika diabaikan\n\n**Menangani Ahli yang Tidak Menyumbang:**\n- Adakan perbualan peribadi yang sopan dahulu\n- Maklumkan kepada pensyarah anda awal jika masalah berterusan\n- Dokumentasikan semua sumbangan untuk tujuan penilaian\n\n**Pembentangan Bersama:**\n- Berlatih sebagai kumpulan sekurang-kurangnya sekali sebelum pembentangan sebenar\n- Setiap ahli harus mampu menjawab soalan tentang semua bahagian\n\n> 💡 Kerja berpasukan yang baik adalah kemahiran yang dihargai majikan melebihi hampir segala-galanya dalam CV anda.`,
    },

    // ─────────────────────────────────────────────────────────
    // 13. ACADEMIC SUPPORT SERVICES
    // ─────────────────────────────────────────────────────────
    {
      id: 'academic_support',
      keywords: [
        'academic support','sokongan akademik','tutor','tutoring','mentor',
        'mentoring','writing centre','writing lab','pusat penulisan',
        'academic advisor','penasihat akademik','learning centre',
        'pusat pembelajaran','extra class','kelas tambahan','remedial',
        'academic help','bantuan akademik','appeal','rayuan','grade appeal',
      ],
      phrases: [
        'where to get academic help','how to get help with studies',
        'academic support services','tutoring services',
        'cara dapatkan sokongan akademik','perkhidmatan akademik',
        'cara buat rayuan gred','how to appeal my grade',
      ],
      en: `🎓 **Academic Support Services**\n\nYou don't have to struggle alone — universities offer extensive support.\n\n**On-Campus Academic Support:**\n- **Academic Advisors** — help with course selection, credit planning, graduation requirements\n- **Writing Centre / Writing Lab** — free one-on-one feedback on essays and reports\n- **Tutoring / Learning Centre** — subject-specific help, often run by senior students\n- **Lecturer Office Hours** — most lecturers hold open office hours weekly; use them!\n- **Peer Mentoring** — senior students assigned to guide juniors\n\n**Online Resources:**\n- **Khan Academy** — free foundational courses in maths, science, humanities\n- **Coursera / edX** — university-level courses (many free to audit)\n- **YouTube** — 3Blue1Brown (maths), CrashCourse (everything), Academind (tech)\n\n**Grade Appeals:**\n1. Review the marking scheme and your script carefully\n2. Request a meeting with your lecturer to discuss the grade\n3. If still unresolved, submit a formal appeal through your Faculty Office\n4. Know your university's appeal deadlines — typically within 2 weeks of results\n\n> 💡 Seeking help is a sign of smart strategy, not weakness. Top students use every available resource.`,
      ms: `🎓 **Perkhidmatan Sokongan Akademik**\n\nAnda tidak perlu berjuang bersendirian — universiti menawarkan sokongan yang meluas.\n\n**Sokongan Akademik di Kampus:**\n- **Penasihat Akademik** — membantu dengan pemilihan kursus, perancangan kredit, keperluan graduasi\n- **Pusat Penulisan** — maklum balas satu lawan satu percuma untuk esei dan laporan\n- **Pusat Tutoran / Pembelajaran** — bantuan khusus subjek, sering dijalankan oleh pelajar senior\n- **Waktu Pejabat Pensyarah** — kebanyakan pensyarah mengadakan waktu pejabat terbuka setiap minggu; gunakannya!\n- **Mentoring Rakan Sebaya** — pelajar senior yang ditugaskan untuk membimbing junior\n\n**Sumber Dalam Talian:**\n- **Khan Academy** — kursus asas percuma dalam matematik, sains, kemanusiaan\n- **Coursera / edX** — kursus peringkat universiti (banyak yang percuma untuk audit)\n- **YouTube** — 3Blue1Brown (matematik), CrashCourse (semua), Academind (teknologi)\n\n**Rayuan Gred:**\n1. Semak skema pemarkahan dan skrip anda dengan teliti\n2. Minta pertemuan dengan pensyarah anda untuk membincangkan gred\n3. Jika masih tidak selesai, hantar rayuan rasmi melalui Pejabat Fakulti anda\n4. Ketahui tarikh akhir rayuan universiti anda — biasanya dalam masa 2 minggu selepas keputusan\n\n> 💡 Meminta bantuan adalah tanda strategi yang bijak, bukan kelemahan. Pelajar terbaik menggunakan setiap sumber yang ada.`,
    },

    // ─────────────────────────────────────────────────────────
    // 14. CAMPUS FACILITIES
    // ─────────────────────────────────────────────────────────
    {
      id: 'campus_facilities',
      keywords: [
        'campus','facility','facilities','kemudahan','sport','sukan','gym',
        'wifi','internet','parking','parkir','mosque','masjid','surau',
        'prayer room','lab','laboratory','makmal','computer lab','lab komputer',
        'atm','bank','bus','transport','shuttle','kolej','college',
        'admin','office','pejabat','student centre','pusat pelajar',
      ],
      phrases: [
        'campus facilities','campus services','what facilities are available',
        'kemudahan kampus','perkhidmatan kampus','facilities on campus',
        'campus map','peta kampus','where is','di mana',
        'di kampus','ada di kampus','kemudahan di kampus',
      ],
      en: `🏛️ **Campus Facilities & Services**\n\nUniversity campuses are designed to support every aspect of student life.\n\n**Academic Facilities:**\n- Lecture halls and seminar rooms\n- Computer labs and maker spaces\n- Library (main + faculty-specific)\n- Research labs and studios\n\n**Student Life Facilities:**\n- Student Centre / Student Union building\n- Cafeteria, food courts, and convenience stores\n- Sports complex, gym, swimming pool\n- Mosque / Surau / Prayer rooms\n- ATM machines and banking kiosks\n\n**Transport & Connectivity:**\n- Campus shuttle bus services (check schedules at the main entrance)\n- Campus Wi-Fi (use your student login)\n- Car and motorcycle parking areas\n\n**Administrative Offices:**\n- Registrar's Office — academic records, graduation\n- Finance Office — fees, scholarships, refunds\n- Student Affairs / HEP — clubs, welfare, disciplinary matters\n- International Office — for international students\n\n> 📍 Use your university's official campus map (usually on the student portal or website) for exact locations.`,
      ms: `🏛️ **Kemudahan & Perkhidmatan Kampus**\n\nKampus universiti direka untuk menyokong setiap aspek kehidupan pelajar.\n\n**Kemudahan Akademik:**\n- Dewan kuliah dan bilik seminar\n- Makmal komputer dan ruang maker\n- Perpustakaan (utama + khusus fakulti)\n- Makmal penyelidikan dan studio\n\n**Kemudahan Kehidupan Pelajar:**\n- Pusat Pelajar / Bangunan Kesatuan Pelajar\n- Kafeteria, pusat makanan, dan kedai runcit\n- Kompleks sukan, gim, kolam renang\n- Masjid / Surau / Bilik Solat\n- Mesin ATM dan kiosk perbankan\n\n**Pengangkutan & Sambungan:**\n- Perkhidmatan bas ulang-alik kampus (semak jadual di pintu masuk utama)\n- Wi-Fi kampus (gunakan log masuk pelajar anda)\n- Kawasan parkir kereta dan motosikal\n\n**Pejabat Pentadbiran:**\n- Pejabat Pendaftar — rekod akademik, graduasi\n- Pejabat Kewangan — yuran, biasiswa, bayaran balik\n- Hal Ehwal Pelajar / HEP — kelab, kebajikan, hal tatatertib\n- Pejabat Antarabangsa — untuk pelajar antarabangsa\n\n> 📍 Gunakan peta kampus rasmi universiti anda (biasanya di portal pelajar atau laman web) untuk lokasi tepat.`,
    },

    // ─────────────────────────────────────────────────────────
    // 15. STUDENT WELLBEING
    // ─────────────────────────────────────────────────────────
    {
      id: 'wellbeing',
      keywords: [
        'wellbeing','well-being','kesejahteraan','self-care','jaga diri',
        'sleep','tidur','exercise','senaman','diet','makan','nutrition',
        'pemakanan','rest','rehat','balance','keseimbangan','healthy',
        'sihat','lifestyle','gaya hidup','social','friend','rakan',
        'relationship','hubungan','hobby','hobi','break','relax','relaksasi',
      ],
      phrases: [
        'student wellbeing','student health','take care of yourself',
        'jaga kesihatan','work life balance','keseimbangan kerja hidup',
        'self care tips','tip jaga diri','how to stay healthy as a student',
        'cara kekal sihat sebagai pelajar','healthy student life',
      ],
      en: `💚 **Student Wellbeing Guide**\n\nAcademic success and personal wellbeing are deeply connected — you can't pour from an empty cup.\n\n**Physical Wellbeing:**\n- **Sleep**: 7–9 hours minimum. Non-negotiable for memory and mood.\n- **Exercise**: 3× per week, 30 min each. Walking, swimming, gym, badminton — anything you enjoy.\n- **Nutrition**: Eat balanced meals. Limit ultra-processed food and excessive caffeine.\n- **Hydration**: Aim for 8 glasses of water per day.\n\n**Mental Wellbeing:**\n- Schedule regular "no study" time — hobbies, social activities, relaxation\n- Practice mindfulness or meditation (apps: Headspace, Calm, Insight Timer — free tiers available)\n- Limit doomscrolling and social media comparison\n- Journalling: 5 minutes writing helps process emotions\n\n**Social Wellbeing:**\n- Invest in a few close friendships over many shallow connections\n- Join a club or community around a shared interest\n- Call family regularly — it matters more than you think\n\n**When to Seek Help:**\nIf you feel persistently sad, anxious, or unable to function, contact your **University Counselling Centre** — it is free, confidential, and judgment-free.\n\n> 🌱 Progress on all fronts — academic, physical, mental, social — is what makes university life truly fulfilling.`,
      ms: `💚 **Panduan Kesejahteraan Pelajar**\n\nKejayaan akademik dan kesejahteraan peribadi sangat berkait rapat — anda tidak boleh menuang dari cawan yang kosong.\n\n**Kesejahteraan Fizikal:**\n- **Tidur**: Minimum 7–9 jam. Tidak boleh ditawar-tawar untuk ingatan dan mood.\n- **Senaman**: 3× seminggu, 30 minit setiap kali. Berjalan, berenang, gim, badminton — apa sahaja yang anda nikmati.\n- **Pemakanan**: Makan makanan seimbang. Hadkan makanan ultra-diproses dan kafein berlebihan.\n- **Hidrasi**: Sasarkan 8 gelas air sehari.\n\n**Kesejahteraan Mental:**\n- Jadualkan masa "bukan belajar" secara kerap — hobi, aktiviti sosial, relaksasi\n- Amalkan kesedaran atau meditasi (aplikasi: Headspace, Calm, Insight Timer — peringkat percuma tersedia)\n- Hadkan doomscrolling dan perbandingan media sosial\n- Jurnal: 5 minit menulis membantu memproses emosi\n\n**Kesejahteraan Sosial:**\n- Labur dalam beberapa persahabatan rapat berbanding banyak hubungan cetek\n- Sertai kelab atau komuniti sekitar minat bersama\n- Hubungi keluarga secara kerap — ia lebih penting daripada yang anda fikirkan\n\n**Bila Perlu Dapatkan Bantuan:**\nJika anda berasa sedih, cemas, atau tidak dapat berfungsi secara berterusan, hubungi **Pusat Kaunseling Universiti** anda — ia percuma, sulit, dan tanpa penghakiman.\n\n> 🌱 Kemajuan dalam semua aspek — akademik, fizikal, mental, sosial — itulah yang menjadikan kehidupan universiti benar-benar memuaskan.`,
    },

    // ─────────────────────────────────────────────────────────
    // 16. FINANCIAL AID / SCHOLARSHIPS
    // ─────────────────────────────────────────────────────────
    {
      id: 'financial',
      keywords: [
        'financial','scholarship','bursary','loan','ptptn','biasiswa',
        'bantuan kewangan','wang','duit','money','fee','yuran','bayar',
        'jpa','mara','zakat','hardship','kesusahan','elaun','allowance',
        'yayasan','khazanah','petronas','corporate','beca',
      ],
      phrases: [
        'financial aid','how to apply for scholarship','cara mohon biasiswa',
        'ptptn loan','pinjaman ptptn','scholarship application','permohonan biasiswa',
        'student financial support','bantuan kewangan pelajar',
      ],
      en: `💰 **Financial Aid & Scholarships**\n\n**Government Loans & Scholarships:**\n- **PTPTN** — National Higher Education Fund; apply at ptptn.gov.my\n- **JPA Scholarship** — Public Service Department; competitive, merit-based\n- **MARA Loan/Scholarship** — For Bumiputera students\n\n**University-Based Aid:**\n- Faculty-specific scholarships (check faculty noticeboard)\n- Dean's Merit Award for high academic achievers\n- Hardship Fund / Zakat Assistance (contact Student Affairs / HEP)\n\n**External Scholarships:**\n- Yayasan Khazanah, Telekom Malaysia, Petronas Education\n- Bank Negara, CIMB, Maybank, Yayasan Tenaga Nasional\n\n**How to Apply:**\n1. Visit your university's Financial Aid Office or HEP\n2. Prepare: transcripts, income proof, personal statement\n3. Apply before deadlines — add them to your calendar immediately\n\n> ⚠️ Eligibility and availability vary by university. Contact your financial aid office for the most current details.`,
      ms: `💰 **Bantuan Kewangan & Biasiswa**\n\n**Pinjaman & Biasiswa Kerajaan:**\n- **PTPTN** — Perbadanan Tabung Pendidikan Tinggi Nasional; mohon di ptptn.gov.my\n- **Biasiswa JPA** — Jabatan Perkhidmatan Awam; kompetitif, berasaskan merit\n- **Pinjaman/Biasiswa MARA** — Untuk pelajar Bumiputera\n\n**Bantuan Berasaskan Universiti:**\n- Biasiswa khusus fakulti (semak papan notis fakulti)\n- Anugerah Merit Dekan untuk pencapaian akademik tinggi\n- Dana Kesusahan / Bantuan Zakat (hubungi HEP)\n\n**Biasiswa Luar:**\n- Yayasan Khazanah, Telekom Malaysia, Pendidikan Petronas\n- Bank Negara, CIMB, Maybank, Yayasan Tenaga Nasional\n\n**Cara Mohon:**\n1. Lawati Pejabat Bantuan Kewangan atau HEP universiti anda\n2. Sediakan: transkrip, bukti pendapatan, pernyataan peribadi\n3. Mohon sebelum tarikh akhir — masukkan segera ke dalam kalendar anda\n\n> ⚠️ Kelayakan dan ketersediaan berbeza mengikut universiti. Hubungi pejabat bantuan kewangan anda untuk maklumat terkini.`,
    },

    // ─────────────────────────────────────────────────────────
    // 17. STUDY TIPS & PRODUCTIVITY
    // ─────────────────────────────────────────────────────────
    {
      id: 'study_tips',
      keywords: [
        'study tip','tip belajar','productive','produktif','pomodoro','cornell',
        'active recall','spaced repetition','pengulangan berjarak','ingatan aktif',
        'focus','fokus','concentration','konsentrasi','effective study',
        'belajar berkesan','cara belajar','teknik belajar','study technique',
        'habit','tabiat','routine','rutin belajar',
      ],
      phrases: [
        'study tips','how to study effectively','cara belajar dengan berkesan',
        'best study methods','kaedah belajar terbaik','study strategies',
        'strategi belajar','how to focus','cara untuk fokus',
        'study smarter','belajar lebih bijak',
      ],
      en: `💡 **Top Study Tips for University Students**\n\n🍅 **Pomodoro** — 25 min focused study + 5 min break. After 4 cycles, take a 20-min break.\n\n🧠 **Active Recall** — Close your notes and try to recall key points from memory. Far more effective than re-reading.\n\n🗂️ **Spaced Repetition** — Review material after 1 day, 3 days, 1 week, 2 weeks. Fights the forgetting curve.\n\n✍️ **Cornell Notes** — Main notes on right, key questions on left, summary at the bottom.\n\n🎯 **Single-tasking** — One subject at a time. Multitasking cuts productivity by up to 40%.\n\n📅 **Weekly Planning** — Every Sunday, plan your week: which topics to cover, what deadlines are approaching.\n\n🤝 **Study Groups** — Explain concepts to each other. Teaching is the deepest form of learning.\n\n🌿 **Environment** — Clean, quiet, dedicated study space. Your brain learns to focus in familiar spaces.\n\n💡 **Understand the 'Why'** — Understanding why something works is more memorable than facts alone.\n\n> Click ✨ **Random Study Tip** in the sidebar for a rotating daily tip!`,
      ms: `💡 **Tip Belajar Terbaik untuk Pelajar Universiti**\n\n🍅 **Pomodoro** — 25 minit belajar fokus + 5 minit rehat. Selepas 4 kitaran, rehat 20 minit.\n\n🧠 **Ingatan Aktif** — Tutup nota dan cuba ingat semula poin utama dari ingatan. Jauh lebih berkesan daripada membaca semula.\n\n🗂️ **Pengulangan Berjarak** — Ulangkaji selepas 1 hari, 3 hari, 1 minggu, 2 minggu. Lawan lengkung lupaan.\n\n✍️ **Nota Cornell** — Nota utama di kanan, soalan utama di kiri, ringkasan di bawah.\n\n🎯 **Tugasan Tunggal** — Satu subjek pada satu masa. Pelbagai tugasan mengurangkan produktiviti sehingga 40%.\n\n📅 **Perancangan Mingguan** — Setiap Ahad, rancang minggu: topik mana yang perlu diliputi, tarikh akhir apa yang hampir.\n\n🤝 **Kumpulan Belajar** — Terangkan konsep kepada satu sama lain. Mengajar adalah bentuk pembelajaran paling mendalam.\n\n🌿 **Persekitaran** — Ruang belajar yang bersih, tenang, dan khusus. Otak anda belajar fokus di tempat yang biasa.\n\n💡 **Fahami 'Mengapa'** — Memahami mengapa sesuatu berfungsi lebih mudah diingati berbanding fakta sahaja.\n\n> Klik ✨ **Tip Belajar Rawak** di bar sisi untuk tip harian bergilir!`,
    },

    // ─────────────────────────────────────────────────────────
    // 18. CLUBS & EXTRACURRICULAR
    // ─────────────────────────────────────────────────────────
    {
      id: 'clubs',
      keywords: [
        'club','society','kelab','persatuan','extracurricular','activity',
        'aktiviti','co-curriculum','kokurikulum','volunteer','sukarela',
        'sport','sukan','debate','debat','music','muzik','drama',
        'photography','fotografi','robotics','robotik',
      ],
      phrases: [
        'student clubs','join a club','how to join clubs','cara sertai kelab',
        'extracurricular activities','aktiviti kokurikulum',
        'co-curricular activities','how to find clubs',
      ],
      en: `🎭 **Student Clubs & Activities**\n\n**Why Join Clubs?**\n- Build soft skills: leadership, communication, teamwork\n- Expand your professional network\n- Add genuine value to your CV\n- Co-curricular activities are sometimes required for graduation\n\n**Types of Clubs (typical):**\n- Academic & Professional (debate, law, engineering, entrepreneurship)\n- Cultural & Language (Mandarin, Tamil, Arabic, international student societies)\n- Sports & Recreation (futsal, chess, badminton, e-sports)\n- Arts & Media (photography, film, music, drama)\n- Community Service (volunteering, Red Crescent, environment)\n\n**How to Join:**\n1. Visit the Student Affairs Department or student portal\n2. Attend the Clubs Fair at the start of each semester\n3. Contact the club committee directly via social media\n\n> Tip: 2–3 clubs with genuine involvement is better than 10 passive memberships.`,
      ms: `🎭 **Kelab & Aktiviti Pelajar**\n\n**Mengapa Sertai Kelab?**\n- Bina kemahiran insaniah: kepimpinan, komunikasi, kerja berpasukan\n- Kembangkan rangkaian profesional anda\n- Tambah nilai tulen kepada CV anda\n- Aktiviti kokurikulum kadang-kala diperlukan untuk graduasi\n\n**Jenis Kelab (tipikal):**\n- Akademik & Profesional (debat, undang-undang, kejuruteraan, keusahawanan)\n- Budaya & Bahasa (Mandarin, Tamil, Arab, persatuan pelajar antarabangsa)\n- Sukan & Rekreasi (futsal, catur, badminton, e-sukan)\n- Seni & Media (fotografi, filem, muzik, drama)\n- Perkhidmatan Komuniti (sukarela, Bulan Sabit Merah, alam sekitar)\n\n**Cara Menyertai:**\n1. Lawati Jabatan Hal Ehwal Pelajar atau portal pelajar\n2. Hadiri Pesta Kelab pada awal setiap semester\n3. Hubungi jawatankuasa kelab secara langsung melalui media sosial\n\n> Petua: 2–3 kelab dengan penglibatan tulen lebih baik daripada 10 keahlian pasif.`,
    },

    // ─────────────────────────────────────────────────────────
    // 19. INTERNSHIP / CAREER
    // ─────────────────────────────────────────────────────────
    {
      id: 'career',
      keywords: [
        'intern','internship','latihan industri','career','kerjaya','job',
        'pekerjaan','cv','resume','interview','temuduga','hire','employ',
        'company','syarikat','placement','practical training','practicum',
        'linkedin','network','networking','fresh graduate','graduan',
      ],
      phrases: [
        'internship tips','how to find internship','cara cari latihan industri',
        'career advice','cv tips','tips resume','interview tips',
        'tips temuduga','job after graduation','kerja selepas graduasi',
      ],
      en: `💼 **Internships & Career Development**\n\n**Finding Internships:**\n- University Career Centre / Industrial Training Unit\n- Job portals: JobStreet, LinkedIn, Indeed, Hiredly, MauKerja\n- Direct applications on company websites\n- Career fairs on campus\n\n**CV Tips:**\n- 1–2 pages maximum for students\n- Lead with skills, GPA (if 3.5+), and key projects\n- Use action verbs: *developed, led, analysed, improved, delivered*\n- Tailor your CV for every application\n\n**Interview Preparation:**\n- Research the company thoroughly before the interview\n- Use the **STAR method** (Situation, Task, Action, Result) for behavioural questions\n- Dress professionally for virtual and in-person interviews\n- Send a thank-you email within 24 hours\n\n**Building Your Professional Profile:**\n- Keep your LinkedIn updated from Year 1\n- Showcase projects, not just job titles\n- Request LinkedIn recommendations from lecturers and supervisors\n\n> 🎯 Visit your university's Career Centre for mock interviews, CV clinics, and internship listings.`,
      ms: `💼 **Latihan Industri & Pembangunan Kerjaya**\n\n**Mencari Latihan Industri:**\n- Pusat Kerjaya / Unit Latihan Industri universiti\n- Portal kerja: JobStreet, LinkedIn, Indeed, Hiredly, MauKerja\n- Permohonan terus di laman web syarikat\n- Pesta kerjaya di kampus\n\n**Petua CV:**\n- Maksimum 1–2 muka surat untuk pelajar\n- Ketengahkan kemahiran, GPA (jika 3.5+), dan projek utama\n- Gunakan kata kerja tindakan: *membangunkan, memimpin, menganalisis, memperbaiki, menyampaikan*\n- Sesuaikan CV anda untuk setiap permohonan\n\n**Persediaan Temuduga:**\n- Kaji syarikat dengan teliti sebelum temuduga\n- Gunakan kaedah **STAR** (Situasi, Tugas, Tindakan, Keputusan) untuk soalan tingkah laku\n- Berpakaian profesional untuk temuduga maya dan bersemuka\n- Hantar e-mel terima kasih dalam masa 24 jam\n\n**Membina Profil Profesional:**\n- Pastikan LinkedIn anda dikemas kini dari Tahun 1\n- Tunjukkan projek, bukan sekadar jawatan\n- Minta cadangan LinkedIn daripada pensyarah dan penyelia\n\n> 🎯 Lawati Pusat Kerjaya universiti anda untuk temuduga mock, klinik CV, dan senarai latihan industri.`,
    },

    // ─────────────────────────────────────────────────────────
    // 20. IBM / AI / TECHNOLOGY
    // ─────────────────────────────────────────────────────────
    {
      id: 'ibm_ai',
      keywords: [
        'ibm','watson','watsonx','artificial intelligence','machine learning',
        'llm','chatgpt','deep learning','data science','teknologi','ai model',
        'neural network','nlp','natural language','generative ai',
        'ai tools','alat ai','coding','programming','python','javascript',
      ],
      phrases: [
        'what is ibm','ibm watsonx','ibm skillsbuild','ai in education',
        'how does ai work','how does chatbot work',
        'bagaimana ai berfungsi','bagaimana chatbot berfungsi',
      ],
      en: `🤖 **AI & Technology in Education**\n\n**IBM's Contribution to AI:**\n- **IBM watsonx** — Enterprise AI platform for building and deploying AI models\n- **IBM Watson** — AI services for language, vision, and data analysis\n- **IBM SkillsBuild** — Free courses in AI, cloud, cybersecurity, data science (skillsbuild.org)\n\n**AI Tools for Students:**\n- **Productivity:** Notion AI, Microsoft Copilot, Google Gemini\n- **Writing:** Grammarly, QuillBot\n- **Research:** Elicit, Consensus, Semantic Scholar\n- **Coding:** GitHub Copilot, Replit AI\n- **Study aids:** Anki (spaced repetition), Quizlet (flashcards)\n\n**Responsible AI Use:**\n- AI tools should *assist* your learning, not replace it\n- Always verify AI-generated information with trusted sources\n- Understand your university's academic integrity policy on AI\n\n> 🏆 This demo is built for the IBM AI Workshop to showcase how AI-powered assistants can improve campus life.`,
      ms: `🤖 **AI & Teknologi dalam Pendidikan**\n\n**Sumbangan IBM kepada AI:**\n- **IBM watsonx** — Platform AI perusahaan untuk membina dan menggunakan model AI\n- **IBM Watson** — Perkhidmatan AI untuk bahasa, penglihatan, dan analisis data\n- **IBM SkillsBuild** — Kursus percuma dalam AI, awan, keselamatan siber, sains data (skillsbuild.org)\n\n**Alat AI untuk Pelajar:**\n- **Produktiviti:** Notion AI, Microsoft Copilot, Google Gemini\n- **Penulisan:** Grammarly, QuillBot\n- **Penyelidikan:** Elicit, Consensus, Semantic Scholar\n- **Pengekodan:** GitHub Copilot, Replit AI\n- **Bantuan belajar:** Anki (pengulangan berjarak), Quizlet (kad imbas)\n\n**Penggunaan AI yang Bertanggungjawab:**\n- Alat AI harus *membantu* pembelajaran anda, bukan menggantikannya\n- Sentiasa sahkan maklumat yang dijana AI dengan sumber yang dipercayai\n- Fahami dasar integriti akademik universiti anda mengenai AI\n\n> 🏆 Demo ini dibina untuk IBM AI Workshop untuk menunjukkan bagaimana pembantu berkuasa AI boleh meningkatkan kehidupan kampus.`,
    },

    // ─────────────────────────────────────────────────────────
    // 21. ACCOMMODATION / HOSTEL
    // ─────────────────────────────────────────────────────────
    {
      id: 'hostel',
      keywords: [
        'hostel','accommodation','penginapan','dormitory','asrama','room',
        'bilik','residential','kediaman','kolej kediaman','off-campus',
        'luar kampus','rent','sewa','landlord','tuan rumah','housemate',
        'roommate','rakan bilik',
      ],
      phrases: [
        'student accommodation','hostel application','mohon hostel',
        'on-campus housing','off-campus housing','where to stay near university',
        'penginapan berdekatan universiti',
      ],
      en: `🏠 **Student Accommodation**\n\n**On-Campus (Hostel/Residential College):**\n- Usually more affordable and convenient\n- Close to lectures, library, and facilities\n- May have curfews, visitation rules, and shared facilities\n- Often prioritised for first-year students\n\n**Off-Campus:**\n- More independence and flexibility\n- Check proximity to public transport and campus\n- Ask seniors for trusted landlord recommendations\n\n**Tips:**\n- Apply for hostel placement early (usually before semester starts)\n- Read the hostel agreement carefully before signing\n- Understand the rules for guests, noise, and common areas\n\n> 📍 For current hostel availability, fees, and applications, contact your Residential Services or Student Housing Office directly.`,
      ms: `🏠 **Penginapan Pelajar**\n\n**Dalam Kampus (Hostel/Kolej Kediaman):**\n- Biasanya lebih mampu milik dan mudah\n- Dekat dengan kuliah, perpustakaan, dan kemudahan\n- Mungkin ada waktu malam, peraturan lawatan, dan kemudahan dikongsi\n- Sering diberi keutamaan kepada pelajar tahun pertama\n\n**Luar Kampus:**\n- Lebih berdikari dan fleksibel\n- Semak kedekatan dengan pengangkutan awam dan kampus\n- Minta cadangan tuan tanah yang dipercayai daripada senior\n\n**Petua:**\n- Mohon penempatan hostel awal (biasanya sebelum semester bermula)\n- Baca perjanjian hostel dengan teliti sebelum menandatangani\n- Fahami peraturan untuk tetamu, bunyi bising, dan kawasan biasa\n\n> 📍 Untuk ketersediaan hostel, yuran, dan permohonan semasa, hubungi Perkhidmatan Kediaman atau Pejabat Perumahan Pelajar anda secara langsung.`,
    },

    // ─────────────────────────────────────────────────────────
    // 22. FOOD / CAFETERIA
    // ─────────────────────────────────────────────────────────
    {
      id: 'food',
      keywords: [
        'cafe','cafeteria','food','makan','kantin','canteen','restaurant',
        'kedai','meal','makanan','lapar','hungry','lunch','breakfast',
        'dinner','makan tengah hari','sarapan','makan malam','budget food',
        'makanan murah','cheap food',
      ],
      phrases: [
        'where to eat','food on campus','campus cafeteria','kantin universiti',
        'makan di kampus','cheap food near campus','makanan murah berdekatan kampus',
      ],
      en: `🍽️ **Campus Food & Dining**\n\n**Typical Campus Food Options:**\n- **Cafeteria / Canteen** — most affordable, variety of stalls\n- **Food Courts** — wider variety, slightly higher prices\n- **Convenience Stores** — snacks, drinks, instant meals\n- **Café / Bistro** — premium options, good for study breaks\n\n**Budget Eating Tips:**\n- Eat during off-peak hours (before 12pm or after 1:30pm)\n- Pack your own lunch or snacks to save money\n- Look for student meal promotions\n- Carry a reusable water bottle (most campuses have free dispensers)\n\n> 📍 For specific locations, menus, and operating hours, check your university's student portal or campus map.`,
      ms: `🍽️ **Makanan & Penjagaan Kampus**\n\n**Pilihan Makanan Kampus Tipikal:**\n- **Kafeteria / Kantin** — paling berpatutan, pelbagai gerai\n- **Pusat Makanan** — lebih pelbagai, harga sedikit lebih tinggi\n- **Kedai Runcit** — makanan ringan, minuman, makanan segera\n- **Kafe / Bistro** — pilihan premium, sesuai untuk rehat belajar\n\n**Petua Makan Berjimat:**\n- Makan semasa waktu bukan puncak (sebelum pukul 12 atau selepas 1:30 petang)\n- Bawa makan tengah hari atau makanan ringan sendiri untuk jimat wang\n- Cari promosi makan pelajar\n- Bawa botol air boleh guna semula (kebanyakan kampus ada pam percuma)\n\n> 📍 Untuk lokasi, menu, dan waktu operasi yang spesifik, semak portal pelajar atau peta kampus universiti anda.`,
    },

    // ─────────────────────────────────────────────────────────
    // 23. HEALTH / CLINIC
    // ─────────────────────────────────────────────────────────
    {
      id: 'health',
      keywords: [
        'health','clinic','hospital','sick','sakit','ubat','medicine',
        'medical','doktor','doctor','dental','gigi','demam','fever',
        'flu','injury','cedera','emergency','kecemasan','first aid',
        'pertolongan cemas','insurance','insurans','mc','medical cert',
      ],
      phrases: [
        'campus clinic','campus health','where is the clinic','di mana klinik',
        'student health centre','pusat kesihatan pelajar',
        'how to get mc','cara dapat mc','sick leave','cuti sakit',
      ],
      en: `🏥 **Campus Health Services**\n\n**On-Campus Services:**\n- **Student Health Centre** — primary care for common illnesses\n- **Panel Clinics** — nearby clinics; your student card may cover costs\n- **Dental Services** — some universities offer subsidised dental care\n- **Counselling Centre** — mental health support (separate from health centre)\n\n**When to Go Where:**\n- Common illness (fever, flu, stomach pain) → Student Health Centre\n- Emergency → Nearest public hospital A&E\n- Mental health → Counselling Centre\n\n**Getting a Medical Certificate (MC):**\n- Visit the campus clinic or a panel clinic\n- Bring your student ID\n- Submit MC to your faculty's admin office promptly\n\n**Health Insurance:**\n- Many universities include basic medical insurance in student fees\n- Keep your student ID handy for subsidised treatment\n\n> 📍 Find your campus health centre via your student portal or university website.`,
      ms: `🏥 **Perkhidmatan Kesihatan Kampus**\n\n**Perkhidmatan di Kampus:**\n- **Pusat Kesihatan Pelajar** — penjagaan primer untuk penyakit biasa\n- **Klinik Panel** — klinik berdekatan; kad pelajar anda mungkin menanggung kos\n- **Perkhidmatan Pergigian** — sesetengah universiti menawarkan rawatan gigi bersubsidi\n- **Pusat Kaunseling** — sokongan kesihatan mental (berasingan dari pusat kesihatan)\n\n**Bila Pergi ke Mana:**\n- Penyakit biasa (demam, selesema, sakit perut) → Pusat Kesihatan Pelajar\n- Kecemasan → A&E hospital awam terdekat\n- Kesihatan mental → Pusat Kaunseling\n\n**Mendapatkan Sijil Cuti Sakit (MC):**\n- Pergi ke klinik kampus atau klinik panel\n- Bawa kad pelajar anda\n- Serahkan MC ke pejabat pentadbiran fakulti anda dengan segera\n\n**Insurans Kesihatan:**\n- Banyak universiti menyertakan insurans perubatan asas dalam yuran pelajar\n- Simpan kad pelajar anda untuk rawatan bersubsidi\n\n> 📍 Cari pusat kesihatan kampus anda melalui portal pelajar atau laman web universiti.`,
    },

    // ─────────────────────────────────────────────────────────
    // 24. ABOUT CAMPUSBUDDY
    // ─────────────────────────────────────────────────────────
    {
      id: 'about',
      keywords: [
        'campusbuddy','about','siapa','who','what are you','apa','how do you work',
        'bagaimana kamu','cara kamu berfungsi','what can you do',
        'apa boleh kamu buat','prototype','demo',
      ],
      phrases: [
        'what is campusbuddy','who are you','about campusbuddy',
        'siapa kamu','apa ini','how does this work',
        'bagaimana ini berfungsi',
      ],
      en: `🤖 **About CampusBuddy AI**\n\nI'm **CampusBuddy AI**, an intelligent student support assistant built for university students.\n\n**What I can help with:**\n- Academic questions (GPA, courses, registration)\n- Exam preparation and revision techniques\n- Time management and productivity\n- Overcoming procrastination and staying motivated\n- Campus services (library, health, financial aid)\n- Student wellbeing and mental health\n- Internships, career development, and CV tips\n- Bilingual support — **English & Bahasa Melayu**\n\n**How I work:**\nI use a structured knowledge base with smart keyword and phrase matching. I detect whether your question is in English or Bahasa Melayu and respond accordingly. I'm designed so a real AI engine (like IBM watsonx) can be connected via a secure backend.\n\n**What I can't do:**\n- Access your personal academic records\n- Provide real-time data (live schedules, current deadlines)\n- Replace official advice from lecturers or admin staff\n\n> 💡 Always verify important decisions with your university's official channels.`,
      ms: `🤖 **Tentang CampusBuddy AI**\n\nSaya **CampusBuddy AI**, pembantu sokongan pelajar pintar yang dibina untuk pelajar universiti.\n\n**Apa yang boleh saya bantu:**\n- Soalan akademik (GPA, kursus, pendaftaran)\n- Persediaan peperiksaan dan teknik ulangkaji\n- Pengurusan masa dan produktiviti\n- Mengatasi prokrastinasi dan kekal bermotivasi\n- Perkhidmatan kampus (perpustakaan, kesihatan, bantuan kewangan)\n- Kesejahteraan pelajar dan kesihatan mental\n- Latihan industri, pembangunan kerjaya, dan tip CV\n- Sokongan dwibahasa — **Bahasa Inggeris & Bahasa Melayu**\n\n**Bagaimana saya berfungsi:**\nSaya menggunakan pangkalan pengetahuan berstruktur dengan padanan kata kunci dan frasa yang bijak. Saya mengesan sama ada soalan anda dalam Bahasa Inggeris atau Bahasa Melayu dan bertindak balas mengikutnya. Saya direka supaya enjin AI sebenar (seperti IBM watsonx) boleh disambungkan melalui backend selamat.\n\n**Apa yang tidak boleh saya lakukan:**\n- Akses rekod akademik peribadi anda\n- Menyediakan data masa nyata (jadual langsung, tarikh akhir semasa)\n- Menggantikan nasihat rasmi daripada pensyarah atau kakitangan pentadbiran\n\n> 💡 Sentiasa sahkan keputusan penting dengan saluran rasmi universiti anda.`,
    },

    // ─────────────────────────────────────────────────────────
    // 25. THANK YOU
    // ─────────────────────────────────────────────────────────
    {
      id: 'thanks',
      keywords: [
        'thank','terima kasih','thanks','tq','appreciate','bagus','good',
        'great','awesome','helpful','berguna','membantu','best','mantap',
        'syabas','tahniah','hebat','ok','okay','understood','faham',
      ],
      phrases: ['thank you','terima kasih','thanks a lot','sangat membantu'],
      en: `😊 You're very welcome! I'm glad I could help.\n\nFeel free to ask me anything else about your campus journey. I'm always here! 🌟`,
      ms: `😊 Sama-sama! Saya gembira dapat membantu.\n\nJangan segan untuk tanya saya apa-apa lagi tentang perjalanan kampus anda. Saya sentiasa di sini! 🌟`,
    },

    // ─────────────────────────────────────────────────────────
    // 26. GOODBYE
    // ─────────────────────────────────────────────────────────
    {
      id: 'bye',
      keywords: [
        'bye','goodbye','selamat tinggal','jumpa lagi','adios','chao',
        'see you','until next','later','oklah','ok bye','k bye',
      ],
      phrases: ['goodbye','bye bye','see you later','selamat tinggal','jumpa lagi'],
      en: `👋 Goodbye! Best of luck with your studies.\n\n*"The beautiful thing about learning is that nobody can take it away from you."* — B.B. King\n\nCome back anytime! 🌟`,
      ms: `👋 Selamat tinggal! Semoga berjaya dalam pelajaran anda.\n\n*"Perkara indah tentang pembelajaran ialah tiada siapa yang boleh mengambilnya daripada anda."* — B.B. King\n\nKembali bila-bila masa! 🌟`,
    },
  ],

  // ── Improved Fallbacks ─────────────────────────────────────
  fallbacks: {
    en: [
      `🤔 I didn't quite catch that. Could you rephrase or be more specific?\n\n**Here are topics I'm great at:**\n- ⏰ Time management & study schedules\n- 📝 Exam preparation & revision techniques\n- 🧠 Overcoming procrastination & motivation\n- 🎓 GPA, courses & academic support\n- 🏛️ Library, campus facilities & services\n- 💰 Financial aid & scholarships\n- 💚 Student wellbeing & stress management\n- 💼 Internships & career tips\n\n**Try asking:** *"How do I manage my study time?"* or *"Give me exam tips"*`,
      `💭 I'm not sure I have a good answer for that specific question yet.\n\n**You might try asking about:**\n- Study strategies and revision techniques\n- Time management and beating procrastination\n- Assignment planning and group work\n- Campus services (library, health, financial aid)\n- Motivation and student wellbeing\n\nOr click one of the suggestion chips above to get started!`,
      `🔍 That's a topic I'm still learning about!\n\n**I'm best at questions like:**\n- *"Bagaimana nak urus masa belajar?"* (Time management)\n- *"How do I prepare for exams?"*\n- *"What study techniques actually work?"*\n- *"How do I stop procrastinating?"*\n- *"What campus services are available?"*\n\nTry rephrasing your question with keywords from the topics above!`,
    ],
    ms: [
      `🤔 Saya tidak dapat tangkap soalan itu dengan tepat. Boleh anda cuba frasa semula atau lebih spesifik?\n\n**Berikut topik yang saya mahir:**\n- ⏰ Pengurusan masa & jadual belajar\n- 📝 Persediaan peperiksaan & teknik ulangkaji\n- 🧠 Atasi prokrastinasi & motivasi\n- 🎓 GPA, kursus & sokongan akademik\n- 🏛️ Perpustakaan, kemudahan & perkhidmatan kampus\n- 💰 Bantuan kewangan & biasiswa\n- 💚 Kesejahteraan pelajar & pengurusan tekanan\n- 💼 Latihan industri & tip kerjaya\n\n**Cuba tanya:** *"Bagaimana nak urus masa belajar?"* atau *"Berikan saya tip peperiksaan"*`,
      `💭 Saya tidak pasti saya mempunyai jawapan yang baik untuk soalan spesifik itu.\n\n**Cuba tanya tentang:**\n- Strategi belajar dan teknik ulangkaji\n- Pengurusan masa dan mengatasi sikap tangguh\n- Perancangan tugasan dan kerja kumpulan\n- Perkhidmatan kampus (perpustakaan, kesihatan, bantuan kewangan)\n- Motivasi dan kesejahteraan pelajar\n\nAtau klik salah satu cip cadangan di atas untuk memulakan!`,
      `🔍 Topik itu masih saya pelajari!\n\n**Saya paling mahir untuk soalan seperti:**\n- *"Bagaimana nak urus masa belajar?"*\n- *"Bagaimana cara persediaan peperiksaan?"*\n- *"Teknik belajar yang berkesan?"*\n- *"Cara atasi sikap tangguh-tangguh?"*\n- *"Perkhidmatan apa yang ada di kampus?"*\n\nCuba frasa semula soalan anda dengan kata kunci dari topik di atas!`,
    ],
  },
};

// ══════════════════════════════════════════════════════════════
//  CATEGORY PROMPTS (for feature cards / nav clicks)
// ══════════════════════════════════════════════════════════════

const CATEGORY_PROMPTS = {
  academic: 'What academic services and help are available to students?',
  exam:     'How do I prepare for my exams effectively?',
  campus:   'What campus facilities and services are available to students?',
  tips:     'What are the most effective study techniques and tips?',
};

// ══════════════════════════════════════════════════════════════
//  RESPONSE MATCHING ENGINE
// ══════════════════════════════════════════════════════════════

/**
 * Score a single FAQ entry against normalised input.
 * Scoring:
 *   - Each matching phrase  → +3 points
 *   - Each matching keyword → +1 point
 * Returns the numeric score.
 */
function scoreFaq(faq, normInput) {
  let score = 0;

  // Phrase matches (high signal)
  for (const phrase of (faq.phrases || [])) {
    if (normInput.includes(phrase.toLowerCase())) {
      score += 3;
    }
  }

  // Keyword matches
  for (const kw of (faq.keywords || [])) {
    if (normInput.includes(kw.toLowerCase())) {
      score += 1;
    }
  }

  return score;
}

/**
 * Main response function.
 * 1. Normalise input
 * 2. Auto-detect language
 * 3. Score all FAQs
 * 4. Return best match (score ≥ 1), else return fallback
 */
function getResponse(rawText) {
  const norm = normalise(rawText);
  const lang = detectLang(rawText);   // detect before normalising strips particles

  let bestScore = 0;
  let bestFaq   = null;

  for (const faq of KB.faqs) {
    const score = scoreFaq(faq, norm);
    if (score > bestScore) {
      bestScore = score;
      bestFaq   = faq;
    }
  }

  if (bestFaq && bestScore >= 1) {
    return bestFaq[lang] || bestFaq.en;
  }

  // Fallback
  const fallbackArr = KB.fallbacks[lang] || KB.fallbacks.en;
  return fallbackArr[Math.floor(Math.random() * fallbackArr.length)];
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════

function init() {
  applyTheme(currentTheme);
  applyLang(currentLang);
  setGreeting();
  loadHistory();
  setupEventListeners();
  showMotivationBanner();
}

// ── Greeting ───────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const greetings = {
    en: h < 12 ? 'Good morning! 👋' : h < 17 ? 'Good afternoon! 👋' : 'Good evening! 👋',
    ms: h < 12 ? 'Selamat pagi! 👋'  : h < 17 ? 'Selamat petang! 👋'  : 'Selamat malam! 👋',
  };
  dynamicGreeting.textContent = greetings[currentLang];
}

// ── Theme ──────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

// ── Language ───────────────────────────────────────────────────
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });
  chatInput.placeholder = lang === 'ms'
    ? 'Tanya saya apa-apa tentang kehidupan kampus…'
    : 'Ask me anything about campus life…';
  document.querySelector('.input-hint').innerHTML = lang === 'ms'
    ? 'Tekan <kbd>Enter</kbd> untuk hantar · <kbd>Shift+Enter</kbd> untuk baris baru · Sokongan dwibahasa: EN / BM'
    : 'Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line · Bilingual support: EN / BM';
  setGreeting();
}

// ── Motivation Banner ──────────────────────────────────────────
function showMotivationBanner() {
  const mot = KB.motivations[Math.floor(Math.random() * KB.motivations.length)];
  const existing = document.querySelector('.motivation-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'motivation-banner';
  banner.innerHTML = `✨ <strong>Daily Motivation:</strong> ${mot}`;
  const featureCards = document.querySelector('.feature-cards');
  featureCards.parentNode.insertBefore(banner, featureCards);
}

// ══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════════

function setupEventListeners() {

  sendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
    sendBtn.disabled = chatInput.value.trim().length === 0;
  });

  themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
  });

  sidebarOpen.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item[data-category]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        n.removeAttribute('aria-current');
      });
      item.classList.add('active');
      item.setAttribute('aria-current', 'true');
      const prompt = CATEGORY_PROMPTS[item.dataset.category];
      if (prompt) insertAndSend(prompt);
      if (window.innerWidth <= 900) closeSidebar();
    });
  });

  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = CATEGORY_PROMPTS[card.dataset.category];
      if (prompt) insertAndSend(prompt);
      chatMessages.scrollIntoView({ behavior: 'smooth' });
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => insertAndSend(chip.dataset.prompt));
  });

  clearChatBtn.addEventListener('click', clearChat);
  clearChatTopBtn.addEventListener('click', clearChat);
  saveConvBtn.addEventListener('click', saveConversation);
  studyTipBtn.addEventListener('click', showRandomStudyTip);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });
}

// ── Sidebar ────────────────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  sidebarOpen.setAttribute('aria-expanded', 'true');
  sidebar.focus();
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  sidebarOpen.setAttribute('aria-expanded', 'false');
}

// ── Insert prompt and send ─────────────────────────────────────
function insertAndSend(text) {
  chatInput.value = text;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
  sendBtn.disabled = false;
  handleSend();
}

// ══════════════════════════════════════════════════════════════
//  CHAT LOGIC
// ══════════════════════════════════════════════════════════════

function handleSend() {
  const text = chatInput.value.trim();
  if (!text || isTyping) return;

  appendMessage('user', text);
  saveToHistory('user', text);

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  showTypingIndicator();

  const delay = TYPING_DELAY + Math.random() * TYPING_RANGE;
  setTimeout(() => {
    removeTypingIndicator();
    const reply = getResponse(text);
    appendMessage('ai', reply);
    saveToHistory('ai', reply);
    isTyping = false;
  }, delay);

  isTyping = true;
}

// ── Render message ─────────────────────────────────────────────
function appendMessage(role, text) {
  const empty = chatMessages.querySelector('.empty-state');
  if (empty) empty.remove();

  const isAI = role === 'ai';
  const time  = formatTime(new Date());

  const msg = document.createElement('div');
  msg.className = `message ${role}`;

  const avatarHTML = isAI
    ? `<div class="avatar ai-avatar" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="avG2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs><path d="M8 10h16M8 16h10M8 22h13" stroke="url(#avG2)" stroke-width="2.2" stroke-linecap="round"/><circle cx="25" cy="22" r="4" fill="url(#avG2)"/><circle cx="25" cy="22" r="2" fill="#fff"/></svg></div>`
    : `<div class="avatar user-avatar" aria-hidden="true">You</div>`;

  const copyBtn = isAI
    ? `<button class="copy-btn" aria-label="Copy message" title="Copy response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>`
    : '';

  msg.innerHTML = `
    ${avatarHTML}
    <div class="msg-body">
      <div class="bubble">${renderMarkdown(text)}</div>
      <div class="msg-meta">
        <span>${time}</span>
        ${copyBtn}
      </div>
    </div>`;

  if (isAI) {
    const btn = msg.querySelector('.copy-btn');
    if (btn) btn.addEventListener('click', () => copyText(text, btn));
  }

  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Minimal markdown renderer ──────────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const isSep = row.replace(/[\s\-|]/g, '').length === 0;
      if (isSep) return '';
      const cells = row.split('|').map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/gs, match => `<table>${match}</table>`)
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}

// ── Typing indicator ───────────────────────────────────────────
function showTypingIndicator() {
  const empty = chatMessages.querySelector('.empty-state');
  if (empty) empty.remove();

  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.id = 'typingIndicator';
  typing.setAttribute('aria-label', 'CampusBuddy is typing');
  typing.innerHTML = `
    <div class="avatar ai-avatar" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
        <defs><linearGradient id="tGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/>
        </linearGradient></defs>
        <path d="M8 10h16M8 16h10M8 22h13" stroke="url(#tGrad)" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="25" cy="22" r="4" fill="url(#tGrad)"/><circle cx="25" cy="22" r="2" fill="#fff"/>
      </svg>
    </div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ── Copy text ──────────────────────────────────────────────────
function copyText(text, btn) {
  const plain = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^> /gm, '');
  navigator.clipboard.writeText(plain).then(() => {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
}

// ── Clear chat ─────────────────────────────────────────────────
function clearChat() {
  chatMessages.innerHTML = '';
  chatHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  renderEmptyState();
  showToast(currentLang === 'ms' ? 'Perbualan dikosongkan.' : 'Conversation cleared.');
}

function renderEmptyState() {
  const msg = currentLang === 'ms'
    ? { h: 'Mula perbualan!', p: 'Taip soalan anda di bawah atau klik cadangan di atas.' }
    : { h: 'Start a conversation!', p: 'Type your question below or click a suggestion above.' };
  chatMessages.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">💬</div>
      <h3>${msg.h}</h3>
      <p>${msg.p}</p>
    </div>`;
}

// ── Save conversation ──────────────────────────────────────────
function saveConversation() {
  if (chatHistory.length === 0) {
    showToast(currentLang === 'ms' ? 'Tiada perbualan untuk disimpan.' : 'No conversation to save.');
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
  showToast(currentLang === 'ms' ? '💾 Perbualan disimpan!' : '💾 Conversation saved!');
}

// ── Load history ───────────────────────────────────────────────
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      chatHistory = JSON.parse(saved);
      if (chatHistory.length > 0) {
        chatHistory.forEach(m => appendMessage(m.role, m.text));
        return;
      }
    } catch { chatHistory = []; }
  }
  renderEmptyState();
}

// ── Persist message ────────────────────────────────────────────
function saveToHistory(role, text) {
  chatHistory.push({ role, text, ts: new Date().toISOString() });
  if (chatHistory.length > 100) chatHistory.shift();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
}

// ── Random study tip ───────────────────────────────────────────
function showRandomStudyTip() {
  const tip = KB.studyTips[Math.floor(Math.random() * KB.studyTips.length)];
  const intro = currentLang === 'ms'
    ? '✨ **Tip Belajar Rawak untuk Anda:**\n\n'
    : '✨ **Here\'s a random study tip for you:**\n\n';
  const full = intro + tip;
  appendMessage('ai', full);
  saveToHistory('ai', full);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatMessages.scrollIntoView({ behavior: 'smooth' });
  if (window.innerWidth <= 900) closeSidebar();
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(message, duration = 2800) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  setTimeout(() => toastEl.classList.remove('visible'), duration);
}

// ── Format time ────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString(currentLang === 'ms' ? 'ms-MY' : 'en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Kick off ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
