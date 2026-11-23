/*!
 * MEF Kütüphane Sanal Asistanı — gömme betiği (widget) v2.0
 *
 * Kullanım (sayfanın </body> etiketinden hemen önce):
 *   <script src="https://ALAN-ADINIZ/widget.js" data-lang="auto" defer></script>
 *
 * Seçenekler (data-* öznitelikleri):
 *   data-lang      "auto" (varsayılan; sayfanın lang özniteliğine ve /en/ yoluna bakar), "tr" veya "en"
 *   data-position  "right" (varsayılan) veya "left"
 *   data-open      "true" ise sayfa açılınca sohbet açık gelir
 *
 * JavaScript API: window.MEFLibraryAssistant.open() / .close() / .toggle()
 *
 * Güvenlik: Bu betik API anahtarı içermez. Sohbet, asistanın kendi alan adından yüklenen bir
 * iframe içinde çalışır; sitenizin stilleri ve kodu etkilenmez.
 */
(function () {
  'use strict';

  if (window.MEFLibraryAssistant) return;

  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll('script[src*="widget.js"]');
    script = candidates[candidates.length - 1];
  }
  if (!script || !script.src) return;

  var BASE = new URL(script.src, window.location.href).origin;
  var NS = 'mef-library-assistant';
  var data = script.dataset || {};
  var position = data.position === 'left' ? 'left' : 'right';
  var lang = resolveLang(data.lang);

  var LABELS = {
    tr: { open: 'Kütüphane asistanını aç', close: 'Kütüphane asistanını kapat', title: 'MEF Kütüphane Sanal Asistanı' },
    en: { open: 'Open the library assistant', close: 'Close the library assistant', title: 'MEF Library Virtual Assistant' }
  };
  var L = LABELS[lang];

  function resolveLang(value) {
    if (value === 'tr' || value === 'en') return value;
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.indexOf('en') === 0) return 'en';
    if (htmlLang.indexOf('tr') === 0) return 'tr';
    return /(^|\/)en(\/|$)/.test(window.location.pathname) ? 'en' : 'tr';
  }

  var ICON_CHAT =
    '<svg class="icon-chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8.4L4 21.5V18a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6.5A1.5 1.5 0 1 0 7 12.5 1.5 1.5 0 0 0 7 9.5zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';
  var ICON_CLOSE =
    '<svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>';

  var CSS = [
    ':host{all:initial}',
    '.wrap{position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}',
    '.wrap.pos-left{right:auto;left:20px}',
    '.launcher{width:60px;height:60px;border:0;border-radius:50%;background:#e02433;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .2s ease,background .2s ease}',
    '.launcher:hover{transform:scale(1.05);background:#c81d2b}',
    '.launcher:focus-visible{outline:3px solid #00266b;outline-offset:3px}',
    '.launcher svg{width:28px;height:28px}',
    '.launcher .icon-close{display:none}',
    '.is-open .launcher .icon-chat{display:none}',
    '.is-open .launcher .icon-close{display:block}',
    '.panel{position:absolute;bottom:76px;right:0;width:380px;height:min(640px,calc(100vh - 120px));background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25);animation:pop .18s ease-out}',
    '.pos-left .panel{right:auto;left:0}',
    '.panel[hidden]{display:none}',
    '.panel iframe{display:block;width:100%;height:100%;border:0}',
    '@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}',
    '@media (max-width:480px){.panel{position:fixed;inset:0;width:100%;height:100%;border-radius:0;bottom:0}.is-open .launcher{display:none}}',
    '@media (prefers-reduced-motion:reduce){.panel{animation:none}.launcher{transition:none}}'
  ].join('\n');

  function applyStyles(root, css) {
    try {
      if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype) {
        var sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
        return;
      }
    } catch (e) {
      // eski tarayıcı; <style> ile devam et
    }
    var style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }

  var host = document.createElement('div');
  host.setAttribute('data-' + NS, '');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  applyStyles(root, CSS);

  var wrap = document.createElement('div');
  wrap.className = 'wrap pos-' + position;

  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', L.title);
  panel.hidden = true;

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'launcher';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', L.open);
  button.title = L.title;
  button.innerHTML = ICON_CHAT + ICON_CLOSE;

  wrap.appendChild(panel);
  wrap.appendChild(button);
  root.appendChild(wrap);

  var iframe = null;
  var isOpen = false;
  var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 480px)') : null;
  var savedOverflow = '';

  function post(message) {
    if (!iframe || !iframe.contentWindow) return;
    message.source = NS;
    iframe.contentWindow.postMessage(message, BASE);
  }

  function ensureFrame() {
    if (iframe) return;
    iframe = document.createElement('iframe');
    iframe.src = BASE + '/embed?embedded=1&lang=' + encodeURIComponent(lang);
    iframe.title = L.title;
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.addEventListener('load', function () {
      if (isOpen) post({ type: 'focus' });
    });
    panel.appendChild(iframe);
  }

  function lockScroll(lock) {
    if (!mobileQuery || !mobileQuery.matches) return;
    var docEl = document.documentElement;
    if (lock) {
      savedOverflow = docEl.style.overflow;
      docEl.style.overflow = 'hidden';
    } else {
      docEl.style.overflow = savedOverflow;
    }
  }

  function open() {
    if (isOpen) return;
    ensureFrame();
    isOpen = true;
    panel.hidden = false;
    wrap.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', L.close);
    lockScroll(true);
    post({ type: 'focus' });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    wrap.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', L.open);
    lockScroll(false);
    button.focus();
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  button.addEventListener('click', toggle);

  window.addEventListener('message', function (event) {
    if (event.origin !== BASE || !iframe || event.source !== iframe.contentWindow) return;
    var msg = event.data;
    if (!msg || msg.source !== NS) return;
    if (msg.type === 'close') close();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen) close();
  });

  function mount() {
    (document.body || document.documentElement).appendChild(host);
    if (data.open === 'true') open();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  window.MEFLibraryAssistant = { open: open, close: close, toggle: toggle, version: '2.0.0' };
})();
