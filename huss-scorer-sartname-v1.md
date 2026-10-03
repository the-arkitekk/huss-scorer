# HuSS Scorer: teknik şartname (v1)

Tarih: 4 Ekim 2026
Sahibi: Doç. Dr. Erdem Yıldırım (Dokuz Eylül Üniversitesi, Mimarlık Bölümü)
Bağlam: TÜBİTAK 3005-B başvurusu (proje no 1004794), HuSS protokol paketinin parçası

Bu belge Claude Code'a doğrudan verilmek üzere yazıldı. Metin Türkçedir; arayüz metinleri, dosya adları, sütun adları ve kod içi adlar İngilizcedir.

---

## 1. Amaç

HuSS (Human-Scaled Section; İnsan Ölçekli Kesit), bir mekânın ölçeğinin ne kadar doğru algılandığını ölçen bir çizim görevidir. Katılımcı önce 170 cm boyunda ayakta bir insan figürü çizer, sonra bakış yönündeki kesiti karşı duvara kadar bellekten çizer. Cetvel yoktur; ölçek figürden türetilir.

HuSS Scorer, taranmış HuSS çizimlerini yarı otomatik ölçen bir web aracıdır: araç önerir, ölçümcü onaylar ya da düzeltir. Amaç, ölçümün başka araştırmacılarca da aynı kurallarla yinelenebilmesidir.

Hesap:

- `scale = figure_mm / ref_height_m` (ref_height_m varsayılan 1,70)
- `est_m = measured_mm / scale`
- `E = (est_m - true_m) / true_m`

İki eksen ölçülür: düşey (tavan yüksekliği, birincil) ve yatay (figürden karşı duvara uzaklık, ikincil).

## 2. Değişmez kısıtlar

1. Sunucusuz, statik, tek sayfalık web aracı. GitHub deposu, GitHub Pages yayını, sürümler Zenodo DOI ile arşivlenir.
2. Görüntüler ve veriler kullanıcının bilgisayarından çıkmaz. Sayfa yüklendikten sonra hiçbir ağ isteği yapılmaz. Analitik, dış yazı tipi, CDN yok.
3. Yalın JavaScript, HTML, CSS. Çatı (React, Vue vb.) yok, derleme adımı yok. OpenCV.js yok.
4. Dış bağımlılık yalnızca iki küçük kütüphane: QR okuma ve QR üretme. İkisi de `vendor/` klasörüne sabit sürümle kopyalanır, lisans dosyalarıyla birlikte. (Aday: jsQR ve qrcode-generator. Kopyalamadan önce güncel lisans ve bakım durumu doğrulanır; MIT ile uyumlu olmalıdır.)
5. Araç hem GitHub Pages'te hem de indirilen klasördeki `index.html` çift tıklanarak (`file://`) çalışır. Bu nedenle ES module `import` kullanılmaz; betikler klasik `<script>` ile yüklenir ve tek bir `HUSS` ad alanına bağlanır. Mantık dosyaları Node altında da test edilebilecek biçimde yazılır.
6. Güncel Chrome, Edge, Firefox ve Safari (masaüstü) desteklenir. Tarayıcıya özgü API (File System Access vb.) kullanılmaz.
7. Dosya adlarına anlam yüklenmez. Girdi "bir klasör görüntü"dür; kaydın anahtarı QR'dan okunan sayfa kodudur.
8. Arayüz yalnızca İngilizce. Bütün arayüz metinleri tek dosyada (`js/strings.en.js`) tutulur; ileride Türkçe eklenebilmelidir.
9. Makine öğrenmesi yok. Bütün algılama, açıklanabilir ve sabit kurallı görüntü işlemedir.
10. Lisans: kod MIT; belgeler ve kâğıt şablonu CC BY 4.0. Yazar: Erdem Yıldırım.

## 3. Kapsam (v1)

- Proje dosyası oluşturma ve yükleme
- Kâğıt üretici (kodlu ve QR'lı çizim kâğıdı; A4 ve A3; kalibrasyon sayfası)
- Klasör yükleme (JPEG, PNG), QR okuma, elle kod girişi
- Köşe işaretlerinden otomatik hizalama, elle hizalama yedeği
- Kırmızı figürden baş ve ayak önerisi
- Tavan ve karşı duvar için otomatik öneri
- Eksene kilitli tutamaçlar, snap, yakınlaştırma, kaydırma, klavye
- Bayraklar, dışlama kutuları, not alanı
- Kör mod ve açık mod
- Tarayıcıda otomatik kayıt, CSV ile sürdürme, Excel için indirme
- Birleştirme (anahtar tablosu ve gerçek ölçülerle E hesabı)
- Karşılaştırma (iki ölçümcü, salt okunur) ve alt örneklem listesi
- Belgeler, testler, R betiği

Kapsam dışı (v2) listesi 14. bölümdedir.

## 4. Çizim kâğıdı şablonu

Koordinatlar mm, başlangıç noktası sayfanın sol üst köşesi, x sağa, y aşağı. Kâğıt yatay kullanılır.

### 4.1 A4L (297 x 210)

| Öğe | Tanım |
|---|---|
| Köşe işaretleri | 4 adet dolu siyah kare, 5 x 5 mm; merkezleri (10,10), (287,10), (10,200), (287,200) |
| Zemin çizgisi | y = 180; x = 8'den 289'a; kalınlık 0,35 mm; siyah |
| Başlangıç işareti | Çizginin altında dolu üçgen; tepe (40, 180,4), taban (38, 184,4)-(42, 184,4) |
| İşaret yazısı | Sol kenar x = 45, taban çizgisi y = 185,5; 8 pt; metin proje dosyasından (varsayılan "figure") |
| QR | 15 x 15 mm; sol üst (262, 185) |
| Sayfa kodu (okunur) | Tek aralıklı yazı, 12 pt; sağa dayalı, sağ kenar x = 257, taban çizgisi y = 196 |
| Şablon kimliği | "HuSS A4L v1", 6 pt; x = 18, taban çizgisi y = 201 |

### 4.2 A3L (420 x 297)

| Öğe | Tanım |
|---|---|
| Köşe işaretleri | 5 x 5 mm; merkezleri (10,10), (410,10), (10,287), (410,287) |
| Zemin çizgisi | y = 255; x = 8'den 412'ye; kalınlık 0,35 mm |
| Başlangıç işareti | Tepe (57, 255,4), taban (55, 259,4)-(59, 259,4) |
| İşaret yazısı | x = 62, taban çizgisi y = 260,5 |
| QR | 15 x 15 mm; sol üst (385, 262) |
| Sayfa kodu | Sağ kenar x = 380, taban çizgisi y = 273 |
| Şablon kimliği | "HuSS A3L v1"; x = 18, taban çizgisi y = 288 |

### 4.3 Kurallar

- Zemin çizgisinin üstüne, iki üst köşe işareti dışında hiçbir şey basılmaz.
- Ön yüzde katılımcı, yapı, koşul, tarih ya da uygulayıcı bilgisi yer almaz. Arka yüz boştur; katılımcı kodu oraya elle yazılır ve taranmaz.
- Kâğıtta ölçü çubuğu ya da cetvel benzeri hiçbir öğe bulunmaz.
- Baskı yalnızca siyah. Kırmızı baskı kullanılmaz.

### 4.4 Sayfa kodu ve QR

- Sayfa kodu 5 karakterdir: 4 rastgele karakter ve 1 denetim karakteri.
- Alfabe (31 karakter): `23456789ABCDEFGHJKLMNPQRTUVWXYZ` (0, 1, I, O, S yok).
- Denetim karakteri: `A[(1*v1 + 2*v2 + 3*v3 + 4*v4) mod 31]`; `v` karakterin alfabedeki sırası (0 tabanlı).
- QR içeriği: `HUSS1/<TEMPLATE>/<SHEETCODE>`, örnek biçim `HUSS1/A4L/XXXXX`. Hata düzeltme düzeyi M ya da üstü.

## 5. Dosyalar ve veri modeli

### 5.1 Proje dosyası (`<project_code>.huss.json`)

Proje sahibi bir kez oluşturur ve ölçümcülere gönderir. Kişisel veri içermez.

```json
{
  "format": "huss-project",
  "format_version": 1,
  "project_code": "VR3005",
  "title": "…",
  "template": "A4L",
  "sheet_label": "figür",
  "ref_height_m": 1.70,
  "min_figure_mm": 10,
  "foot_tolerance_mm": 0.5,
  "snap_radius_mm": 1.5,
  "suggestions": { "figure": true, "ceiling": true, "wall": true },
  "exclusion_criteria": [
    { "id": "excl_no_figure", "label": "Figure not drawn" },
    { "id": "excl_not_standing_full", "label": "Figure not standing or not full height" },
    { "id": "excl_not_along_axis", "label": "Section not drawn along the viewing axis" }
  ],
  "rules_version": "1.0",
  "created_at": "2026-10-04T00:00:00+03:00"
}
```

### 5.2 Ölçüm dosyası (CSV)

- Bir satır = bir ölçümcünün bir çizimi. Yalnızca durumu `measured`, `excluded` ya da `deferred` olan çizimler yazılır.
- UTF-8 (BOM yok), virgül ayraç, nokta ondalık, başlık satırı var. Mantıksal değerler 0/1, eksik değer boş.
- Bu dosya aynı zamanda oturum dosyasıdır: araca geri yüklenince bütün tutamaçlar ve işaretler geri gelir.
- Dosya adı: `<project_code>_<rater_code>_<mode>_<YYYYMMDD-HHMM>.csv`
- Yuvarlama: mm 0,01; metre 0,001; E 0,0001.

Sütunlar:

| Grup | Sütun | Açıklama |
|---|---|---|
| Kimlik | `project_code`, `sheet_code`, `rater_code` | |
| | `mode` | `blind` ya da `open` |
| | `status` | `measured`, `excluded`, `deferred` |
| | `measured_at` | ISO 8601, saat dilimiyle |
| | `duration_s` | Çizimde geçen süre |
| | `tool_version`, `rules_version`, `template` | |
| | `file_name`, `image_width_px`, `image_height_px` | |
| | `code_source` | `qr` ya da `manual` |
| Hizalama | `align_method` | `auto`, `manual_corners`, `manual_floorline` |
| | `px_per_mm_x`, `px_per_mm_y`, `rotation_deg`, `align_residual_mm` | |
| | `corner_tl_x_px`, `corner_tl_y_px`, `corner_tr_*`, `corner_bl_*`, `corner_br_*` | Köşe merkezleri, özgün görüntüde |
| | `floor_y_mm`, `floor_slope` | Zemin çizgisinin eksendeki konumu ve eğimi |
| Tutamaçlar (sayfa, mm) | `axis_x_mm`, `head_y_mm`, `foot_y_mm`, `ceiling_y_mm`, `wall_x_mm` | |
| Tutamaçlar (özgün görüntü, px) | `head_x_px`, `head_y_px`, `foot_*`, `floor_*`, `ceiling_*`, `wall_*` | ImageJ ile çapraz denetim için |
| Yerleştirme | `head_placement`, `foot_placement`, `ceiling_placement`, `wall_placement` | `suggested`, `snapped`, `manual` |
| | `axis_placement` | `auto` ya da `manual` |
| Öneriler | `head_suggested_y_mm`, `foot_suggested_y_mm`, `ceiling_suggested_y_mm`, `wall_suggested_x_mm` | Aracın ilk önerisi; yoksa boş |
| Hesaplanan | `figure_mm` | Ayak tabanından baş üstüne (birincil) |
| | `figure_from_floor_mm` | Zemin çizgisinden baş üstüne (duyarlılık analizi) |
| | `foot_floor_gap_mm` | İşaretli; artı = ayak çizginin üstünde |
| | `ceiling_mm`, `distance_mm` | |
| | `ref_height_m`, `scale_mm_per_m` | |
| | `est_vertical_m`, `est_horizontal_m` | Birincil kuralla |
| | `est_vertical_alt_m`, `est_horizontal_alt_m` | `figure_from_floor_mm` ile |
| Bayraklar | `flag_red_not_found`, `flag_figure_small`, `flag_figure_off_mark`, `flag_foot_off_floor`, `flag_multiple_red`, `flag_axis_moved`, `flag_manual_alignment`, `flag_alignment_warning` | Araç koyar |
| | `flag_color_noncompliant` | Ölçümcü işaretler: figür rengi yönergeye uymadı |
| Dışlama | `vertical_not_measurable`, `horizontal_not_measurable` | Eksen bazında |
| | `excl_no_figure`, `excl_not_standing_full`, `excl_not_along_axis`, `excl_other` | Proje dosyasındaki ölçütler |
| | `excluded` | Herhangi bir `excl_*` işaretliyse 1 |
| | `note` | Serbest metin |
| Birleştirme sonrası | `participant_code`, `structure_code`, `true_vertical_m`, `true_horizontal_m` | |
| | `E_vertical`, `E_horizontal`, `E_vertical_alt`, `E_horizontal_alt` | |
| | `key_*` | Anahtar tablosundaki ek sütunlar olduğu gibi aktarılır |

### 5.3 Excel görünümü

"Download for Excel" düğmesi aynı veriyi noktalı virgül ayraç, ondalık virgül ve UTF-8 BOM ile verir. Dosya adı `_excel-view.csv` ile biter. Bu dosya araca geri yüklenemez; yüklenmeye çalışılırsa açıklayıcı bir uyarı gösterilir.

### 5.4 Diğer tablolar

- Anahtar tablosu (CSV): `sheet_code, participant_code, structure_code` ve isteğe bağlı ek sütunlar.
- Yapılar tablosu (CSV ya da araçtaki form): `structure_code, structure_name, true_vertical_m, true_horizontal_m`.
- Alt örneklem listesi (TXT ya da CSV): her satırda bir sayfa kodu.
- Kâğıt üreticinin kod listesi (CSV): `sheet_code, template, generated_at`.
- Karşılaştırma çıktısı (CSV, geniş biçim): her satır bir çizim; iki ölçümcünün değerleri `_r1` ve `_r2` sonekleriyle.

### 5.5 Otomatik kayıt

Her onaydan ve her tutamaç değişikliğinden sonra oturum durumu `localStorage`'a yazılır (anahtar: proje kodu, ölçümcü kodu, mod). Görüntüler saklanmaz. Bu yalnızca çökme sigortasıdır; asıl kayıt indirilen CSV'dir. İndirilmemiş değişiklik varken sayfa kapatılırsa uyarı verilir.

## 6. Puanlama kuralları (rules_version 1.0)

1. Çizgilerde (zemin, tavan, karşı duvar) çizginin ortası ölçülür.
2. Figür boyu ayak tabanından baş üstüne ölçülür. Baş üstü, kırmızı izin en üst noktasıdır.
3. Ayak tabanı: kırmızı izin en alt noktası zemin çizgisinin ortasına `foot_tolerance_mm` (0,5) içinde ise ayak tabanı zemin çizgisidir. Değilse ayak tabanı kırmızı izin en alt noktasıdır ve `flag_foot_off_floor` konur.
4. Tavan yüksekliği zemin çizgisinden tavana, figürün düşey ekseni üzerinde ölçülür. Tavan düz değilse ölçülen yer figürün tam üstüdür.
5. Yatay uzaklık, figürün düşey ekseninden karşı duvara, zemin çizgisi boyunca ölçülür.
6. Düşey eksen figürün ortasından geçer. Figür başlangıç işaretinden 5 mm'den fazla kaymışsa `flag_figure_off_mark` konur; eksen yine figürü izler.
7. Çift çizgi ya da düzeltme izi varsa figüre yakın olan (iç yüz) çizgi ölçülür. Son karar ölçümcünündür.
8. Figürün üstünde tavan çizgisi yoksa düşey eksen ölçülemedi olarak işaretlenir; karşı duvar çizilmemişse ya da sayfadan taşmışsa yatay eksen ölçülemedi olarak işaretlenir.
9. Kırmızı figür bulunamazsa ölçümcü baş ve ayak noktasını elle koyar; çizim dışlanmaz, bayraklanır.
10. Küçük figür (`figure_mm < min_figure_mm`) dışlama nedeni değildir, bayraktır.

## 7. Algoritma adımları

Bütün eşikler `js/config.js` içinde adlandırılmış sabitlerdir. Aşağıdaki sayılar başlangıç değerleridir; ayar setiyle ayarlanır ve geçerlemeden önce dondurulur.

### 7.1 Görüntüyü açma

1. Dosya `createImageBitmap` ile açılır; EXIF yönü uygulanır.
2. Aynı anda yalnızca etkin görüntü bellekte tutulur.

### 7.2 Köşe işaretleri ve yön

1. Görüntünün küçültülmüş (uzun kenar yaklaşık 1000 px) gri kopyası Otsu eşiğiyle ikiliye çevrilir.
2. Bağlı bileşenler bulunur. Aday: en-boy oranı 0,7 ile 1,4 arası, doluluk 0,8 ve üstü, boyutu şablondaki 5 mm ile uyumlu.
3. Her çeyrekte beklenen köşe konumuna en yakın aday seçilir. Merkez, tam çözünürlükte koyu piksellerin ağırlık merkeziyle alt piksel duyarlığında bulunur.
4. Yön (0, 90, 180, 270 derece): her olası yön için homografi kurulur ve beklenen zemin çizgisi boyunca örnekleme yapılır. Koyu örnek oranı en yüksek olan (en az 0,6) yön seçilir. Eşitlikte QR'ın beklenen yerde okunması belirleyicidir.
5. Dört köşeden DLT ile homografi hesaplanır (görüntü px, sayfa mm).
6. Nitelik denetimi: aynı noktalara benzerlik dönüşümü oturtulur; en büyük artık `align_residual_mm` olarak yazılır. 0,5 mm'yi aşarsa `flag_alignment_warning`.

### 7.3 Düzeltilmiş görüntü

Sayfa, sabit çözünürlükte (R px/mm) çift doğrusal örneklemeyle yeniden oluşturulur. R, özgün çözünürlüğün yuvarlanmış değeridir (300 DPI için 12), 8 ile 24 arasında sınırlanır ve toplam 40 megapikseli aşmayacak biçimde düşürülür. Bütün algılama ve gösterim bu görüntü üzerinde yapılır; ölçümler mm olarak tutulur. Özgün görüntü px koordinatları ters homografiyle hesaplanır.

### 7.4 Zemin çizgisinin ince ayarı

Her 1 mm'lik x adımında, beklenen y çevresinde (artı eksi 1,5 mm) koyu izin yoğunluk ağırlıklı merkezi bulunur. Aykırı değerler atılarak doğru oturtulur. Çıktı: `floor_y(x)`. Oturtma başarısızsa şablondaki y kullanılır ve `flag_alignment_warning` konur.

### 7.5 Elle hizalama (yedek)

- Tercih edilen: ölçümcü dört köşe işaretinin merkezini yakınlaştırarak tıklar (`manual_corners`).
- Köşe işareti eksikse: zemin çizgisinin iki ucunu tıklar; benzerlik dönüşümü kurulur (`manual_floorline`).
- İkisinde de `flag_manual_alignment` konur.

### 7.6 QR

Düzeltilmiş görüntüde QR'ın beklenen bölgesi kırpılıp okunur; olmazsa bütün görüntü denenir. Okunamazsa ölçümcü kodu elle yazar; denetim karakteri doğrulanır. Şablon proje dosyasıyla uyuşmuyorsa uyarı verilir. Aynı sayfa kodu iki dosyada görülürse uyarı verilir ve ölçümcü hangisinin kullanılacağını seçer.

### 7.7 Kırmızı figür

1. Arama bölgesi: başlangıç işaretinin x'i çevresinde artı eksi 20 mm; y, üst kenar boşluğundan zemin çizgisinin 8 mm altına kadar.
2. Pikseller sRGB'den CIELAB'a (D65) çevrilir.
3. Kırmızı maskesi: `a* >= T_a`, kroma `C* >= T_c`, ton açısı -30 ile 60 derece arası. Başlangıç: `T_c = 25`; `T_a`, bölgede `a* > 5` olan piksellerin Otsu eşiği, en az 15.
4. 0,3 mm yarıçaplı kapama uygulanır; alanı 0,5 mm²'den küçük bileşenler atılır.
5. 1,5 mm'lik genişletmeyle birbirine bağlanan bileşenler tek küme sayılır. En büyük küme figürdür. Benzer büyüklükte ikinci bir küme varsa `flag_multiple_red`.
6. Küme yoksa ya da yüksekliği 3 mm'den azsa `flag_red_not_found`.
7. `head_y`: kümede en az 2 maske pikseli olan en üst satır. Ham ayak: kümenin en alt satırı. `axis_x`: kümenin x ağırlık merkezi.
8. Ayak kuralı 6. bölümdeki 3. maddeye göre uygulanır.

### 7.8 Koyuluk profili ve snap

- Koyuluk = 255 eksi parlaklık (0,299R + 0,587G + 0,114B). Kırmızı maskedeki pikseller zemin rengi sayılır.
- Tavan profili: `axis_x` çevresinde artı eksi 1,5 mm'lik bandın her y için ortalama koyuluğu.
- Duvar profili: zemin çizgisinin 1 ile 6 mm üstündeki bandın her x için ortalama koyuluğu.
- Profil 0,1 mm sigma ile yumuşatılır. Tepe: belirginliği en az 6 gri düzey ve arama penceresindeki en büyük belirginliğin en az %20'si olan yerel en büyük.
- Çizgi ortası: tepenin yarı belirginlik üstündeki bölümünün yoğunluk ağırlıklı merkezi.
- Tutamaç bırakıldığında `snap_radius_mm` içindeki en yakın tepeye atlar (`snapped`). Tepe yoksa bırakıldığı yerde kalır (`manual`). Alt tuşu basılıyken snap kapalıdır.
- Baş ve ayak tutamaçları aynı mantıkla kırmızı maskenin üst ve alt kenarına yapışır.

### 7.9 Otomatik öneri

Proje dosyasındaki `suggestions` ile açılıp kapatılabilir.

- Tavan: baş üstünün 1 mm yukarısından başlayarak yukarı doğru ilk tepe. Koşul: aynı y'de, eksenden sağa doğru 10 mm'lik parçanın en az %60'ı koyu olmalı (yatay süreklilik). Koşulu sağlayan tepe yoksa öneri yapılmaz.
- Karşı duvar: figürün sağındaki tepeler arasından, zeminden yukarı sürekli uzunluğu tavan yüksekliğinin en az %50'si olan (tavan bilinmiyorsa en az 10 mm) en sağdaki tepe. Solunda 6 mm içinde aynı koşulu sağlayan başka bir tepe varsa o seçilir (çift çizgili duvarın iç yüzü).
- Öneri yapılamayan tutamaç "yerleştirilmedi" durumunda gösterilir; ölçümcü yerleştirmeden ya da ekseni ölçülemedi olarak işaretlemeden onaylayamaz.
- Önerilen tutamaçlar, ölçümcü dokunana ya da onaylayana kadar kesikli çizgiyle gösterilir. İlk öneri her zaman CSV'ye yazılır (`*_suggested_*`).

### 7.10 Hesap

```
figure_mm            = foot_y - head_y
figure_from_floor_mm = floor_y(axis_x) - head_y
foot_floor_gap_mm    = floor_y(axis_x) - foot_y
ceiling_mm           = floor_y(axis_x) - ceiling_y
distance_mm          = wall_x - axis_x
scale_mm_per_m       = figure_mm / ref_height_m
est_vertical_m       = ceiling_mm  / scale_mm_per_m
est_horizontal_m     = distance_mm / scale_mm_per_m
flag_figure_small    = figure_mm < min_figure_mm
```

`*_alt` değerleri aynı formülle, `figure_from_floor_mm` kullanılarak hesaplanır. Birleştirmeden sonra `E = (est - true) / true`.

## 8. Ekranlar ve etkileşimler

### 8.1 Start

- "Load project file" ya da "New project".
- Rater code (zorunlu).
- Mode: Blind ya da Open. Oturum içinde değiştirilemez; değiştirmek için yeni oturum başlatılır.
- Görüntü klasörü: klasör seçme, sürükle bırak ve çoklu dosya seçme.
- İsteğe bağlı: önceki ölçüm CSV'si (sürdürme), alt örneklem listesi.
- Yalnızca Open modda: anahtar tablosu ve yapılar tablosu.
- Otomatik kayıt bulunursa: "Rater AB, 87 of 240 done. Resume?"
- Alt örneklem listesi yüklenirse kuyruk yalnızca listedeki kodlarla sınırlanır; klasörde bulunamayan kodlar bildirilir.

### 8.2 New project

5.1'deki alanlar için form. Çıktı: proje dosyasının indirilmesi.

### 8.3 Sheet generator

- Girdi: adet, şablon (A4L, A3L), işaret yazısı, isteğe bağlı "bu kodları kullanma" listesi.
- Çıktı: her sayfada bir kâğıt olan yazdırma görünümü (SVG, mm birimli; `@page` boyutu şablona göre, kenar boşluğu 0) ve kod listesi CSV'si.
- Ekranda uyarı: "Print at 100% (actual size), not fit to page."
- Kalibrasyon sayfası seçeneği: şablona, ölçüleri bilinen bilgisayar çizimi bir kırmızı figür ve kesit basar (figür boyu 10, 15 ve 25 mm sürümleri). Bilinen değerler sayfa koduyla birlikte ayrı bir CSV'de verilir.

### 8.4 Scoring

Yerleşim: solda büyük çizim alanı, sağda dar panel.

Çizim alanı:
- Düzeltilmiş görüntü; tekerlekle yakınlaştırma, boşluk tuşu ve sürüklemeyle kaydırma, "fit" düğmesi.
- Beş denetim: baş, ayak, tavan (üçü düşey eksende yalnızca dikey hareket eder), karşı duvar (zemin çizgisinde yalnızca yatay hareket eder), eksen tutacağı (ekseni yatay kaydırır; elle oynatılırsa `flag_axis_moved`).
- Ayak tutamacı varsayılan olarak kilitlidir; ölçümcü kilidi açarak taşır.
- Kılavuz çizgileri (eksen ve zemin) 1 px inceliğinde ve yarı saydamdır; H tuşuyla gizlenir.
- Sürükleme sırasında etkin tutamacın çevresini 4 kat büyüten bir büyüteç gösterilir.

Sağ panel:
- Sayfa kodu ve ilerleme ("87 / 240").
- Bayraklar (araç koyar, salt okunur) ve `flag_color_noncompliant` kutusu.
- Dışlama kutuları, eksen bazında "not measurable" kutuları, not alanı.
- Düğmeler: Confirm and next, Previous, Review later.
- Görünüm: contrast boost, show red mask, snap on/off.
- Open modda ek olarak: dosya adı, yapı adı, `est_*` ve `E_*` değerleri.

Blind modda dosya adı, yapı bilgisi ve hesaplanan sayılar gösterilmez. Anahtar ve yapılar tablosu yüklenemez.

Sıra: çizimler her iki modda sayfa koduna göre artan sırada gösterilir.

Onay koşulu: `measured` durumu için baş ve ayak yerleştirilmiş, her eksen için tutamaç yerleştirilmiş ya da "not measurable" işaretlenmiş olmalıdır. Herhangi bir dışlama kutusu işaretliyse durum `excluded` olur ve tutamaç zorunlu değildir.

Klavye:

| Tuş | İşlev |
|---|---|
| Enter | Onayla ve sonraki |
| Shift+Enter | Önceki |
| D | Sonra bak |
| 1, 2, 3, 4 | Baş, ayak, tavan, duvar tutamacını seç |
| Ok tuşları | Seçili tutamacı 0,05 mm kaydır (Shift ile 0,5 mm) |
| + / - / 0 | Yakınlaştır, uzaklaştır, sığdır |
| C / R / H | Kontrast, kırmızı maske, kılavuz çizgileri |
| Alt (basılı) | Snap kapalı |

### 8.5 Export

- "Download CSV" (oturum dosyası) ve "Download for Excel".
- Her 20 onayda bir ve oturum sonunda indirme hatırlatması.

### 8.6 Merge

- Girdi: bir ya da daha çok ölçüm CSV'si, anahtar tablosu, yapılar tablosu.
- İşlem: `sheet_code` üzerinden eşleştirme, gerçek ölçülerin eklenmesi, `E_*` hesabı.
- Çıktı: birleştirilmiş CSV ve rapor (eşleşmeyen kodlar, yinelenen kodlar, eksik yapı).

### 8.7 Compare

- Girdi: aynı proje koduna ait, farklı ölçümcü kodlu iki ölçüm CSV'si (tercihen birleştirilmiş).
- Ekran salt okunurdur; hiçbir değer düzeltilemez.
- Tablo: her çizim için iki ölçümcünün `est_*` ve varsa `E_*` değerleri, farklar, dışlama ve "not measurable" kararları yan yana.
- Özet: eşleşen ve eşleşmeyen sayısı, farkların ortalaması ve standart sapması, dışlama kararlarında uyuşan sayısı. ICC ve kappa araçta hesaplanmaz.
- Çıktı: geniş biçimli CSV.

### 8.8 Guide ve About

Kullanım kılavuzu, puanlama kuralları, nasıl atıf yapılacağı, sürüm bilgisi, lisans.

## 9. Dosya yapısı

```
huss-scorer/
  index.html
  css/app.css
  js/
    app.js                 başlangıç ve ekran geçişi
    strings.en.js          bütün arayüz metinleri
    config.js              eşikler ve varsayılanlar
    io/        files.js  csv.js  project.js  autosave.js
    image/     decode.js  lab.js  components.js  homography.js  rectify.js
    detect/    corners.js  floorline.js  qr.js  redfigure.js  profile.js  snap.js  suggest.js
    measure/   compute.js  flags.js
    sheet/     template.js  code.js
    ui/        start.js  projectForm.js  sheetgen.js  scorer.js  canvasView.js
               handles.js  merge.js  compare.js  guide.js
  vendor/                  QR okuma ve üretme, lisanslarıyla
  docs/                    user-guide.md  scoring-rules.md  data-dictionary.md  validation-plan.md
  r/icc_kappa.R
  samples/                 örnek proje dosyası, örnek tablolar, sentetik sayfalar, kalibrasyon sayfası
  tests/
    unit/                  *.test.js
    synthetic/             generate.js ve beklenen değerler
  README.md  LICENSE  LICENSE-docs  CITATION.cff  CHANGELOG.md  .zenodo.json
  .github/workflows/       test.yml  pages.yml
```

`image/`, `detect/`, `measure/`, `sheet/` ve `io/csv.js` DOM'a dokunmaz; tipli diziler üzerinde çalışır ve Node'un yerleşik test çalıştırıcısıyla sınanır.

## 10. Kabul testleri

### 10.1 Birim testleri (her değişiklikte otomatik)

- Hesap: `figure_mm = 10`, `ceiling_mm = 94.118`, `distance_mm = 141.176` için `est_vertical_m = 16.000` ve `est_horizontal_m = 24.000` (tolerans 0,001). `true` 16 ve 24 iken E = 0.
- Hesap: `figure_mm = 20`, `ceiling_mm = 30` için `est_vertical_m = 2.550`; `true = 2.70` iken `E_vertical = -0.0556`.
- Ayak kuralı: fark 0,3 mm iken ayak = zemin, bayrak yok; fark 1,2 mm iken ayak = kırmızının alt noktası, bayrak var.
- Sayfa kodu: geçerli kod kabul edilir; tek karakter değişikliği ve komşu iki karakterin yer değiştirmesi reddedilir.
- Homografi: bilinen noktalarda gidiş dönüş hatası 1e-6'dan küçük.
- CSV: dışa aktar, geri yükle, durum birebir aynı. Notlarda virgül, tırnak ve satır sonu korunur. Excel görünümü geri yüklemede reddedilir.

### 10.2 Sentetik sayfalar

`tests/synthetic/generate.js` bilinen ölçülerle 300 DPI görüntüler üretir.

| Kod | Durum | Beklenen |
|---|---|---|
| S1 | Temiz | Bütün öneriler doğru |
| S2 | 2 derece eğik | Bütün öneriler doğru |
| S3 | 180 derece dönük | Yön düzeltilir |
| S4 | 90 derece dönük | Yön düzeltilir |
| S5 | Soluk kurşun kalem (gri düzeyi 180) | Öneriler ve snap çalışır |
| S6 | Kırmızı yok (figür gri) | `flag_red_not_found` |
| S7 | Figür işaretten 8 mm kaymış | Eksen figürü izler, bayrak |
| S8 | Figür 1,5 mm havada | Ayak = kırmızının alt noktası, bayrak |
| S9 | Çift çizgili duvar | İç yüz önerilir |
| S10 | Figürün üstünde tavan yok | Tavan önerisi yapılmaz |
| S11 | JPEG kalite 60 ve gürültü | Öneriler doğru |
| S12 | 600 DPI | Öneriler doğru |
| S13 | Figür 6 mm | `flag_figure_small` |
| S14 | Bir köşe işareti eksik | Elle hizalama istenir |
| S15 | A3L şablonu | Bütün öneriler doğru |

Ölçütler:
- Hizalama: bilinen noktalar 0,15 mm içinde.
- Baş ve ayak önerisi: 0,2 mm içinde.
- Snap ile yerleşen tavan ve duvar: 0,15 mm içinde.
- Tavan ve duvar otomatik önerisi (S1-S5, S9, S11, S12, S15): 0,3 mm içinde.
- `est_*` değerleri: bilinen değerin %1'i içinde.

### 10.3 Kalibrasyon sayfası (basılı ve taranmış)

10 kalibrasyon sayfası basılır, Epson L3250'de 300 DPI renkli JPEG olarak taranır ve araçla ölçülür. Ölçüt: uzunluklar bilinen değerden en çok 0,3 mm ya da %1 sapar (hangisi büyükse).

### 10.4 İş akışı senaryosu (elle)

1. Proje oluştur, 20 kâğıt üret.
2. 20 görüntülük klasörü Blind modda yükle, 10 çizimi ölç.
3. Sekmeyi kapat, yeniden aç: otomatik kayıt sürdürmeyi önerir, 10 ölçüm yerindedir.
4. CSV'yi indir; başka bir tarayıcıda CSV'yi ve klasörü yükle: aynı durum gelir.
5. Kalan 10 çizimi ölç; Merge ile E hesapla.
6. İkinci ölçümcü koduyla 5 çizimlik alt örneklem listesini ölç; Compare ile eşleştir.
7. Blind modda ekranda dosya adı, yapı ve sayı görünmediği doğrulanır.

### 10.5 Gizlilik, çevrimdışı çalışma, başarım

- Sayfa yüklendikten sonra ağ sekmesinde hiçbir istek görülmez.
- İndirilen klasörden `index.html` çift tıklanarak açıldığında 10.4 senaryosu çalışır.
- 300 DPI A4 bir görüntünün açılması, hizalanması ve önerilerin gelmesi sıradan bir dizüstü bilgisayarda 2 saniyeyi geçmez.
- 500 görüntülük klasör bellek sorunu çıkarmadan işlenir.

## 11. Geçerleme planı (araç dışı, belge olarak depoda)

`docs/validation-plan.md` şunları içerir:

- Ayar seti: yaklaşık 20 çizim (ekip ve gönüllüler). Eşikler bu setle ayarlanır, sonra dondurulur.
- Geçerleme seti: yaklaşık 30 pilot çizimi. Eşikler dondurulduktan sonra açılır.
- Aynı ölçümcü her çizimi araçla ve ImageJ/Fiji ile, aynı yazılı kuralla, en az bir hafta arayla ve farklı sırayla ölçer.
- Karşılaştırılan değer: iki eksende `est_*`, yüzde fark olarak.
- Kabul ölçütleri: ortalama fark artı eksi %1 içinde; Bland-Altman %95 uyum sınırları artı eksi %5 içinde; yöntemler arası ICC (mutlak uyum) .95 ve üzeri.
- Ek raporlananlar: çizim başına süre, elle hizalama ve bayrak oranı, önerilerin değiştirilmeden kabul edilme oranı.
- Ölçütler sağlanmazsa neden incelenir, düzeltilir ve yeni bir sette yinelenir. Yine sağlanmazsa ana ölçüm ImageJ/Fiji ile yapılır (B planı).

## 12. R betiği

`r/icc_kappa.R`, Compare ekranının geniş biçimli çıktısını okur ve şunları verir:
- `E_vertical` ve `E_horizontal` için ICC(2,1): iki yönlü rastgele etkiler, mutlak uyum, tek ölçüm, %95 güven aralığı (`irr::icc`, `model = "twoway"`, `type = "agreement"`, `unit = "single"`).
- Dışlama kararları için Cohen's kappa (`irr::kappa2`).

## 13. Geliştirme aşamaları

Sırayla ilerlenir; her aşamanın sonunda testler geçer ve çalışan bir sürüm yayımlanır.

**Aşama 1: çekirdek (prototip).** Tek görüntü açma, otomatik hizalama, düzeltilmiş görüntü, kırmızı figür önerisi, tutamaçlar, snap, hesap, tek satırlık CSV. Birim testleri ve S1-S8. Bitince başvuru için ekran görüntüsü alınabilir.

**Aşama 2: iş akışı.** Proje dosyası, klasör yükleme, QR, Blind ve Open mod, bayraklar ve dışlama, otomatik kayıt, CSV ile sürdürme, Excel görünümü, kâğıt üretici, tavan ve duvar otomatik önerisi, elle hizalama. S9-S15 ve 10.4 senaryosunun 1-4. adımları.

**Aşama 3: tamamlama.** Merge, Compare, alt örneklem listesi, kalibrasyon sayfası, belgeler, R betiği, GitHub Pages ve Zenodo ayarları, CITATION.cff. 10.3, 10.4 ve 10.5'in tamamı.

## 14. v2 listesi (v1'de yapılmaz)

- Telefon fotoğrafı desteği (perspektif düzeltme, ışık dengeleme)
- Türkçe arayüz
- Araç içinde ICC ve kappa hesabı, Bland-Altman grafiği
- PDF ve TIFF girişi
- Chrome ve Edge'de klasöre doğrudan kayıt
- Ek ölçüm eksenleri (örneğin ikinci kesit)

## 15. Açık konular (pilotta karara bağlanacak)

- Kâğıt boyutu: A4 varsayılandır. Pilotta sayfaya sığmayan ya da sıkıştırılmış çizim oranı belirgin çıkarsa bütün çizimler A3'e geçer. Yapıya göre farklı kâğıt kullanılmaz.
- Kırmızı kalemin kesin modeli (ince uçlu keçeli, yaklaşık 0,4 mm) ve buna göre kırmızı eşikleri.
- Yönergedeki alt sınır ("figür en az 1 cm") ve `min_figure_mm` değeri.
- CITATION.cff içindeki ORCID ve kurum bilgisi yazar tarafından doldurulur. Başvuru henüz desteklenmediği için destek beyanı boş bırakılır.
