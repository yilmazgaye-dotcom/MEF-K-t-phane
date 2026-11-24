import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion, detectLang, detectSearch, normalize, parseAnswerFile, validateAnswers } from '../lib/rules.js';
import { loadAnswers } from '../lib/knowledge.js';
import { getConfig } from '../lib/config.js';

// Örnek soru -> beklenen hazır yanıt kimliği. Yeni yanıt eklediğinizde buraya da örnek ekleyin.
const CASES = [
  ['Kütüphane çalışma saatleri nedir?', 'saatler'],
  ['Kütüphane kaçta kapanıyor?', 'saatler'],
  ['What are the library opening hours?', 'saatler'],
  ['Kütüphane nerede?', 'iletisim'],
  ['Kütüphanenin telefon numarası nedir?', 'iletisim'],
  ['Kütüphaneden kimler yararlanabilir, üye olmam gerekiyor mu?', 'uyelik'],
  ['Başka üniversitedenim, kütüphaneyi kullanabilir miyim?', 'dis-kullanici'],
  ['Mezun olduktan sonra veri tabanlarını kullanabilir miyim?', 'mezun'],
  ['Öğrenci kartımı unuttum', 'kart'],
  ['Kaç kitap ödünç alabilirim ve süreler ne kadar?', 'odunc'],
  ['How many books can I borrow?', 'odunc'],
  ['Kitabın süresini nasıl uzatırım?', 'uzatma'],
  ['Gecikme cezası ne kadar?', 'gecikme'],
  ['Kitabımı kaybettim ne yapmalıyım?', 'kayip-materyal'],
  ['Grup çalışma odası nasıl rezerve edilir?', 'odalar'],
  ['Hangi akademik veri tabanlarına erişebilirim?', 'veritabanlari'],
  ['Evden EZproxy ile nasıl bağlanırım?', 'kampus-disi'],
  ['DVD var mı?', 'cd-dvd'],
  ['Kaç DVD ödünç alabilirim?', 'cd-dvd'],
  ['Kütüphane koleksiyonunda neler var?', 'koleksiyon'],
  ['Wi-Fi var mı?', 'olanaklar'],
  ['Turnitin nasıl kullanılır?', 'turnitin'],
  ['APA formatında kaynakça nasıl yazılır?', 'apa'],
  ['ILL nedir?', 'ill'],
  ['Kütüphanede yemek yiyebilir miyim?', 'kurallar'],
  ['Merhaba', 'selamlama'],
  ['Merhaba, kütüphane kaçta açılıyor?', 'saatler'],
  ['Teşekkürler', 'tesekkur'],
];

test('örnek sorular doğru hazır yanıta gider', async () => {
  const entries = await loadAnswers({ useCache: false });
  for (const [question, expected] of CASES) {
    const r = answerQuestion({ entries, text: question });
    assert.equal(r.id, expected, `"${question}" -> ${r.id} (${r.kind})`);
  }
});

test('hazır yanıt dosyaları geçerli', async () => {
  const entries = await loadAnswers({ useCache: false });
  assert.ok(entries.length >= 25);
  assert.deepEqual(validateAnswers(entries), []);
});

test('kaynak arama isteği arama işaretine dönüşür', async () => {
  const entries = await loadAnswers();
  const tr = answerQuestion({ entries, text: 'Şu konuda kaynak arıyorum: yapay zeka etiği' });
  assert.equal(tr.kind, 'search');
  assert.ok(tr.text.endsWith('[[ARA: yapay zeka etiği]]'));
  const book = answerQuestion({ entries, text: 'Kütüphanede Suç ve Ceza kitabı var mı?' });
  assert.ok(book.text.endsWith('[[ARA: Suç ve Ceza]]'));
  const en = answerQuestion({ entries, text: 'Do you have Sapiens by Yuval Noah Harari?' });
  assert.equal(en.lang, 'en');
  assert.ok(en.text.endsWith('[[SEARCH: Sapiens by Yuval Noah Harari]]'));
});

test('eşleşme yoksa uydurmaz, kütüphaneye yönlendirir', async () => {
  const entries = await loadAnswers();
  const r = answerQuestion({ entries, text: 'Kütüphane binası hangi yıl yapıldı?' });
  assert.equal(r.kind, 'fallback');
  assert.ok(r.text.includes('library@mef.edu.tr'));
});

test('DOI sonucu için uygun mesaj', async () => {
  const entries = await loadAnswers();
  assert.equal(answerQuestion({ entries, text: '10.1/x', citation: { status: 'ok' } }).kind, 'doi');
  assert.ok(answerQuestion({ entries, text: '10.1/x', citation: { status: 'not_found' } }).text.includes('bulunamadı'));
});

test('yanıtın sonuna dile uygun kaynak eklenir', async () => {
  const entries = await loadAnswers();
  const tr = answerQuestion({ entries, text: 'Çalışma saatleri nedir?' });
  assert.ok(tr.text.includes('Kaynak: [Çalışma Saatleri](https://library.mef.edu.tr/tr/calisma-saatleri)'));
  const en = answerQuestion({ entries, text: 'What are the opening hours?' });
  assert.ok(en.text.includes('Source: [Opening Hours](https://library.mef.edu.tr/en/calisma-saatleri)'));
});

test('yardımcı fonksiyonlar', () => {
  assert.equal(normalize('Çalışma Saatleri İÇİN'), 'calisma saatleri icin');
  assert.equal(detectLang('How do I renew a book?'), 'en');
  assert.equal(detectLang('Kitap nasıl uzatılır?'), 'tr');
  assert.equal(detectLang('???', 'en'), 'en');
  assert.deepEqual(detectSearch('Saatler nedir?'), { isSearch: false, query: '' });
  const parsed = parseAnswerFile('## x\nanahtar: a1b2, iki kelime\nkaynak: Sayfa | https://a.b\n\n### TR\nMerhaba\n\n### EN\nHello', 'f.md');
  assert.equal(parsed[0].tr, 'Merhaba');
  assert.equal(parsed[0].en, 'Hello');
  assert.deepEqual(parsed[0].source, { label: 'Sayfa', url: 'https://a.b' });
  assert.deepEqual(parsed[0].matchers.map((m) => m.type), ['prefix', 'phrase']);
});

test('çalışma modu seçimi', () => {
  assert.equal(getConfig({}).useAI, false);
  assert.equal(getConfig({ OPENAI_API_KEY: 'k' }).useAI, true);
  assert.equal(getConfig({ OPENAI_API_KEY: 'k', ASSISTANT_MODE: 'rules' }).useAI, false);
  assert.equal(getConfig({ ASSISTANT_MODE: 'ai' }).useAI, true);
  assert.equal(getConfig({ ASSISTANT_MODE: 'xyz' }).mode, 'auto');
});
