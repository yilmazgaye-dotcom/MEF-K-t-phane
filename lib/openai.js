// OpenAI Responses API istemcisi (bağımlılıksız, yerleşik fetch ile).
// API anahtarı yalnızca burada, sunucuda kullanılır.

import { createSseParser } from './sse.js';

const ENDPOINT = 'https://api.openai.com/v1/responses';

export class UpstreamError extends Error {
  constructor(status, detail = '') {
    super(`OpenAI isteği başarısız (${status})`);
    this.name = 'UpstreamError';
    this.status = status;
    this.detail = detail;
  }
}

export function buildRequestBody({ config, instructions, messages }) {
  const body = {
    model: config.model,
    instructions,
    input: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    // Konuşmalar OpenAI tarafında saklanmaz (KVKK açısından veri en aza indirilir).
    store: false,
    max_output_tokens: config.maxOutputTokens,
  };
  if (config.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
  return body;
}

// Metin parçalarını { type: 'text', text } olarak üretir.
export async function* streamResponse({ config, instructions, messages, signal, fetchImpl = fetch }) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody({ config, instructions, messages })),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      // gövde okunamadı
    }
    throw new UpstreamError(res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const queue = [];
  const parser = createSseParser((evt) => queue.push(evt));

  try {
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) {
        parser.push(decoder.decode());
        parser.flush();
        finished = true;
      } else {
        parser.push(decoder.decode(value, { stream: true }));
      }

      while (queue.length) {
        const evt = queue.shift();
        switch (evt.type) {
          case 'response.output_text.delta':
            if (evt.delta) yield { type: 'text', text: evt.delta };
            break;
          case 'response.incomplete':
            yield { type: 'incomplete', reason: evt.response?.incomplete_details?.reason || 'unknown' };
            break;
          case 'response.failed':
            throw new UpstreamError(502, evt.response?.error?.message || 'response.failed');
          case 'error':
            throw new UpstreamError(502, evt.message || evt.error?.message || 'stream error');
          default:
            break;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // zaten serbest
    }
  }
}
