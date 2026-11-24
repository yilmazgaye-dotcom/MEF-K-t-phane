// GET /api/health — kurulum kontrolü. Anahtarın kendisini değil, yalnızca tanımlı olup olmadığını gösterir.

import { VERSION, getConfig } from '../lib/config.js';
import { loadAnswers, loadKnowledge } from '../lib/knowledge.js';

export async function GET() {
  const config = getConfig();
  let knowledgeFiles = 0;
  let answers = 0;
  try {
    knowledgeFiles = (await loadKnowledge()).length;
  } catch {
    knowledgeFiles = 0;
  }
  try {
    answers = (await loadAnswers()).length;
  } catch {
    answers = 0;
  }
  const mode = config.useAI ? 'ai' : 'rules';
  const body = {
    ok: mode === 'ai' ? Boolean(config.apiKey) && knowledgeFiles > 0 : answers > 0,
    version: VERSION,
    mode,
    apiKeyConfigured: Boolean(config.apiKey),
    model: mode === 'ai' ? config.model : null,
    knowledgeFiles,
    answers,
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
