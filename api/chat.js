// POST /api/chat — sohbet uç noktası (Vercel Function, Node.js çalışma zamanı).
// İstemci { messages: [{ role, content }], lang } gönderir; yanıt NDJSON akışıdır:
//   {"type":"citation","citation":{...}}  DOI için APA kaynakçası (varsa, ilk satır)
//   {"type":"delta","text":"..."}         yanıt metninin parçaları
//   {"type":"notice","code":"incomplete"} yanıt token sınırına ulaştı
//   {"type":"done"} | {"type":"error","code":"..."}

import { getConfig } from '../lib/config.js';
import {
  LIMITS,
  createRateLimiter,
  getClientIp,
  isOriginAllowed,
  validateChatPayload,
} from '../lib/security.js';
import { loadKnowledge } from '../lib/knowledge.js';
import { buildInstructions } from '../lib/prompt.js';
import { UpstreamError, streamResponse } from '../lib/openai.js';
import { extractDoi, lookupDoi } from '../lib/crossref.js';
import { formatApa } from '../lib/apa.js';

const config = getConfig();
const limiter = createRateLimiter({ max: config.rateLimitMax, windowMs: config.rateLimitWindowMs });

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

async function resolveCitation(text) {
  const doi = extractDoi(text);
  if (!doi) return null;
  try {
    const result = await lookupDoi(doi, { mailto: config.crossrefMailto });
    if (!result.found) return { status: 'not_found', doi };
    return { status: 'ok', doi, apa: formatApa(result.work) };
  } catch {
    return { status: 'error', doi };
  }
}

function errorCode(err) {
  if (err instanceof UpstreamError) {
    if (err.status === 429) return 'upstream_busy';
    if (err.status === 401 || err.status === 403) return 'upstream_auth';
    return 'upstream_error';
  }
  return 'server_error';
}

function logError(err) {
  // Kullanıcı mesajları kayda geçirilmez; yalnızca hata türü ve kısa ayrıntı.
  const detail = String(err?.detail ?? err?.message ?? '').slice(0, 300);
  console.error('[chat]', err?.name || 'Error', err?.status ?? '', detail);
}

export async function POST(request) {
  if (!isOriginAllowed(request, config.allowedOrigins)) {
    return json(403, { error: 'forbidden_origin' });
  }

  const rate = limiter(getClientIp(request));
  if (!rate.ok) {
    return json(429, { error: 'rate_limited', retryAfter: rate.retryAfter }, { 'Retry-After': String(rate.retryAfter) });
  }

  if (!config.apiKey) return json(503, { error: 'not_configured' });

  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return json(415, { error: 'unsupported_media_type' });
  }

  const raw = await request.text();
  if (raw.length > LIMITS.maxBodyBytes) return json(413, { error: 'payload_too_large' });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const checked = validateChatPayload(payload);
  if (!checked.ok) return json(400, { error: checked.error });
  const { messages, lang } = checked;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          // istemci bağlantıyı kapattı
        }
      };
      try {
        const citation = await resolveCitation(messages[messages.length - 1].content);
        if (citation?.status === 'ok') send({ type: 'citation', citation: citation.apa });

        const docs = await loadKnowledge();
        const instructions = buildInstructions({ docs, lang, now: new Date(), citation });

        for await (const part of streamResponse({ config, instructions, messages, signal: request.signal })) {
          if (part.type === 'text') send({ type: 'delta', text: part.text });
          else if (part.type === 'incomplete') send({ type: 'notice', code: 'incomplete' });
        }
        send({ type: 'done' });
      } catch (err) {
        if (!request.signal?.aborted) {
          logError(err);
          send({ type: 'error', code: errorCode(err) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // zaten kapalı
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function GET() {
  return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
}
