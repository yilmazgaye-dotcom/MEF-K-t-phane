import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, isOriginAllowed, validateChatPayload } from '../lib/security.js';
import { createSseParser } from '../lib/sse.js';
import { buildRequestBody, streamResponse } from '../lib/openai.js';
import { extractDoi, lookupDoi } from '../lib/crossref.js';
import { parseKnowledgeFile, validateKnowledgeDoc } from '../lib/knowledge-parse.js';
import { loadKnowledge } from '../lib/knowledge.js';
import { buildInstructions } from '../lib/prompt.js';
import { getConfig } from '../lib/config.js';

const fakeRequest = (origin, url = 'https://asistan.example.app/api/chat', extra = {}) => {
  const headers = { ...extra };
  if (origin) headers.origin = origin;
  return { url, headers: { get: (k) => headers[k.toLowerCase()] ?? null } };
};

test('Origin kontrolü', () => {
  assert.equal(isOriginAllowed(fakeRequest('https://asistan.example.app')), true);
  assert.equal(isOriginAllowed(fakeRequest('https://kotu.example')), false);
  assert.equal(isOriginAllowed(fakeRequest(null)), false);
  assert.equal(isOriginAllowed(fakeRequest('https://library.mef.edu.tr'), ['https://library.mef.edu.tr']), true);
  assert.equal(
    isOriginAllowed(fakeRequest('https://ozel.alan.tr', 'http://localhost/api/chat', { 'x-forwarded-host': 'ozel.alan.tr' })),
    true,
  );
});

test('istek doğrulama', () => {
  assert.equal(validateChatPayload(null).ok, false);
  assert.equal(validateChatPayload({ messages: [] }).ok, false);
  const ok = validateChatPayload({
    messages: [
      { role: 'assistant', content: 'hoş geldiniz' },
      { role: 'user', content: '  Merhaba  ' },
    ],
    lang: 'en',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.lang, 'en');
  assert.deepEqual(ok.messages, [{ role: 'user', content: 'Merhaba' }]);
  assert.equal(validateChatPayload({ messages: [{ role: 'system', content: 'x' }] }).ok, false);
  assert.equal(validateChatPayload({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }).error, 'message_too_long');
  assert.equal(validateChatPayload({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }).error, 'last_not_user');
  const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  long.push({ role: 'user', content: 'son' });
  assert.ok(validateChatPayload({ messages: long }).messages.length <= 12);
});

test('hız sınırlayıcı', () => {
  const check = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(check('ip', 0).ok, true);
  assert.equal(check('ip', 10).ok, true);
  const blocked = check('ip', 20);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfter, 1);
  assert.equal(check('baska-ip', 20).ok, true);
  assert.equal(check('ip', 1001).ok, true);
});

test('SSE ayrıştırıcı parçalara bölünmüş olayları birleştirir', () => {
  const events = [];
  const p = createSseParser((e) => events.push(e));
  p.push('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Mer"}\n\n');
  p.push('event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta",');
  p.push('"delta":"haba"}\r\n\r\n');
  p.push('data: [DONE]\n\n');
  assert.deepEqual(
    events.map((e) => e.delta ?? e.type),
    ['Mer', 'haba', 'done'],
  );
});

const cfg = { apiKey: 'test-key', model: 'test-model', maxOutputTokens: 100, reasoningEffort: 'low' };

test('OpenAI istek gövdesi: store=false, akış açık, anahtar gövdede yok', () => {
  const body = buildRequestBody({ config: cfg, instructions: 'talimat', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
  assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.ok(!JSON.stringify(body).includes('test-key'));
  const noEffort = buildRequestBody({ config: { ...cfg, reasoningEffort: '' }, instructions: '', messages: [] });
  assert.equal('reasoning' in noEffort, false);
});

test('streamResponse metin parçalarını üretir', async () => {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('data: {"type":"response.output_text.delta","delta":"A"}\n\n'));
      c.enqueue(enc.encode('data: {"type":"response.output_text.delta","delta":"B"}\n\ndata: {"type":"response.completed"}\n\n'));
      c.close();
    },
  });
  let sentHeaders;
  const fetchImpl = async (_url, init) => {
    sentHeaders = init.headers;
    return new Response(body, { status: 200 });
  };
  const out = [];
  for await (const part of streamResponse({ config: cfg, instructions: 'i', messages: [{ role: 'user', content: 'x' }], fetchImpl })) {
    out.push(part);
  }
  assert.deepEqual(out, [
    { type: 'text', text: 'A' },
    { type: 'text', text: 'B' },
  ]);
  assert.equal(sentHeaders.Authorization, 'Bearer test-key');
});

test('streamResponse HTTP hatasında durum kodunu taşır', async () => {
  const fetchImpl = async () => new Response('{"error":{"message":"bad key"}}', { status: 401 });
  await assert.rejects(
    async () => {
      for await (const _ of streamResponse({ config: cfg, instructions: '', messages: [], fetchImpl })) {
        // tüket
      }
    },
    (err) => err.status === 401,
  );
});

test('DOI algılama', () => {
  assert.equal(extractDoi('DOI: 10.1037/0003-066X.59.1.29.'), '10.1037/0003-066X.59.1.29');
  assert.equal(extractDoi('(https://doi.org/10.1016/j.cell.2020.01.001)'), '10.1016/j.cell.2020.01.001');
  assert.equal(extractDoi('10.1002/(SICI)1097-4571(199806)49:8'), '10.1002/(SICI)1097-4571(199806)49:8');
  assert.equal(extractDoi('doi yok'), null);
});

test('Crossref sorgusu (sahte fetch ile)', async () => {
  const notFound = await lookupDoi('10.1/yok', { fetchImpl: async () => new Response('', { status: 404 }) });
  assert.deepEqual(notFound, { found: false });
  let calledUrl;
  const found = await lookupDoi('10.1/var', {
    fetchImpl: async (url) => {
      calledUrl = url;
      return new Response(JSON.stringify({ message: { DOI: '10.1/var' } }), { status: 200 });
    },
  });
  assert.equal(found.found, true);
  assert.equal(calledUrl, 'https://api.crossref.org/works/10.1/var');
});

test('bilgi dosyası ayrıştırma', () => {
  const d = parseKnowledgeFile(
    '---\nid: x\ntitle: Başlık\nsource: https://a.b/c\nupdated: 2026-01-01\n---\n<!-- editör notu -->\nİçerik',
    'x.md',
  );
  assert.equal(d.meta.title, 'Başlık');
  assert.equal(d.body, 'İçerik');
  assert.deepEqual(validateKnowledgeDoc(d, { today: new Date('2026-02-01T00:00:00Z') }), { errors: [], warnings: [] });
  const bad = parseKnowledgeFile('---\nid: y\n---\n', 'y.md');
  assert.ok(validateKnowledgeDoc(bad).errors.length >= 3);
});

test('depodaki bilgi dosyaları geçerli ve talimatlara giriyor', async () => {
  const docs = await loadKnowledge({ useCache: false });
  assert.ok(docs.length >= 10);
  const ids = new Set();
  for (const d of docs) {
    assert.deepEqual(validateKnowledgeDoc(d, { staleDays: 100000 }).errors, [], d.file);
    assert.ok(!ids.has(d.meta.id), `yinelenen id: ${d.meta.id}`);
    ids.add(d.meta.id);
    assert.ok(!d.body.includes('<!--'), `${d.file}: yorum temizlenmemiş`);
  }
  const instructions = buildInstructions({ docs, lang: 'en', now: new Date('2026-11-23T10:00:00Z') });
  assert.ok(instructions.includes('# BİLGİ TABANI'));
  assert.ok(instructions.includes('08:30 – 22:00'));
  assert.ok(instructions.includes('Arayüz dili: English'));
  assert.ok(instructions.includes('2026'));
  assert.ok(!instructions.includes('DOĞRULANACAK'), 'editör notları asistana gitmemeli');
});

test('DOI notu talimatlara eklenir', async () => {
  const docs = await loadKnowledge();
  const text = buildInstructions({
    docs,
    citation: { status: 'ok', doi: '10.1/x', apa: { markdown: 'Doe, J. (2020). *Kitap*.' } },
  });
  assert.ok(text.includes('Doe, J. (2020). *Kitap*.'));
  assert.ok(buildInstructions({ docs, citation: { status: 'not_found', doi: '10.1/y' } }).includes('bulunamadı'));
});

test('yapılandırma varsayılanları ve sınırlar', () => {
  const c = getConfig({ OPENAI_MAX_OUTPUT_TOKENS: '999999', ALLOWED_ORIGINS: 'https://a.tr/, https://b.tr' });
  assert.equal(c.apiKey, '');
  assert.equal(c.maxOutputTokens, 8000);
  assert.deepEqual(c.allowedOrigins, ['https://a.tr', 'https://b.tr']);
  assert.equal(c.reasoningEffort, 'low');
  assert.equal(getConfig({ OPENAI_REASONING_EFFORT: '' }).reasoningEffort, '');
});
