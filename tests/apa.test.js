import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatApa, initials, joinAuthors, stripMarkup } from '../lib/apa.js';

test('initials: adlar, tireli adlar ve hazır baş harfler', () => {
  assert.equal(initials('John Ronald'), 'J. R.');
  assert.equal(initials('Jane Q.'), 'J. Q.');
  assert.equal(initials('Jean-Paul'), 'J.-P.');
  assert.equal(initials('J.R.R.'), 'J. R. R.');
  assert.equal(initials('ayşe'), 'A.');
  assert.equal(initials(''), '');
});

test('joinAuthors: APA 7 yazar listesi kuralları', () => {
  assert.equal(joinAuthors(['Doe, J.']), 'Doe, J.');
  assert.equal(joinAuthors(['Doe, J.', 'Roe, R.']), 'Doe, J., & Roe, R.');
  assert.equal(joinAuthors(['A, A.', 'B, B.', 'C, C.']), 'A, A., B, B., & C, C.');
  const many = Array.from({ length: 22 }, (_, i) => `Y${i + 1}, A.`);
  assert.equal(joinAuthors(many), `${many.slice(0, 19).join(', ')}, . . . Y22, A.`);
});

test('stripMarkup: Crossref başlıklarındaki HTML etiketlerini temizler', () => {
  assert.equal(stripMarkup('<i>In vitro</i> study &amp; results'), 'In vitro study & results');
});

test('dergi makalesi', () => {
  const r = formatApa({
    type: 'journal-article',
    DOI: '10.1037/0003-066X.59.1.29',
    title: ['The case for something'],
    author: [
      { given: 'Jane Q.', family: 'Doe' },
      { given: 'John', family: 'Smith' },
    ],
    'container-title': ['American Psychologist'],
    volume: '59',
    issue: '1',
    page: '29-34',
    issued: { 'date-parts': [[2004, 1]] },
  });
  assert.equal(
    r.text,
    'Doe, J. Q., & Smith, J. (2004). The case for something. American Psychologist, 59(1), 29–34. https://doi.org/10.1037/0003-066X.59.1.29',
  );
  assert.deepEqual(
    r.segments.filter((s) => s.i).map((s) => s.t),
    ['American Psychologist', '59'],
  );
  assert.ok(r.markdown.includes('*American Psychologist*, *59*(1)'));
  assert.ok(r.warnings.includes('sentence_case'));
});

test('makale numaralı makale', () => {
  const r = formatApa({
    type: 'journal-article',
    DOI: '10.1/x',
    title: ['Open data'],
    author: [{ given: 'Ali', family: 'Kaya' }],
    'container-title': ['PLOS ONE'],
    volume: '5',
    issue: '2',
    'article-number': 'e123',
    issued: { 'date-parts': [[2010]] },
  });
  assert.equal(r.text, 'Kaya, A. (2010). Open data. PLOS ONE, 5(2), Article e123. https://doi.org/10.1/x');
});

test('kitap (baskı numarası ve alt başlık)', () => {
  const r = formatApa({
    type: 'book',
    DOI: '10.1000/xyz',
    title: ['Learning theories'],
    subtitle: ['An educational perspective'],
    author: [{ given: 'Dale H.', family: 'Schunk' }],
    publisher: 'Pearson',
    'edition-number': '8',
    'published-print': { 'date-parts': [[2020]] },
  });
  assert.equal(
    r.text,
    'Schunk, D. H. (2020). Learning theories: An educational perspective (8th ed.). Pearson. https://doi.org/10.1000/xyz',
  );
  assert.deepEqual(
    r.segments.filter((s) => s.i).map((s) => s.t),
    ['Learning theories: An educational perspective'],
  );
});

test('editörlü kitapta bölüm', () => {
  const r = formatApa({
    type: 'book-chapter',
    DOI: '10.1000/ch1',
    title: ['Memory and learning'],
    author: [{ given: 'Ann', family: 'Lee' }],
    editor: [
      { given: 'Bob', family: 'Stone' },
      { given: 'Cara', family: 'West' },
    ],
    'container-title': ['Handbook of cognition'],
    page: '10-25',
    publisher: 'Springer',
    issued: { 'date-parts': [[2019]] },
  });
  assert.equal(
    r.text,
    'Lee, A. (2019). Memory and learning. In B. Stone & C. West (Eds.), Handbook of cognition (pp. 10–25). Springer. https://doi.org/10.1000/ch1',
  );
});

test('yazarsız ve tarihsiz kaynak', () => {
  const r = formatApa({
    type: 'journal-article',
    DOI: '10.1/abc',
    title: ['Anonymous report'],
    'container-title': ['Journal X'],
    volume: '3',
  });
  assert.equal(r.text, 'Anonymous report. (n.d.). Journal X, 3. https://doi.org/10.1/abc');
  assert.ok(r.warnings.includes('no_authors'));
  assert.ok(r.warnings.includes('no_year'));
});

test('kurum yazar ve ön baskı', () => {
  const r = formatApa({
    type: 'posted-content',
    DOI: '10.31234/osf.io/abcd',
    title: ['A preprint'],
    author: [{ name: 'Open Science Collaboration' }],
    institution: [{ name: 'PsyArXiv' }],
    issued: { 'date-parts': [[2023]] },
  });
  assert.equal(
    r.text,
    'Open Science Collaboration. (2023). A preprint [Preprint]. PsyArXiv. https://doi.org/10.31234/osf.io/abcd',
  );
});
