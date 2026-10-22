# 🎓 CampusBuddy AI 3.0 — Ultimate Student Companion

### *"Your Smart Campus, One Chat Away."*

A **stunning, fully responsive, AI-ready student support web application** built for the **IBM AI Workshop 2025**.  
No backend required to run. All features work out of the box in any modern browser.

---

## ✨ What's New in v3.0

| Module | Feature |
|---|---|
| 💬 **Smart Chatbot** | 26-topic FAQ knowledge base, bilingual EN/BM, intent scoring engine |
| 📅 **Study Planner** | Personalised weekly timetable generator with exam-date countdown |
| ⏱️ **Focus Timer** | Pomodoro technique with SVG ring, streaks, and history chart |
| 📊 **Dashboard** | Live stats pulled from planner + timer, weekly bar chart, motivation |
| 🤖 **AI Mode** | Secure backend bridge architecture — ready for watsonx.ai or OpenAI |
| 🌐 **i18n** | Full bilingual EN / BM via `window.I18n` translation module |
| 🌙 **Theme** | Dark / Light mode toggle with localStorage persistence |
| 🔒 **Security** | XSS protection, no API keys in frontend, HTTPS-only backend |

---

## 🗂️ Project Structure

```
CampusBuddy-AI/
├── index.html          # App shell — 4 views: Chat · Dashboard · Planner · Timer
├── style.css           # Design system (glassmorphism, tokens, animations, responsive)
├── i18n.js             # Bilingual translation module (window.I18n) — EN + BM
├── ai.js               # AI Mode module (window.AIMode) — FAQ fallback + backend bridge
├── planner.js          # Study Planner module (window.Planner)
├── timer.js            # Focus Timer module (window.Timer)
├── script.js           # Chatbot engine, view navigation, dashboard, event wiring
├── README.md           # This file
└── backend/
    └── worker.js       # Cloudflare Worker example (OpenAI + watsonx.ai, CORS, rate limit)
```

> **Script load order is critical:** `i18n.js` → `ai.js` → `planner.js` → `timer.js` → `script.js`

---

## 🚀 Quick Start (Local)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/CampusBuddy-AI.git
cd CampusBuddy-AI

# Open directly — no build step needed
# macOS/Linux:
open index.html
# Windows:
start index.html
# Or right-click index.html → "Open with" → your browser
```

> **Tip:** For the best experience (fonts, localStorage), serve via a local HTTP server:
> ```bash
> # Python 3
> python -m http.server 8080
> # Then open: http://localhost:8080
> ```

---

## 🌐 Deploy to GitHub Pages

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "feat: CampusBuddy AI v3.0 — Ultimate Student Companion"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/CampusBuddy-AI.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under *Source*, select **Deploy from a branch**
3. Choose **`main`** branch, **`/ (root)`** folder
4. Click **Save**

### Step 3 — Access your live site

Your site will be live at:
```
https://YOUR_USERNAME.github.io/CampusBuddy-AI/
```
It typically takes **1–2 minutes** to go live after the first push.

> All files use relative paths — zero configuration needed for GitHub Pages.

---

## 🤖 Chatbot — How It Works

The chatbot uses a **keyword + phrase scoring engine** (no external AI required):

1. **`normalise()`** — lowercases input, expands Malay contractions (`nak` → `ingin`, `camne` → `bagaimana`), strips punctuation
2. **`detectLang()`** — bidirectional scoring: counts EN signals vs MS signals with word-boundary matching
3. **`scoreFaq()`** — scores each KB topic: phrases match = +3 pts, keywords match = +1 pt
4. **`getResponse()`** — returns the highest-scoring topic's response, with language fallback

**26 FAQ topics** including: academic help, exam prep, GPA, registration, scholarship, mental health, library, financial aid, campus services, study tips, procrastination, hostel, transport, and more.

### Bilingual Support

Ask in English or Bahasa Melayu — detection is automatic:

| English | Bahasa Melayu |
|---|---|
| "How do I prepare for exams?" | "Macam mana nak buat persediaan peperiksaan?" |
| "What are good study techniques?" | "Apa teknik belajar yang bagus?" |
| "How do I manage stress?" | "Macam mana nak uruskan tekanan?" |

---

## 📅 Study Planner

1. Click **Study Planner** in the sidebar (or the feature card)
2. Click **Add Subject** → fill in name, exam date, difficulty, priority, and daily hours
3. Click **Generate Plan** — the algorithm distributes sessions across available days
4. Sessions appear in the **2-week calendar** — check them off as you complete them
5. Progress syncs to the **Dashboard** in real time

**Scheduling algorithm** priority factors: days until exam × difficulty × priority weight.

---

## ⏱️ Focus Timer

- **Focus / Short Break / Long Break** mode tabs
- **SVG countdown ring** with smooth animation
- **Auto-switch** after each session (every 4 focus → long break, else short break)
- **Day streak** tracking with localStorage persistence
- **7-day bar chart** of sessions completed
- **Custom durations** via the ⚙ panel (1–60 min each)
- Audio beep on session completion (Web Audio API — no external files)

---

## 📊 Dashboard

The dashboard aggregates live data from both localStorage keys:

| Section | Source |
|---|---|
| Today's Schedule | `cb_planner_v3` → sessions for today |
| Upcoming Exams | `cb_planner_v3` → subjects with future exam dates |
| Focus Summary | `cb_timer_v3` → sessionsToday, totalFocusMinutes, streak |
| Study Progress | `cb_planner_v3` → per-subject completion % |
| Weekly Overview | `cb_timer_v3` → history array (last 7 days) |
| Daily Motivation | Random quote from built-in motivations array |

---

## 🔮 Connecting a Real AI Backend

The frontend is already architected for a real AI engine. **API keys live on the server only.**

### Option A — Cloudflare Worker (recommended for GitHub Pages)

1. Copy `backend/worker.js` to a new Cloudflare Worker
2. Set environment variables `OPENAI_API_KEY` or `WATSONX_API_KEY` in the Worker dashboard
3. Copy your Worker URL (e.g. `https://my-worker.workers.dev`)
4. In the app sidebar → **AI Mode** panel → paste your URL → click **Connect**

The Worker supports both **OpenAI (gpt-4o-mini)** and **IBM watsonx.ai** — set `PROVIDER=openai` or `PROVIDER=watsonx` in the Worker env vars.

### Option B — Any HTTPS backend

Your endpoint must accept `POST` with JSON body:
```json
{
  "messages": [
    { "role": "user", "content": "How do I prepare for exams?" }
  ],
  "lang": "en"
}
```
And respond with:
```json
{ "text": "Here are some great exam preparation tips…" }
```

### Security rules

- ✅ API keys are **server-side only** — never in browser JS
- ✅ Endpoint must use **HTTPS** — the app rejects plain HTTP
- ✅ Backend should validate inputs and apply rate limiting
- ✅ `backend/worker.js` includes CORS handling and a 20 req/min rate limiter

---

## 🛡️ Chatbot Design Principles

| Principle | Implementation |
|---|---|
| No fabrication | Exam dates, schedules, and specific policies are never invented |
| Transparency | AI is presented as a helpful assistant, not authoritative advice |
| Graceful fallback | Unknown questions get helpful fallback + suggestion to check official channels |
| Privacy | No user data is sent anywhere — all state lives in `localStorage` |

---

## ♿ Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation throughout (Tab, Enter, Space, Escape)
- `aria-live` regions for chat messages and toasts
- `prefers-reduced-motion` respected — all CSS animations use `@media (prefers-reduced-motion)`
- Sufficient colour contrast in both dark and light themes

---

## 🗝️ localStorage Keys

| Key | Module | Contents |
|---|---|---|
| `campusBuddy_history` | script.js | Chat message history array |
| `campusBuddy_lang` | script.js | Language preference (`en` / `ms`) |
| `campusBuddy_theme` | script.js | Theme preference (`dark` / `light`) |
| `cb_planner_v3` | planner.js | Subjects, sessions, generated flag |
| `cb_timer_v3` | timer.js | Timer state, durations, streak, history |
| `cb_ai_endpoint` | ai.js | Backend HTTPS URL |
| `cb_ai_mode` | ai.js | Response mode (`faq` / `ai`) |

---

## 🧪 Manual Test Checklist

```
[ ] Dark/Light theme toggle persists across reload
[ ] Language toggle EN/BM changes UI text and chatbot responses
[ ] Typing in chat input enables the Send button
[ ] Enter sends message; Shift+Enter inserts newline
[ ] Chips / feature cards trigger correct FAQ responses
[ ] Clear Conversation resets chat and clears localStorage history
[ ] Save Conversation downloads a .txt file
[ ] Random Study Tip shows a new tip each click
[ ] Sidebar opens/closes correctly on mobile
[ ] Escape key closes open sidebar
[ ] Study Planner: add subject → generate plan → sessions appear in calendar
[ ] Study Planner: check session → progress bar updates
[ ] Focus Timer: Start → countdown runs → Pause/Resume → Reset
[ ] Focus Timer: complete a session → streak increments → bar chart updates
[ ] Dashboard: shows timer stats after completing a focus session
[ ] Dashboard: shows planner sessions after generating a plan
[ ] AI Mode panel: entering plain HTTP URL shows error
[ ] AI Mode panel: entering https:// URL saves correctly
```

---

## 🏆 Built For

**IBM AI Workshop 2025** — Demonstrating how AI-powered tools can meaningfully improve the university student experience through smart chat, personalised planning, and focus science.

---

## 📄 License

MIT — Free to use, modify, and distribute for educational purposes.
