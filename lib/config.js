// Sunucu tarafı yapılandırma. Tüm değerler ortam değişkenlerinden okunur;
// bu dosya hiçbir zaman tarayıcıya gönderilmez.

export const VERSION = '2.0.0';

function toInt(value, fallback, min, max) {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getConfig(env = process.env) {
  return {
    apiKey: (env.OPENAI_API_KEY || '').trim(),
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
