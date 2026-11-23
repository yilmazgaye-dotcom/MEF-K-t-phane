// Tanıtım sayfası (index.html) için küçük yardımcılar.
(function () {
  'use strict';

  var snippet = '<script src="' + window.location.origin + '/widget.js" data-lang="auto" defer></script>';
  var code = document.getElementById('snippet');
  if (code) code.textContent = snippet;

  var copyBtn = document.getElementById('copy-snippet');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var done = function (ok) {
        copyBtn.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı';
        window.setTimeout(function () {
          copyBtn.textContent = 'Kopyala';
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(snippet).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  document.querySelectorAll('[data-open-assistant]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.MEFLibraryAssistant) window.MEFLibraryAssistant.open();
    });
  });
})();
