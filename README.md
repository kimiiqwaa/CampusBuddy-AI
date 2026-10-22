# 🎓 CampusBuddy AI
### *Your Smart Campus, One Chat Away.*

A stunning, fully responsive student support chatbot web application built for the **IBM AI Workshop 2025**.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🤖 Smart Chatbot | Keyword-matched FAQ responses with realistic typing indicators |
| 🌐 Bilingual | Full English & Bahasa Melayu support |
| 🌙 Dark / Light Mode | Toggle with localStorage persistence |
| 📱 Responsive | Mobile, tablet, and desktop optimized |
| 💾 Chat History | Auto-saved to browser localStorage |
| ✨ Study Tip Generator | Rotating evidence-based study tips |
| 🎨 Premium UI | Glassmorphism, animated gradients, smooth transitions |
| ♿ Accessible | ARIA labels, keyboard navigation, reduced-motion support |

---

## 🚀 Quick Start (Local)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/campusbuddy-ai.git

# Navigate into the project
cd campusbuddy-ai

# Open in browser (no build step required!)
open index.html
# Or on Windows:
start index.html
```

---

## 🌐 Deploy to GitHub Pages

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit — CampusBuddy AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/campusbuddy-ai.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to your repository → **Settings** → **Pages**
   - Under *Source*, select **Deploy from a branch**
   - Choose **main** branch, **/ (root)** folder
   - Click **Save**

3. **Access your site**
   - Your site will be live at: `https://YOUR_USERNAME.github.io/campusbuddy-ai/`
   - It may take 1–2 minutes to go live after first deployment

---

## 📁 Project Structure

```
campusbuddy-ai/
├── index.html      # Main HTML layout & structure
├── style.css       # Design system, animations, responsive styles
├── script.js       # Chatbot logic, knowledge base, interactivity
└── README.md       # This file
```

---

## 🔮 Extending with a Real AI Backend

This prototype is designed to be extended. To connect to a real AI engine:

1. **Create a backend proxy** (Node.js, Python Flask, etc.) that holds your API keys securely
2. In `script.js`, replace the `getResponse()` function with an async `fetch()` call:

```js
async function getResponse(text) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, lang: currentLang })
  });
  const data = await res.json();
  return data.reply;
}
```

3. Your backend can connect to **IBM watsonx Assistant**, OpenAI, or any LLM provider
4. Keep API keys **server-side only** — never expose them in client JavaScript

---

## 🛡️ Chatbot Design Principles

- ✅ Responses are factual, general, and non-speculative
- ✅ Exam dates, specific policies, and live data are explicitly **not fabricated**
- ✅ Students are directed to official university channels for specific queries
- ✅ AI is presented as a helper tool, not a replacement for official advice

---

## 🏆 Built For

**IBM AI Workshop 2025** — Showcasing how AI-powered chatbots can meaningfully improve the university student experience.

---

## 📄 License

MIT — Free to use, modify, and distribute for educational purposes.
