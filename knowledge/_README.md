# Bilgi tabanı nasıl düzenlenir?

Asistan, kütüphaneye özgü sorulara **yalnızca bu klasördeki dosyalara** dayanarak yanıt verir.
Bir bilgi burada yoksa asistan "bilgim yok" der ve kullanıcıyı kütüphaneye yönlendirir.
Bu yüzden saatler, kurallar veya bağlantılar değiştiğinde ilgili dosyayı güncellemeniz yeterlidir.

## Kurallar

- Her konu ayrı bir `.md` dosyasıdır. `_` ile başlayan dosyalar (bu dosya gibi) asistana gönderilmez.
- Dosyanın başındaki `---` blokları arasındaki alanlar zorunludur:
  - `id`: kısa, benzersiz ad (ör. `saatler`)
  - `title`: başlık
  - `source`: bilginin alındığı sayfa(lar); birden fazlaysa boşlukla ayırın
  - `source_en`: (isteğe bağlı) İngilizce sayfa
  - `updated`: bilgiyi en son kontrol ettiğiniz tarih, `YYYY-AA-GG`
  - `order`: (isteğe bağlı) sıralama numarası
- İçerik sade Markdown'dır: başlıklar (`##`), madde işaretleri (`-`) ve bağlantılar (`[metin](adres)`).
- `<!-- ... -->` arasındaki notlar asistana **gönderilmez**; ekip içi notlar için kullanın.
- Kesin olmayan bir bilgiyi yazmayın. İki kaynak çelişiyorsa bölüme `ÇELİŞKİ` ya da `DOĞRULANMADI`
  yazın; asistan bu durumda tek bir değeri kesin bilgi gibi sunmaz.
- Bilgiyi her kontrol edişinizde `updated` tarihini güncelleyin. 180 günden eski dosyalar için
  `npm run check:knowledge` uyarı verir.

## Değişiklik nasıl yayına girer?

1. GitHub'da dosyayı düzenleyin (kalem simgesi) ve yeni bir dal + Pull Request ile kaydedin.
2. Vercel, PR için otomatik bir önizleme adresi oluşturur; asistanı orada deneyin.
3. PR `main` dalına birleştirildiğinde canlı sürüm güncellenir.
