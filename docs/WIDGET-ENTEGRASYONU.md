# library.mef.edu.tr — Sanal Asistan widget entegrasyonu

Bu belge, kütüphane web sitesini yöneten ekip (Digitexa & Aduket) için hazırlanmıştır.

## 1. Eklenecek kod

Sitenin ortak şablonunda (layout), `</body>` etiketinden hemen önce **tek satır** ekleyin:

```html
<script src="https://PROJE-ADINIZ.vercel.app/widget.js" data-lang="auto" defer></script>
```

`PROJE-ADINIZ.vercel.app` yerine asistanın yayınlandığı adres yazılır (kütüphane ekibi iletecek).
Next.js kullanılıyorsa `next/script` ile de eklenebilir:

```jsx
import Script from 'next/script';

<Script src="https://PROJE-ADINIZ.vercel.app/widget.js" data-lang="auto" strategy="afterInteractive" />
```

## 2. Seçenekler

| Öznitelik | Değerler | Açıklama |
|---|---|---|
| `data-lang` | `auto` (varsayılan), `tr`, `en` | `auto`: önce `<html lang>`, sonra adresteki `/en/` yoluna bakar |
| `data-position` | `right` (varsayılan), `left` | Düğmenin köşesi |
| `data-open` | `true` | Sayfa açılınca sohbet açık gelir (ör. "Yardım" sayfası için) |

Sayfadaki herhangi bir bağlantı ya da düğmeden açmak için:

```html
<button type="button" onclick="window.MEFLibraryAssistant && window.MEFLibraryAssistant.open()">Sanal asistana sor</button>
```

`window.MEFLibraryAssistant` nesnesinde `open()`, `close()` ve `toggle()` yöntemleri vardır.

## 3. Teknik notlar

- Widget, sayfaya tek bir `<div data-mef-library-assistant>` ekler. Görünüm Shadow DOM içindedir;
  sitenin CSS'i etkilenmez. Sohbet, asistanın kendi alan adından yüklenen bir iframe içinde çalışır.
- Betik yaklaşık 7 KB'tır ve bağımlılığı yoktur. Sohbet iframe'i yalnızca düğmeye ilk tıklandığında yüklenir;
  sayfa açılış hızını etkilemez.
- `z-index: 2147483000` kullanır. Sitede sağ alt köşede başka bir sabit öğe (çerez bildirimi vb.) varsa
  `data-position="left"` kullanılabilir.
- Mobilde (480 px ve altı) sohbet tam ekran açılır.
- API anahtarı veya kişisel veri bu betikte bulunmaz.

## 4. İçerik Güvenliği Politikası (CSP)

Sitede CSP başlığı kullanılıyorsa şu kaynaklara izin verilmelidir:

```
script-src  ... https://PROJE-ADINIZ.vercel.app
frame-src   ... https://PROJE-ADINIZ.vercel.app
```

Asistan tarafında, `/embed` sayfasının yalnızca `https://library.mef.edu.tr` ve `https://*.mef.edu.tr`
içinde iframe olarak açılmasına izin verilir. Başka bir alan adında (ör. test sunucusu) denemek için
asistan deposundaki `vercel.json` dosyasında `frame-ancestors` değerine o adres eklenmelidir.

## 5. Kontrol listesi

- [ ] Widget kodu önce test/önizleme ortamına eklendi.
- [ ] Sağ alttaki düğme görünüyor ve sohbet açılıyor (masaüstü ve mobil).
- [ ] Türkçe sayfada Türkçe, `/en/` sayfalarında İngilizce açılıyor.
- [ ] Çerez bildirimi veya diğer sabit öğelerle çakışma yok.
- [ ] Canlı siteye ekleme için kütüphane onayı alındı.
