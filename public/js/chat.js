// Sohbet arayüzü (embed sayfası). Widget bu sayfayı iframe içinde açar;
// doğrudan /embed adresinden tam ekran da kullanılabilir.

import { LINKS, getStrings } from './i18n.js';
import { renderMarkdown } from './markdown.js';
import { buildSearchLinks, extractSearchMarker, stripPartialMarker } from './search-links.js';

const STORAGE_KEY = 'mef-kutuphane-asistani:v2';
const NS = 'mef-library-assistant';
const MAX_CHARS = 2000;
const COUNTER_FROM = 1800;
const HISTORY_LIMIT = 12;

const ICONS = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.4 2-12.4 2z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
};

class ChatError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embedded') === '1';
const byId = (id) => document.getElementById(id);
const els = {
  title: byId('chat-title'),
  subtitle: byId('chat-subtitle'),
  log: byId('log'),
  quick: byId('quick'),
  form: byId('composer'),
  input: byId('input'),
  inputLabel: byId('input-label'),
  send: byId('send-btn'),
  counter: byId('counter'),
  footer: byId('footer'),
  lang: byId('lang-btn'),
  reset: byId('new-btn'),
  close: byId('close-btn'),
};

const refs = new WeakMap();
const state = { lang: 'tr', langChosen: false, messages: [], busy: false, controller: null };
let frame = 0;

const s = () => getStrings(state.lang);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function externalLink(href, text, className) {
  const a = el('a', className, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

// ---------- Oturum depolama (yalnızca bu sekme; sayfa yenilense de sohbet kalır) ----------
function loadSaved() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.messages) ? data : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    const messages = state.messages
      .filter((m) => !m.pending)
      .map((m) => ({
        role: m.role,
        content: m.content,
        local: Boolean(m.local),
        citation: m.citation || null,
        searchQuery: m.searchQuery || null,
        error: m.error || null,
        note: m.note || null,
      }));
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lang: state.lang, langChosen: state.langChosen, messages }),
    );
  } catch {
    // depolama kapalı olabilir (gizli pencere vb.); sohbet yine çalışır
  }
}

const welcomeMessage = () => ({ role: 'assistant', content: s().welcome, local: true });

const isValidMessage = (m) =>
  m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';

// ---------- Metinler ----------
function applyStrings() {
  const t = s();
  document.documentElement.lang = state.lang;
  document.title = t.title;
  els.title.textContent = t.title;
  els.subtitle.textContent = t.subtitle;
  els.input.placeholder = t.placeholder;
  els.inputLabel.textContent = t.inputLabel;
  els.lang.textContent = t.langButton;
  els.lang.setAttribute('aria-label', t.switchLang);
  els.lang.title = t.switchLang;
  els.reset.setAttribute('aria-label', t.newChat);
  els.reset.title = t.newChat;
  els.close.setAttribute('aria-label', t.close);
  els.close.title = t.close;
  renderFooter();
  updateSendButton();
}

function renderFooter() {
  const t = s();
  els.footer.textContent = '';
  els.footer.append(`${t.disclaimer} `, externalLink(LINKS.askLibrarian, t.disclaimerLink), '.');
}

function renderQuick() {
  const hasUserMessage = state.messages.some((m) => m.role === 'user');
  els.quick.textContent = '';
  els.quick.hidden = hasUserMessage;
  if (hasUserMessage) return;
  const t = s();
  els.quick.setAttribute('aria-label', t.quickLabel);
  for (const q of t.quick) {
    const b = el('button', 'chip', q.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      if (q.text) {
        send(q.text);
      } else {
        els.input.value = q.prefill;
        onInput();
        els.input.focus();
        const end = els.input.value.length;
        els.input.setSelectionRange(end, end);
      }
    });
    els.quick.appendChild(b);
  }
  els.quick.appendChild(externalLink(LINKS.askLibrarian, t.askLibrarian, 'chip chip--link'));
}

// ---------- Mesajlar ----------
function typingIndicator() {
  const wrap = el('span', 'typing');
  wrap.append(el('span', 'typing__dot'), el('span', 'typing__dot'), el('span', 'typing__dot'));
  wrap.appendChild(el('span', 'visually-hidden', s().typing));
  return wrap;
}

function fillBubble(m) {
  const r = refs.get(m);
  if (!r) return;
  const { bubble } = r;
  bubble.textContent = '';
  if (m.role === 'user') {
    bubble.textContent = m.content;
    bubble.hidden = false;
    return;
  }
  const text = m.pending ? stripPartialMarker(m.content) : m.content;
  if (text) bubble.appendChild(renderMarkdown(text));
  else if (m.pending) bubble.appendChild(typingIndicator());
  if (m.note) bubble.appendChild(el('p', 'msg__note', m.note));
  bubble.hidden = !bubble.childNodes.length;
}

function buildRow(m) {
  const row = el('div', `msg msg--${m.role}`);
  const bubble = el('div', 'msg__bubble');
  row.appendChild(bubble);
  refs.set(m, { row, bubble });
  fillBubble(m);
  if (m.citation) row.appendChild(renderCitation(m.citation));
  if (m.searchQuery) row.appendChild(renderSearchCard(m.searchQuery));
  if (m.error) row.appendChild(renderError(m));
  if (m.role === 'assistant' && !m.pending && !m.local && m.content) row.appendChild(renderActions(m));
  return row;
}

function refreshRow(m) {
  const r = refs.get(m);
  if (!r) return;
  r.row.replaceWith(buildRow(m));
}

function renderAll() {
  els.log.textContent = '';
  for (const m of state.messages) els.log.appendChild(buildRow(m));
  renderQuick();
  scrollToBottom(true);
}

function appendMessage(m) {
  els.log.appendChild(buildRow(m));
  renderQuick();
  scrollToBottom(true);
}

function scrollToBottom(force = false) {
  const log = els.log;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  if (force || nearBottom) log.scrollTop = log.scrollHeight;
}

function scheduleUpdate(m) {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    fillBubble(m);
    scrollToBottom();
  });
}

// ---------- Kartlar ----------
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function copyRich(plain, html) {
  try {
    if (html && window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(plain);
      return true;
    } catch {
      return false;
    }
  }
}

function renderCitation(c) {
  const t = s();
  const card = el('div', 'card card--citation');
  card.appendChild(el('p', 'card__title', t.citationTitle));
  const ref = el('p', 'citation');
  for (const seg of c.segments || []) {
    ref.appendChild(el(seg.i ? 'i' : 'span', '', seg.t));
  }
  card.appendChild(ref);
  const notes = (c.warnings || []).map((w) => t.warnings[w]).filter(Boolean);
  notes.push(t.citationNote);
  const ul = el('ul', 'card__notes');
  for (const n of notes) ul.appendChild(el('li', '', n));
  card.appendChild(ul);
  const btn = el('button', 'btn btn--small', t.copy);
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const html = (c.segments || []).map((seg) => (seg.i ? `<i>${escapeHtml(seg.t)}</i>` : escapeHtml(seg.t))).join('');
    const ok = await copyRich(c.text || '', html);
    btn.textContent = ok ? t.copied : t.copyFailed;
    window.setTimeout(() => {
      btn.textContent = s().copy;
    }, 2000);
  });
  card.appendChild(btn);
  return card;
}

function renderSearchCard(query) {
  const t = s();
  const card = el('div', 'card card--search');
  const title = el('p', 'card__title', `${t.searchTitle} `);
  title.appendChild(el('q', '', query));
  card.appendChild(title);
  const list = el('ul', 'link-list');
  for (const link of buildSearchLinks(query, state.lang)) {
    const li = el('li');
    const a = externalLink(link.url, '', 'link-list__item');
    a.append(el('span', 'link-list__label', link.label), el('span', 'link-list__desc', link.description));
    li.appendChild(a);
    list.appendChild(li);
  }
  card.appendChild(list);
  const hint = el('p', 'card__hint', `${t.searchHint} `);
  hint.append(externalLink(LINKS.ezproxy, t.searchHintLink), '.');
  card.appendChild(hint);
  return card;
}

function renderError(m) {
  const t = s();
  const box = el('div', 'notice notice--error');
  box.setAttribute('role', 'alert');
  box.appendChild(el('p', '', t.errors[m.error] || t.errors.generic));
  if (!['forbidden_origin', 'not_configured', 'upstream_auth', 'message_too_long'].includes(m.error)) {
    const b = el('button', 'btn btn--small', t.retry);
    b.type = 'button';
    b.addEventListener('click', () => retry(m));
    box.appendChild(b);
  }
  return box;
}

function renderActions(m) {
  const wrap = el('div', 'msg__actions');
  const b = el('button', 'icon-btn icon-btn--ghost');
  b.type = 'button';
  b.innerHTML = ICONS.copy;
  b.setAttribute('aria-label', s().copyAnswer);
  b.title = s().copyAnswer;
  b.addEventListener('click', async () => {
    const text = refs.get(m)?.bubble.innerText || m.content;
    const ok = await copyRich(text, '');
    b.innerHTML = ok ? ICONS.check : ICONS.copy;
    b.title = ok ? s().copied : s().copyFailed;
    window.setTimeout(() => {
      b.innerHTML = ICONS.copy;
      b.title = s().copyAnswer;
    }, 1500);
  });
  wrap.appendChild(b);
  return wrap;
}

// ---------- Gönderme ve akış ----------
function conversationHistory() {
  return state.messages
    .filter((m) => !m.local && !m.pending && !m.error && m.content)
    .map((m) => ({ role: m.role, content: m.content }));
}

async function errorCodeFrom(res) {
  try {
    const data = await res.json();
    return data.error || 'generic';
  } catch {
    return res.status === 429 ? 'rate_limited' : 'generic';
  }
}

function handleEvent(evt, m) {
  switch (evt.type) {
    case 'delta':
      m.content += evt.text || '';
      scheduleUpdate(m);
      break;
    case 'citation':
      m.citation = evt.citation;
      refreshRow(m);
      break;
    case 'notice':
      if (evt.code === 'incomplete') m.note = s().incomplete;
      break;
    case 'error':
      throw new ChatError(evt.code || 'generic');
    default:
      break;
  }
}

async function readStream(body, m) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) handleEvent(JSON.parse(line), m);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleEvent(JSON.parse(buffer), m);
}

function finalize(m) {
  m.pending = false;
  const { clean, query } = extractSearchMarker(m.content);
  m.content = clean;
  if (query) m.searchQuery = query;
  if (!m.content && !m.error && !m.note && !m.citation) m.error = 'generic';
  refreshRow(m);
}

async function send(raw) {
  const text = String(raw ?? '').trim();
  if (!text || state.busy) return;
  if (text.length > MAX_CHARS) return;

  const history = conversationHistory().concat({ role: 'user', content: text }).slice(-HISTORY_LIMIT);
  const user = { role: 'user', content: text };
  const bot = { role: 'assistant', content: '', pending: true };
  state.messages.push(user, bot);
  appendMessage(user);
  appendMessage(bot);
  els.input.value = '';
  onInput();
  setBusy(true);

  const controller = new AbortController();
  state.controller = controller;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, lang: state.lang }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new ChatError(await errorCodeFrom(res));
    await readStream(res.body, bot);
  } catch (err) {
    if (err?.name === 'AbortError') bot.note = s().stopped;
    else if (err instanceof ChatError) bot.error = err.code;
    else bot.error = err instanceof TypeError ? 'network' : 'generic';
  } finally {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    finalize(bot);
    state.controller = null;
    setBusy(false);
    persist();
  }
}

function retry(bot) {
  if (state.busy) return;
  const i = state.messages.indexOf(bot);
  if (i < 1 || state.messages[i - 1].role !== 'user') return;
  const user = state.messages[i - 1];
  state.messages.splice(i - 1, 2);
  refs.get(bot)?.row.remove();
  refs.get(user)?.row.remove();
  send(user.content);
}

// ---------- Giriş alanı ----------
function setBusy(busy) {
  state.busy = busy;
  els.log.setAttribute('aria-busy', String(busy));
  updateSendButton();
}

function updateSendButton() {
  const t = s();
  if (state.busy) {
    els.send.innerHTML = ICONS.stop;
    els.send.setAttribute('aria-label', t.stop);
    els.send.title = t.stop;
    els.send.classList.add('is-stop');
    els.send.disabled = false;
  } else {
    els.send.innerHTML = ICONS.send;
    els.send.setAttribute('aria-label', t.send);
    els.send.title = t.send;
    els.send.classList.remove('is-stop');
    els.send.disabled = !els.input.value.trim();
  }
}

function autosize() {
  const input = els.input;
  input.style.height = 'auto';
  const border = input.offsetHeight - input.clientHeight;
  const needed = input.scrollHeight + border;
  input.style.height = `${Math.min(needed, 140)}px`;
  input.style.overflowY = needed > 140 ? 'auto' : 'hidden';
}

function onInput() {
  autosize();
  const n = els.input.value.length;
  els.counter.hidden = n < COUNTER_FROM;
  els.counter.textContent = `${n}/${MAX_CHARS}`;
  updateSendButton();
}

function requestClose() {
  if (embedded) window.parent.postMessage({ source: NS, type: 'close' }, '*');
}

function bindEvents() {
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) state.controller?.abort();
    else send(els.input.value);
  });
  els.input.addEventListener('input', onInput);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!state.busy) send(els.input.value);
    }
  });
  els.lang.addEventListener('click', () => {
    state.lang = state.lang === 'tr' ? 'en' : 'tr';
    state.langChosen = true;
    if (state.messages.every((m) => m.local)) state.messages = [welcomeMessage()];
    applyStrings();
    renderAll();
    persist();
  });
  els.reset.addEventListener('click', () => {
    state.controller?.abort();
    state.messages = [welcomeMessage()];
    renderAll();
    persist();
    els.input.focus();
  });
  els.close.addEventListener('click', requestClose);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') requestClose();
  });
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const data = e.data;
    if (!data || data.source !== NS) return;
    if (data.type === 'focus') els.input.focus({ preventScroll: true });
    // Sayfadaki "Asistana sorun" düğmesi/formundan gelen soru doğrudan gönderilir.
    if (data.type === 'ask' && typeof data.text === 'string' && !state.busy) send(data.text.slice(0, MAX_CHARS));
  });
}

function init() {
  const saved = loadSaved();
  const paramLang = params.get('lang');
  const browserLang = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'tr';
  state.langChosen = Boolean(saved?.langChosen);
  state.lang =
    (state.langChosen && saved?.lang) ||
    (paramLang === 'en' || paramLang === 'tr' ? paramLang : null) ||
    saved?.lang ||
    browserLang;
  if (state.lang !== 'en') state.lang = 'tr';

  state.messages = (saved?.messages || []).filter(isValidMessage);
  if (!state.messages.length || state.messages.every((m) => m.local)) state.messages = [welcomeMessage()];

  document.body.classList.toggle('is-embedded', embedded);
  document.body.classList.toggle('is-standalone', !embedded);
  els.close.hidden = !embedded;

  bindEvents();
  applyStrings();
  renderAll();
  onInput();
  if (!embedded) els.input.focus();
}

init();
