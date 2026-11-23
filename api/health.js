// GET /api/health — kurulum kontrolü. Anahtarın kendisini değil, yalnızca tanımlı olup olmadığını gösterir.

import { VERSION, getConfig } from '../lib/config.js';
import { loadKnowledge } from '../lib/knowledge.js';

export async function GET() {
  const config = getConfig();
  let knowledgeFiles = 0;
  try {
    knowledgeFiles = (await loadKnowledge()).length;
  } catch {
    knowledgeFiles = 0;
  }
  const body = {
    ok: Boolean(config.apiKey) && knowledgeFiles > 0,
    version: VERSION,
    apiKeyConfigured: Boolean(config.apiKey),
    model: config.model,
    knowledgeFiles,
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
