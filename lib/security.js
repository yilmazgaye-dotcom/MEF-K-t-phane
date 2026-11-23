// İstek doğrulama, kaynak (Origin) kontrolü ve basit hız sınırlama.

export const LIMITS = Object.freeze({
  maxUserChars: 2000,
  maxAssistantChars: 6000,
  maxHistory: 12,
  maxMessagesInPayload: 50,
  maxBodyBytes: 64 * 1024,
});

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function selfOrigins(request) {
  const origins = new Set();
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // request.url göreli olabilir; yok say
  }
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) origins.add(`https://${forwardedHost.split(',')[0].trim()}`);
  return origins;
}

// Tarayıcılar POST isteklerinde Origin başlığı gönderir. Başka bir sitenin, ziyaretçilerinin
// tarayıcısı üzerinden API'mizi kullanmasını engeller. (curl gibi araçlar başlığı taklit
// edebilir; bunlara karşı hız sınırı ve OpenAI harcama limiti kullanılır.)
export function isOriginAllowed(request, allowedOrigins = []) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const normalized = origin.replace(/\/+$/, '');
  if (selfOrigins(request).has(normalized)) return true;
  return allowedOrigins.includes(normalized);
}

// Kayan pencere hız sınırlayıcı. Bellek içi olduğu için her sunucu örneğinde ayrı sayılır;
// kesin sınır için Vercel Firewall'da bir "rate limit" kuralı da tanımlayın.
export function createRateLimiter({ max, windowMs, maxKeys = 10000 }) {
  const hits = new Map();
  return function check(key, now = Date.now()) {
    const cutoff = now - windowMs;
    const recent = (hits.get(key) || []).filter((t) => t > cutoff);
    if (recent.length >= max) {
      hits.set(key, recent);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > maxKeys) {
      for (const [k, times] of hits) {
        if (!times.length || times[times.length - 1] <= cutoff) hits.delete(k);
      }
      if (hits.size > maxKeys) hits.clear();
    }
    return { ok: true, remaining: max - recent.length };
  };
}

export function validateChatPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'invalid_body' };
  const lang = payload.lang === 'en' ? 'en' : 'tr';
  const raw = Array.isArray(payload.messages) ? payload.messages : null;
  if (!raw || raw.length === 0) return { ok: false, error: 'no_messages' };
  if (raw.length > LIMITS.maxMessagesInPayload) return { ok: false, error: 'too_many_messages' };

  const messages = [];
  for (const m of raw.slice(-LIMITS.maxHistory)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { ok: false, error: 'invalid_message' };
    }
    const content = m.content.replace(/\u0000/g, '').trim();
    if (!content) continue;
    if (m.role === 'user' && content.length > LIMITS.maxUserChars) {
      return { ok: false, error: 'message_too_long' };
    }
    messages.push({
      role: m.role,
      content: m.role === 'assistant' ? content.slice(0, LIMITS.maxAssistantChars) : content,
    });
  }

  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: 'last_not_user' };
  }
  return { ok: true, messages, lang };
}
