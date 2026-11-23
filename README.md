# MEF Kütüphane Sanal Asistanı 2.0

MEF Üniversitesi Kütüphanesi için yapay zekâ destekli, Türkçe ve İngilizce sohbet asistanı.
Herhangi bir web sitesine tek satır kodla eklenen, sağ alt köşeden açılan bir sohbet penceresi (widget) ve
OpenAI'a güvenli biçimde bağlanan küçük bir sunucu uç noktasından oluşur.

**Neler yapar?**

- Çalışma saatleri, üyelik, ödünç verme, ceza, rezerv, ILL, grup çalışma odaları, kampüs dışı erişim gibi
  kütüphane sorularını **yalnızca `knowledge/` klasöründeki bilgilere dayanarak** yanıtlar. Bilgi yoksa uydurmaz;
  Kütüphaneciye Sor formuna, e-postaya ve telefona yönlendirir.
- Kitap/makale aramalarında All in MEF (EBSCO) ve kütüphane kataloğu için **kodla üretilmiş** arama bağlantıları verir
  (model bağlantı uydurmaz, katalogda "var/yok" iddiasında bulunmaz).
- Mesajda DOI varsa meta veriyi Crossref'ten alır ve **APA 7 kaynakçayı kodla** oluşturur; tek tıkla (italikler
  korunarak) kopyalanır. Elle verilen bilgilerden de APA 7 kaynakça yazar, eksikleri işaretler.
- Akademik veri tabanı önerirken yalnızca kütüphanenin abone olduğu listeyi kullanır.

## Mimari

```
library.mef.edu.tr                       Vercel (bu proje)                         Dış servisler
┌─────────────────────┐   iframe   ┌──────────────────────────────┐
│ <script widget.js>  │ ─────────► │ /embed  (sohbet arayüzü)      │
│ sağ alttaki düğme   │            │   └─ fetch /api/chat ───────┐ │
└─────────────────────┘            │ /api/chat (Vercel Function) │ │──► OpenAI Responses API
                                   │   ├─ knowledge/*.md ◄───────┘ │──► Crossref (DOI → APA)
                                   │   └─ OPENAI_API_KEY (gizli)   │
                                   └──────────────────────────────┘
```

- **API anahtarı yalnızca sunucuda** (Vercel ortam değişkeni) durur. Tarayıcıya giden hiçbir dosyada yoktur.
- Sohbet arayüzü iframe içinde çalışır; kütüphane sitesinin stillerinden ve kodundan etkilenmez, onları etkilemez.
- Derleme adımı ve npm bağımlılığı **yoktur**: düz HTML/CSS/JavaScript + Node.js 22 (yerleşik `fetch`).
- Konuşmalar sunucuda saklanmaz; OpenAI'a `store: false` ile gönderilir. Kullanıcı mesajları kayıtlara yazılmaz.

## Klasör yapısı

```
api/chat.js            Sohbet uç noktası (akışlı NDJSON yanıt)
api/health.js          Kurulum kontrolü: /api/health
lib/                   Sunucu modülleri (OpenAI, güvenlik, bilgi tabanı, APA, Crossref, talimatlar)
knowledge/             ★ Kütüphane bilgileri — düzenlenebilir Markdown dosyaları (bkz. knowledge/_README.md)
public/widget.js       Sitelere eklenen gömme betiği
public/embed.html      Sohbet arayüzü (iframe içinde açılır; /embed adresinden tam ekran da çalışır)
public/index.html      Tanıtım ve deneme sayfası
public/js, public/css  Arayüz kodu ve stilleri
tests/                 Birim testleri (node --test)
scripts/               Bilgi tabanı denetimi
docs/                  Kütüphane web ekibi için entegrasyon rehberi
```

## Kurulum

### 1. OpenAI anahtarı (yeni ve ayrı)

1. <https://platform.openai.com> → **Projects** bölümünde bu asistan için ayrı bir proje oluşturun.
2. Projenin **Limits** ayarından aylık harcama limiti belirleyin.
3. Bu projede yeni bir API anahtarı oluşturun. Anahtarı hiçbir dosyaya yazmayın, e-postayla ya da sohbette paylaşmayın.

> ⚠️ Eski chatbotun (meflibrary.vercel.app) anahtarı tarayıcı kodunda açıkta duruyordu. O anahtar iptal
> edilmediyse OpenAI panelinden hemen iptal edin (revoke).

### 2. GitHub

1. GitHub'da yeni bir depo oluşturun (ör. `mef-kutuphane-asistani`; özel ya da açık).
2. Bu klasörün içeriğini depoya yükleyin (GitHub Desktop, `git` ya da web arayüzünden "Add file → Upload files").
3. Depo ayarlarında **Settings → Code security → Secret scanning / Push protection** seçeneklerini açın.
4. Her push ve PR'da GitHub Actions testleri ve bilgi tabanı denetimini otomatik çalıştırır (`.github/workflows/ci.yml`).

### 3. Vercel

1. <https://vercel.com/new> → GitHub deposunu içe aktarın. Framework Preset: **Other** (ayarlar `vercel.json`'dan okunur).
2. **Settings → Environment Variables** bölümüne ekleyin:

   | Değişken | Zorunlu | Açıklama |
   |---|---|---|
   | `OPENAI_API_KEY` | evet | OpenAI API anahtarı |
   | `OPENAI_MODEL` | hayır | Varsayılan `gpt-6.1-terra`. Daha düşük maliyet için `gpt-6-luna` |
   | `OPENAI_REASONING_EFFORT` | hayır | Varsayılan `low`. Akıl yürütme desteklemeyen bir model seçerseniz boş bırakın |
   | `OPENAI_MAX_OUTPUT_TOKENS` | hayır | Varsayılan `1500` |
   | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS` | hayır | IP başına sınır (varsayılan 5 dakikada 20 mesaj) |
   | `ALLOWED_ORIGINS` | hayır | Normalde boş. API'yi başka bir alan adından doğrudan çağıracaksanız virgülle ayrılmış liste |
   | `CROSSREF_MAILTO` | hayır | Crossref'e iletilecek kurumsal iletişim adresi |

3. İlk dağıtımdan sonra `https://PROJE-ADINIZ.vercel.app/api/health` adresini açın: `"ok": true` görmelisiniz.
4. **Önerilen:** Vercel → **Firewall** → yeni kural: `/api/chat` yoluna IP başına (ör. dakikada 10 istek) hız sınırı.
   Kod içindeki sınır her sunucu örneğinde ayrı sayıldığı için kesin koruma Firewall kuralıyla sağlanır.

### 4. Yayına alma akışı

- `main` dalına yapılan her birleştirme **canlı** sürümü günceller.
- Değişiklikleri ayrı bir dalda yapıp Pull Request açın: Vercel PR için ayrı bir **önizleme adresi** oluşturur,
  canlı sürüm etkilenmez. Önizlemede denedikten sonra birleştirin.

## Web sitesine ekleme

```html
<script src="https://PROJE-ADINIZ.vercel.app/widget.js" data-lang="auto" defer></script>
```

Ayrıntılar, seçenekler ve kütüphane web ekibine iletilecek adımlar: [docs/WIDGET-ENTEGRASYONU.md](docs/WIDGET-ENTEGRASYONU.md)

Widget yalnızca izin verilen sitelerde iframe içinde açılabilir. İzinli liste `vercel.json` içindeki
`/embed` başlığında `frame-ancestors` değeridir (varsayılan: `https://library.mef.edu.tr` ve `https://*.mef.edu.tr`).

## Bilgi tabanını güncelleme

Kütüphane bilgileri `knowledge/` klasöründeki Markdown dosyalarındadır; kod bilgisi gerekmez.
Kurallar için [knowledge/_README.md](knowledge/_README.md) dosyasına bakın.

> ⚠️ **Yayından önce doğrulanmalı:** Kütüphane sitesindeki bazı bilgiler birbiriyle çelişiyor. Bunlar dosyalarda
> `ÇELİŞKİ` / `DOĞRULANMADI` olarak işaretlendi; asistan bu konularda kesin değer vermek yerine kütüphaneye yönlendirir.
> - Çalışma saatleri: Türkçe sayfa hafta içi 08:30–22:00, İngilizce sayfa 08:30–17:00 (`02-calisma-saatleri.md`)
> - Ödünç adetleri ve süreleri: SSS (ör. lisans 30 kitap) ile Ödünç Verme Yönergesi (ör. lisans 20 kitap) farklı (`04-odunc-verme.md`)
> - Mezunların e-kaynak süresi: SSS 90 gün, yönerge tablosu 1–2 yıl (`03-uyelik-ve-kullanicilar.md`)
>
> `npm run check:knowledge` doğrulanması gereken dosyaları listeler.

## Yerel geliştirme (isteğe bağlı)

Gerekenler: [Node.js 22](https://nodejs.org) ve Vercel CLI (`npm i -g vercel`).

```bash
cp .env.example .env.local      # OPENAI_API_KEY değerini girin
vercel dev                      # http://localhost:3000
npm test                        # birim testleri
npm run check:syntax            # tarayıcı betiklerinin sözdizimi denetimi
npm run check:knowledge         # bilgi tabanı denetimi
```

## Güvenlik önlemleri

- API anahtarı yalnızca sunucuda; `/api/health` anahtarın kendisini değil, yalnızca tanımlı olup olmadığını gösterir.
- `/api/chat` yalnızca kendi alan adından gelen tarayıcı isteklerini kabul eder (Origin kontrolü).
- IP başına hız sınırı, mesaj başına 2000 karakter, en fazla 12 mesajlık geçmiş ve yanıt uzunluğu sınırı.
- Model yanıtları HTML olarak yorumlanmaz; yalnızca güvenli bir Markdown alt kümesi (`http(s)`/`mailto` bağlantıları) işlenir.
- Sıkı Content-Security-Policy: sayfalar yalnızca kendi alan adından betik/stil yükler; `/embed` yalnızca izinli sitelerde iframe içine alınabilir.
- Talimatlar, istem enjeksiyonuna ("önceki talimatları yok say" vb.) uymamasını ve kişisel bilgi istememesini söyler.
- OpenAI'a `store: false` gönderilir; sunucu kayıtlarına kullanıcı mesajı yazılmaz (KVKK açısından veri en aza indirilir).
  Kütüphane, kullanıcılara bir aydınlatma metni göstermek isterse `public/js/i18n.js` içindeki `disclaimer` metnine bağlantı eklenebilir.

## Sonraki adımlar (öneri)

- **Gerçek katalog araması:** VuFind'ın REST API'si (`/vufind/api/v1/search`) şu an "Permission denied" döndürüyor.
  Bilgi işlem birimi bu API'yi bu sunucu için açarsa asistan kitapların katalogda olup olmadığını doğrudan gösterebilir.
- Kullanım istatistikleri (anonim soru kategorileri) ve yanıt değerlendirme (👍/👎) için kalıcı bir depolama eklenebilir.

## Teşekkür

İlk sürüm (2024): Ramazan Çelik, Neslihan Erdoğan ve Gaye Yılmaz.
