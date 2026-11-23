import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, tokenizeInline } from '../public/js/markdown.js';
import { buildSearchLinks, extractSearchMarker, stripPartialMarker } from '../public/js/search-links.js';
import { STRINGS } from '../public/js/i18n.js';

test('markdown: kalın, bağlantı ve e-posta', () => {
  const t = tokenizeInline('Bkz. **önemli** [Form](https://form.jotform.com/1) ve library@mef.edu.tr.');
  assert.deepEqual(
    t.map((x) => x.type),
    ['text', 'bold', 'text', 'link', 'text', 'link', 'text'],
  );
  assert.equal(t[3].href, 'https://form.jotform.com/1');
  assert.equal(t[5].href, 'mailto:library@mef.edu.tr');
  assert.equal(t[6].value, '.');
});

test('markdown: javascript: bağlantıları asla bağlantıya dönüşmez', () => {
  const t = tokenizeInline('[tıkla](javascript:alert(1)) <img src=x onerror=alert(1)>');
  assert.ok(t.every((x) => x.type === 'text'));
});

test('markdown: çıplak URL sonundaki noktalama bağlantıya dahil edilmez', () => {
  const t = tokenizeInline('Adres: https://library.mef.edu.tr/tr.');
  assert.equal(t[1].href, 'https://library.mef.edu.tr/tr');
  assert.equal(t[2].value, '.');
});

test('markdown: italik (APA dergi adı)', () => {
  const t = tokenizeInline('Doe, J. (2020). Başlık. *Dergi Adı*, *12*(3), 1–5.');
  assert.deepEqual(
    t.filter((x) => x.type === 'italic').map((x) => x.children[0].value),
    ['Dergi Adı', '12'],
  );
});

test('markdown: bloklar', () => {
  const b = parseBlocks('Merhaba\nikinci satır\n\n- a\n- b\n\n1. bir\n2. iki\n\n## Başlık');
  assert.deepEqual(
    b.map((x) => x.type),
    ['p', 'ul', 'ol', 'p'],
  );
  assert.deepEqual(b[0].lines, ['Merhaba', 'ikinci satır']);
  assert.deepEqual(b[1].items, ['a', 'b']);
  assert.deepEqual(b[3].lines, ['Başlık']);
});

test('arama işareti çıkarılır', () => {
  const r = extractSearchMarker('Kataloğa bakabilirsiniz.\n\n[[ARA: iklim değişikliği politikası]]');
  assert.equal(r.query, 'iklim değişikliği politikası');
  assert.equal(r.clean, 'Kataloğa bakabilirsiniz.');
  assert.equal(extractSearchMarker('işaret yok').query, null);
  assert.equal(extractSearchMarker('x [[SEARCH: climate change]]').query, 'climate change');
});

test('akış sırasında yarım işaret gizlenir', () => {
  assert.equal(stripPartialMarker('Metin\n[[AR'), 'Metin');
  assert.equal(stripPartialMarker('Metin [[ARA: tam]] son'), 'Metin son');
  assert.equal(stripPartialMarker('Tamam'), 'Tamam');
});

test('arama bağlantıları doğru kodlanır', () => {
  const links = buildSearchLinks('climate change & policy', 'tr');
  assert.equal(links[0].url, 'https://discovery.ebsco.com/c/657sr5/results?q=climate%20change%20%26%20policy');
  assert.equal(
    links[1].url,
    'https://libcatalog.mef.edu.tr/vufind/Search/Results?lookfor=climate%20change%20%26%20policy&type=AllFields',
  );
  assert.deepEqual(buildSearchLinks('  ', 'tr'), []);
  assert.equal(buildSearchLinks('x', 'en')[0].label, 'All in MEF – all library resources');
});

test('i18n: iki dilde aynı anahtarlar var', () => {
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(STRINGS.tr), keys(STRINGS.en));
  assert.deepEqual(keys(STRINGS.tr.errors), keys(STRINGS.en.errors));
  assert.deepEqual(keys(STRINGS.tr.warnings), keys(STRINGS.en.warnings));
  assert.equal(STRINGS.tr.quick.length, STRINGS.en.quick.length);
});
