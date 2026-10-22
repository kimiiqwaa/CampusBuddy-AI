/**
 * CampusBuddy AI — Cloudflare Worker Backend
 * ═══════════════════════════════════════════════════════════════
 *
 * PURPOSE
 * -------
 * This Worker acts as a secure proxy between the CampusBuddy AI
 * frontend (GitHub Pages) and an AI provider (e.g. IBM watsonx,
 * OpenAI, Anthropic, etc.).
 *
 * SECURITY MODEL
 * ──────────────
 * ✅ API keys are stored as Cloudflare Worker Secrets — NEVER
 *    in frontend JS, .env files committed to git, or localStorage.
 * ✅ CORS is restricted to the official GitHub Pages origin.
 * ✅ Request body size and message count are limited.
 * ✅ No sensitive user content is logged.
 *
 * DEPLOYMENT
 * ──────────
 * See README.md → "Backend Setup" for full instructions.
 *
 * ═══════════════════════════════════════════════════════════════
 * IMPORTANT: This file is an EXAMPLE TEMPLATE.
 * It will not work until you:
 *   1. Deploy it as a Cloudflare Worker (wrangler deploy)
 *   2. Add your AI provider API key as a Worker Secret
 *   3. Update ALLOWED_ORIGIN to match your GitHub Pages URL
 *   4. Choose and configure your AI provider section below
 * ═══════════════════════════════════════════════════════════════
 */

// ── Configuration ───────────────────────────────────────────────
const ALLOWED_ORIGIN   = 'https://kimiiqwaa.github.io';   // ← Update to your GitHub Pages URL
const MAX_BODY_BYTES   = 8_000;      // ~8 KB per request
const MAX_HISTORY_MSGS = 10;         // strip older context beyond this
const RATE_LIMIT_RPM   = 20;         // max requests per minute per IP (approximate)

// Simple in-memory rate limiter (resets when Worker instance restarts)
const rateMap = new Map();

function checkRateLimit(ip) {
  const now    = Date.now();
  const window = 60_000;
  const entry  = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > window) {
    rateMap.set(ip, { count: 1, start: now });
    return true;
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_RPM;
}

// ── CORS helpers ────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin'  : allowed ? ALLOWED_ORIGIN : 'null',
    'Access-Control-Allow-Methods' : 'POST, OPTIONS',
    'Access-Control-Allow-Headers' : 'Content-Type',
    'Access-Control-Max-Age'       : '86400',
    'Vary'                         : 'Origin',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Main handler ────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only allow POST to /api/chat
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }

    // Rate limit (use CF-Connecting-IP, fall back to generic key)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse({ error: 'Rate limit exceeded. Please wait a minute.' }, 429, origin);
    }

    // Body size guard
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Request too large.' }, 413, origin);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin);
    }

    // Validate structure
    const { messages, lang } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'messages must be a non-empty array.' }, 400, origin);
    }
    if (messages.length > MAX_HISTORY_MSGS + 2) {
      return jsonResponse({ error: 'Too many messages in context.' }, 400, origin);
    }
    for (const m of messages) {
      if (!m.role || !m.content || typeof m.content !== 'string') {
        return jsonResponse({ error: 'Each message must have role and content.' }, 400, origin);
      }
      if (!['user','assistant','system'].includes(m.role)) {
        return jsonResponse({ error: 'Invalid message role.' }, 400, origin);
      }
    }

    // Trim history to last N messages
    const trimmed = messages.slice(-MAX_HISTORY_MSGS);

    // ── Build system prompt ──────────────────────────────────────
    const langName = lang === 'ms' ? 'Bahasa Melayu' : 'English';
    const systemPrompt = [
      'You are CampusBuddy AI, a helpful and friendly student support assistant.',
      `Always respond in ${langName}.`,
      'You help university students with academics, exam preparation, campus services,',
      'study strategies, time management, and student wellbeing.',
      'Be concise, practical, and encouraging.',
      'Never invent specific university schedules, policies, or exam dates.',
      'If you are unsure, direct the student to their official university channels.',
    ].join(' ');

    // ── Call your AI provider ────────────────────────────────────
    // CHOOSE ONE of the providers below and uncomment it.
    // Store the API key as a Cloudflare Worker Secret (never hardcode it).

    // ─────────────────────────────────────────────────────────────
    // OPTION A: OpenAI / OpenAI-compatible API
    // Secret name: OPENAI_API_KEY
    // ─────────────────────────────────────────────────────────────
    try {
      const aiResponse = await callOpenAI(env, systemPrompt, trimmed);
      return jsonResponse({ text: aiResponse, source: 'ai' }, 200, origin);
    } catch (err) {
      // Do NOT log the full error — it may contain credential info
      console.error('[CampusBuddy] AI call failed:', err.message);
      return jsonResponse(
        { error: 'AI service temporarily unavailable. Please try again.' },
        502,
        origin
      );
    }

    // ─────────────────────────────────────────────────────────────
    // OPTION B: IBM watsonx.ai (Uncomment and fill in project ID)
    // Secrets: WATSONX_API_KEY, WATSONX_PROJECT_ID
    // ─────────────────────────────────────────────────────────────
    // try {
    //   const aiResponse = await callWatsonX(env, systemPrompt, trimmed);
    //   return jsonResponse({ text: aiResponse, source: 'ai' }, 200, origin);
    // } catch (err) {
    //   console.error('[CampusBuddy] watsonx call failed:', err.message);
    //   return jsonResponse({ error: 'AI service temporarily unavailable.' }, 502, origin);
    // }
  },
};

// ══════════════════════════════════════════════════════════════
//  PROVIDER IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Option A — OpenAI-compatible (OpenAI, Groq, Together.ai, etc.)
 *
 * Secrets needed:
 *   OPENAI_API_KEY   — your API key
 *   OPENAI_BASE_URL  — (optional) override base URL for compatible APIs
 *                      Default: https://api.openai.com/v1
 *
 * Deploy secrets:
 *   wrangler secret put OPENAI_API_KEY
 */
async function callOpenAI(env, systemPrompt, messages) {
  const baseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model   = env.OPENAI_MODEL    || 'gpt-4o-mini';

  const payload = {
    model,
    max_tokens: 800,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
}

/**
 * Option B — IBM watsonx.ai (granite / llama models)
 *
 * Secrets needed:
 *   WATSONX_API_KEY    — your IBM Cloud API key
 *   WATSONX_PROJECT_ID — your watsonx project ID
 *
 * Deploy secrets:
 *   wrangler secret put WATSONX_API_KEY
 *   wrangler secret put WATSONX_PROJECT_ID
 *
 * Note: watsonx uses a different auth flow (IAM token exchange).
 * The IAM token endpoint is:
 *   https://iam.cloud.ibm.com/identity/token
 */
async function callWatsonX(env, systemPrompt, messages) {
  // Step 1: Exchange API key for IAM bearer token
  const tokenRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(env.WATSONX_API_KEY)}`,
  });
  if (!tokenRes.ok) throw new Error(`IAM token exchange failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // Step 2: Format conversation as a single prompt string
  // (Granite and some Llama variants use text_generation, not chat)
  const conversationText = [
    `System: ${systemPrompt}`,
    ...messages.map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`),
    'Assistant:',
  ].join('\n\n');

  // Step 3: Call watsonx text generation
  const watsonxUrl = `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29`;
  const payload = {
    model_id  : env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2',
    project_id: env.WATSONX_PROJECT_ID,
    input     : conversationText,
    parameters: {
      decoding_method: 'greedy',
      max_new_tokens : 800,
      stop_sequences : ['\nHuman:', '\n\nHuman:'],
    },
  };

  const res = await fetch(watsonxUrl, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`watsonx HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.results?.[0]?.generated_text?.trim() || 'Sorry, I could not generate a response.';
}
