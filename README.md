# PDF Assistant

PDF belgeleri hakkında kaynaklı cevaplar üretecek AI asistanı. Next.js ve TypeScript ile adım adım geliştiriliyor.

## İlk adım: PDF metni çıkarma

- Bir metin tabanlı PDF seçme (en fazla 10 MB / 100 sayfa).
- PDF.js ile her sayfanın metnini ayrı okuma.
- Sayfalar arasında geçiş yapma ve çıkarılan metni inceleme.
- Boş, bozuk, parola korumalı ve taranmış belgeler için açıklama.

Bu sürüm dosyayı yalnızca tarayıcı belleğinde işler; sunucuya yüklemez veya kalıcı olarak saklamaz. Sayfa yenilenince belge temizlenir. Henüz AI, soru-cevap, AWS veya OCR bağlantısı yoktur. Çok sütunlu PDF'lerde metin sırası değişebilir.

## Çalıştırma

Node.js 22.13+ veya 24 kullanın.

```bash
npm ci
npm run dev
```

Terminaldeki yerel adresi açın. `postinstall`, PDF.js worker dosyasını aynı paketten `public/` klasörüne kopyalar; harici bir CDN gerekmez.

```bash
npm run typecheck
npm run build
```

## Öğrenme akışı

1. PDF seç → metni çıkar → kaynak sayfasını koru. **Mevcut sürüm.**
2. Metni parçalara ayır → soruyla ilgili bölümleri bul.
3. İlgili bölümleri modele ver → cevabı kaynaklarıyla göster.
4. Dosyaları S3'e, AI işlemlerini Amazon Bedrock'a bağla.

`app/page.tsx`: yükleme ve metin görüntüleme ekranı.

`lib/pdf.ts`: PDF okuma, sınırlar ve sayfa bazlı metin çıkarma.

`scripts/copy-pdf-worker.mjs`: PDF.js worker kurulumu.

İleride kaynak göstermek için sayfa numarasını ilk adımdan itibaren metinle birlikte tutuyoruz. AI cevaplarını, belgede cevabı olan ve olmayan sorularla ayrıca değerlendireceğiz.
