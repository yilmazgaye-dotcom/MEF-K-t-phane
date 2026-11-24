# library.mef.edu.tr — Sanal Asistan widget entegrasyonu

Bu belge, kütüphane web sitesini yöneten ekip (Digitexa & Aduket) için hazırlanmıştır.

## 1. Eklenecek kod

Asistanın şu anki adresi: **https://mef-k-t-phane.vercel.app**

Sitenin ortak şablonunda (layout), `</body>` etiketinden hemen önce **tek satır** ekleyin:

```html
<script src="https://mef-k-t-phane.vercel.app/widget.js" data-lang="auto" defer></script>
```

Next.js kullanılıyorsa `next/script` ile de eklenebilir:

```jsx
import Script from 'next/script';

<Script src="https://mef-k-t-phane.vercel.app/widget.js" data-lang="auto" strategy="afterInteractive" />
```

## 1a. Ana sayfadaki arama panelinde "Sanal Asistana Sor" düğmesi (kütüphanenin isteği)

Kütüphane, asistanın ana sayfadaki arama panelinin **sağ üst köşesinde** (All in MEF / Basılı Kitaplar /
Dergiler / MEF GCRIS sekmelerinin bulunduğu satırın sağında, arama düğmesinin üstünde) bir düğme olarak
görünmesini istiyor.

1. Yukarıdaki `<script>` satırı sitede bulunmalıdır. Sağ alttaki yuvarlak düğmenin görünmemesi
   isteniyorsa `data-launcher="false"` ekleyin:

   ```html
   <script src="https://mef-k-t-phane.vercel.app/widget.js" data-lang="auto" data-launcher="false" defer></script>
   ```

2. Arama panelindeki sekme satırının sonuna (sağa yaslı) şu düğmeyi ekleyin. `data-mef-assistant-open`
   özniteliği yeterlidir; ek JavaScript ya da `onclick` gerekmez. Sınıflar sitedeki sekme düğmeleriyle
   (Tailwind) aynı görünümü verir:

   ```html
   <button type="button" data-mef-assistant-open
           class="ml-auto inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition hover:bg-primary/90">
     <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8.4L4 21.5V18a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
     Sanal Asistana Sor
   </button>
   ```

   İngilizce sayfada metin `Ask the Virtual Assistant` olabilir.

3. İsteğe bağlı: aynı alana kısa bir soru kutusu da konabilir. Kullanıcı yazıp gönderdiğinde asistan
   açılır ve soruyu doğrudan yanıtlar:

   ```html
   <form data-mef-assistant-ask class="ml-auto flex gap-2">
     <input name="q" placeholder="Sanal asistana sorun…" class="h-9 rounded-lg border px-3 text-sm">
     <button class="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm">Sor</button>
   </form>
   ```

Mobilde (480 px ve altı) asistan tam ekran açılır; kapatma düğmesi sohbet başlığındadır.

## 2. Seçenekler

| Öznitelik | Değerler | Açıklama |
|---|---|---|
| `data-lang` | `auto` (varsayılan), `tr`, `en` | `auto`: önce `<html lang>`, sonra adresteki `/en/` yoluna bakar |
| `data-position` | `right` (varsayılan), `left` | Düğmenin köşesi |
| `data-open` | `true` | Sayfa açılınca sohbet açık gelir (ör. "Yardım" sayfası için) |
| `data-launcher` | `true` (varsayılan), `false` | `false`: sağ alttaki yuvarlak düğme gösterilmez |

Sayfadaki herhangi bir öğeden açmak için `data-mef-assistant-open` özniteliği yeterlidir. Özniteliğe bir
soru yazılırsa asistan açılır ve o soruyu doğrudan sorar:

```html
<a href="#" data-mef-assistant-open>Sanal asistana sor</a>
<button type="button" data-mef-assistant-open="Kütüphane çalışma saatleri nedir?">Çalışma saatleri</button>
```

JavaScript ile: `window.MEFLibraryAssistant.open()`, `.close()`, `.toggle()` ve `.ask('soru')`.

## 3. Teknik notlar

- Widget, sayfaya tek bir `<div data-mef-library-assistant>` ekler. Görünüm Shadow DOM içindedir;
  sitenin CSS'i etkilenmez. Sohbet, asistanın kendi alan adından yüklenen bir iframe içinde çalışır.
- Betik yaklaşık 10 KB'tır ve bağımlılığı yoktur. Sohbet iframe'i yalnızca düğmeye ilk tıklandığında yüklenir;
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
