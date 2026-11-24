# Hazır yanıtlar nasıl düzenlenir?

OpenAI anahtarı tanımlı **değilken** asistan bu klasördeki hazır yanıtlarla çalışır: kullanıcının
mesajındaki kelimeleri `anahtar:` satırlarıyla karşılaştırır ve en çok eşleşen yanıtı gösterir.
Eşleşme yoksa uydurmaz; kullanıcıyı Kütüphaneciye Sor formuna, e-postaya ve telefona yönlendirir.
(Anahtar tanımlandığında yapay zekâ modu, bir üst klasördeki bilgi dosyalarını kullanır. Bir bilgi
değiştiğinde iki yeri de güncelleyin.)

## Biçim

```
## kisa-kimlik
anahtar: kelime, başka kelime, iki kelimelik ifade, english word
kaynak: Sayfa adı | https://library.mef.edu.tr/tr/...
source: Page name | https://library.mef.edu.tr/en/...

### TR
Türkçe yanıt (Markdown: **kalın**, - madde, [bağlantı](https://...)).

### EN
English answer.
```

- `## ` ile başlayan her başlık bir yanıttır; başlık metni benzersiz bir kimlik olmalıdır.
- `anahtar:` virgülle ayrılmış kelimelerdir. Türkçe karakterler ve büyük/küçük harf fark etmez
  (ö = o, ş = s). 4 harf ve üzeri kelimeler ek alabilir: `saat` → "saatleri", "saatler"i de yakalar.
  3 harf ve altı kelimeler (ör. `ill`, `apa`) yalnızca tam kelime olarak eşleşir.
  İki ve daha fazla kelimelik ifadeler iki kat puan alır; daha belirleyici olduğu için tercih edin.
- `kaynak:` / `source:` isteğe bağlıdır; yanıtın sonuna "Kaynak: ..." bağlantısı ekler.
- Dosyalar ad sırasıyla okunur. İki yanıt aynı puanı alırsa önce gelen kazanır; bu yüzden genel
  sohbet yanıtları (selamlama vb.) `99-` ile başlayan dosyadadır.
- `<!-- ... -->` arasındaki notlar kullanıcıya gösterilmez.
- `npm run check:knowledge` eksik TR/EN yanıtlarını ve hatalı adresleri bulur; `tests/rules.test.js`
  örnek soruların doğru yanıtla eşleştiğini denetler. Yeni bir yanıt eklerseniz oraya da bir örnek soru ekleyin.
