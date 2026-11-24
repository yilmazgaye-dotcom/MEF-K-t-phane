// Sunucu tarafı yapılandırma. Tüm değerler ortam değişkenlerinden okunur;
// bu dosya hiçbir zaman tarayıcıya gönderilmez.

export const VERSION = '2.0.0';

function toInt(value, fallback, min, max) {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const MODES = new Set(['auto', 'ai', 'rules']);

export function getConfig(env = process.env) {
  const apiKey = (env.OPENAI_API_KEY || '').trim();
  const requested = (env.ASSISTANT_MODE || 'auto').trim().toLowerCase();
  const mode = MODES.has(requested) ? requested : 'auto';
  return {
    apiKey,
    // auto: anahtar varsa yapay zekâ, yoksa hazır yanıtlar. rules: her zaman hazır yanıtlar.
    // ai: her zaman yapay zekâ (anahtar yoksa "not_configured" hatası).
    mode,
    useAI: mode === 'ai' || (mode === 'auto' && Boolean(apiKey)),
    model: (env.OPENAI_MODEL || 'gpt-6.1-terra').trim(),
    // Boş bırakılırsa "reasoning" parametresi hiç gönderilmez (akıl yürütmeyen modeller için).
    reasoningEffort: (env.OPENAI_REASONING_EFFORT ?? 'low').trim(),
    maxOutputTokens: toInt(env.OPENAI_MAX_OUTPUT_TOKENS, 1500, 200, 8000),
    allowedOrigins: (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    rateLimitMax: toInt(env.RATE_LIMIT_MAX, 20, 1, 1000),
    rateLimitWindowMs: toInt(env.RATE_LIMIT_WINDOW_SECONDS, 300, 10, 86400) * 1000,
    crossrefMailto: (env.CROSSREF_MAILTO || '').trim(),
  };
}
