# HuSS Scorer şartnamesi: v1.1 için değişiklik taslağı

Bu dosya, geliştirme sırasında birlikte verdiğimiz kararları şartnameye işlemek için hazırlanmış bir taslaktır. Asıl şartname (`huss-scorer-sartname-v1.md`) değiştirilmedi. Onaylarsanız aşağıdaki metinler ilgili bölümlere işlenir ve sürüm v1.1 olur.

Her maddede önce **neden** (kısaca), sonra **önerilen metin** var.

---

## 2. Değişmez kısıtlar

**Madde 4 (dış bağımlılık).** Neden: jsQR 2021'den beri bakımsız; geleceğe dayanıklı ve bağımlılıksız bir yol seçtiniz.

> 4. Dış bağımlılık yoktur. QR kodu (sürüm 1, hata düzeltme düzeyi Q) üretme ve okuma, basılı kodu okuma ve rapor grafikleri araçla birlikte yazılmıştır. `vendor/` klasörü kullanılmaz.

## 3. Kapsam (v1)

Eklenecek maddeler:

> - Tables ekranı: yapılar tablosu ve anahtar tablosunun araç içinde girilmesi
> - QR okunamazsa basılı sayfa kodunun karakterlerden okunması
> - Results ekranı: birleştirme ve grafikli rapor (özet kartları, grafikler, tablolar; SVG, PNG, PDF, HTML çıktı)
> - Kalibrasyon sayfası ve kalibrasyon denetimi
> - İki ölçümcü uyumunun betimleyici grafiği (Bland-Altman biçiminde)

## 4. Çizim kâğıdı şablonu

**4.x Zemin taraması (yeni).** Neden: kesitte zeminin alışılmış gösterimi; cetvel gibi sayılmasın diye düzensiz.

> Zemin çizgisinin altında, çizgiden 0,7 mm boşlukla başlayan kısa "/" çizgileri bulunur. Aralık, eğim ve derinlik hafifçe düzensizdir (sabit tohum, her kâğıtta aynı); başlangıç işareti ve etiketi çevresinde kesilir. Etiket ("figure") başlangıç üçgeninin altında, ortalanmış durur.

**4.4 Sayfa kodu ve QR.**

> QR içeriği `HUSS1/<ŞABLON>/<SAYFAKODU>`; sürüm 1, düzey Q, 15 mm'lik karede 4 modül sessiz bölge. Sayfa kodu QR'ın solunda Courier 12 pt ile basılıdır; QR okunamazsa araç bu karakterleri okur.

**4.x Yapı kutuları (yeni).** Neden: hangi kâğıdın hangi yapıya ait olduğu sonradan elle eşleştirilmesin. Arka yüze bir şey basılmaz, çünkü taranınca hafifçe belli oluyor (önceki taslaktaki arka yüz seçeneği kaldırıldı).

> Projede iki ya da daha çok yapı varsa (en çok 16) her kâğıdın ön yüzünde, zemin taramasının altında, yapı başına bir kutu (4,5 mm) bulunur; altında yapı kodu yazar, solunda "structure". Tek yapılı projede kutu basılmaz. Masa koordinatörü katılımcının çizdiği yapının kutusunu işaretler (çarpı, tik ya da karalama). Araç kutuları tarama hizalandıktan sonra okur: tek kutu belirgin biçimde işaretliyse yapı odur; hiç işaret yoksa ya da birden çok kutu benzer biçimde işaretliyse yapı boş kalır ve `flag_structure_mark` konur. Blind modda kutular ekranda kapatılır; Open modda okunan yapı gösterilir ve ölçümcü düzeltebilir.

## 5. Dosyalar ve veri modeli

**5.2 Ölçüm dosyası.** Eklenen ve değişen sütunlar (ayrıntı: `docs/data-dictionary.md`):

> - `code_source`: `qr`, `ocr` (basılı karakterler) ya da `manual`.
> - `structure_mark` (kutudan okunan ya da Open modda seçilen yapı kodu), `structure_mark_source` (`mark` ya da `rater`).
> - `align_method`: `auto`, `auto_three_corners`, `manual_corners`, `manual_floorline`.
> - Önerilerin ilk konumu: `head_suggested_y_mm`, `foot_suggested_y_mm`, `ceiling_suggested_y_mm`, `wall_suggested_x_mm` (tutamaç duyarlığında).
> - Yedek değerler: `red_bottom_y_mm`, `figure_red_mm`, `est_vertical_red_m`, `est_horizontal_red_m` (kırmızının en alt noktası); `ceiling_at_axis_y_mm`, `wall_at_floor_x_mm`, `est_vertical_at_axis_m`, `est_horizontal_at_floor_m` (kurallar 1.2 noktaları); `ceiling_spread_mm`, `wall_spread_mm`.
> - Bayraklar: `flag_ceiling_uneven`, `flag_wall_uneven`, `flag_structure_mark`.

**5.4 Diğer tablolar.** Eklenecekler:

> - Kalibrasyon anahtarı (CSV): `sheet_code, layout, figure_mm, ceiling_mm, distance_mm, template, generated_at`.
> - Anahtar tablosunda katılımcı kodu isteğe bağlıdır; bir satırda katılımcı ya da yapıdan en az biri bulunur. Anahtardaki yapı kutudakinin yerine geçer.
> - Birleştirmede yapı sırası: anahtar tablosu, kâğıttaki kutu, projenin tek yapısı (`structure_source`: `key`, `mark`, `rater`, `project`). Anahtar ile kutu farklıysa veri denetiminde listelenir.
> - Birleştirilmiş CSV'nin ek sütunları: `participant_code, structure_code, structure_source, structure_name, true_vertical_m, true_horizontal_m, E_vertical, E_horizontal`, yedek E sütunları, `source_file`, anahtarın ek sütunları (`key_*`).

## 6. Puanlama kuralları (rules_version 1.3)

Neden: Kural 3'te havada ya da zeminin altına taşan figür; kural 4–5'te serbest el çizgisinin eğikliği ve titremesi. Gerçek tavan düz, gerçek duvar dik ve gerçek değer tek bir sayı olduğu için çizginin tek bir noktası elin hatasını taşır.

> 3. Ayak tabanı her zaman zemin çizgisidir: figür baş üstünden zemin çizgisine ölçülür (figür havada da olsa, ayaklar çizginin altına taşsa da). Kırmızı iz çizgiden `foot_tolerance_mm` (proje ayarı; varsayılan 4 mm) fazla uzakta biterse `flag_foot_off_floor` konur. Kırmızının en alt noktası ve ona göre ölçülen değerler yedek sütunlarda tutulur.
>
> 4. Tavan yüksekliği zemin çizgisinden tavana ölçülür. Tavan, çizgisinin figür ekseninden karşı duvarın 1 mm öncesine kadar olan kısmının **ortalamasıdır** (karşı duvar yoksa çizginin gittiği yere kadar). Tavan figürün üstüne kadar uzanmıyorsa (yalnızca figür ile duvar arasında çizilmişse) başladığı yerden itibaren ortalanır. Kural 8: yalnızca hiç tavan çizgisi yoksa düşey eksen ölçülemez sayılır. Her sütunda çizginin ortası alınır; köşeye bitişik son 1 mm alınmaz.
>
> 5. Yatay uzaklık figürün düşey ekseninden karşı duvara ölçülür. Duvar, çizgisinin zeminin 1 mm üstünden tavanın 1 mm altına kadar olan kısmının **ortalamasıdır**.
>
> Çizgi ortalamasından 5 mm'den fazla saparsa `flag_ceiling_uneven` ya da `flag_wall_uneven` konur. Eksen üstündeki tavan noktası ve zemindeki duvar noktası (kurallar 1.2) yedek sütunlarda tutulur.

## 7. Algoritma adımları

**7.2 Köşe işaretleri.** Neden: yırtık ya da lekeli tek köşe yüzünden elle hizalama gerekmesin.

> Tek bir köşe işareti bulunamazsa yeri diğer üçünden tamamlanır (paralelkenar). Koşul: üç işaret dik açı (±1,5°) ve kâğıdın en-boy oranını (±%3) vermelidir. Yöntem `auto_three_corners` olarak yazılır; bayrak konmaz.

**7.2 Yön bulma (ek).** Neden: hafif eğri basılmış ya da taranmış bir kâğıtta zemin çizgisi beklenen yerin birkaç onda bir milimetre yanında kalabiliyor; araç bu yüzden yönü bulamayıp elle hizalama istiyordu.

> Yön seçilirken zemin çizgisi beklenen yerin 0,6 mm altında ya da üstünde de aranır (zemin taraması çizginin 0,7 mm altından başladığı için onunla karışmaz).

**7.5 Elle hizalama.** Neden: ölçümcü normalde köşelere hiç dokunmasın.

> Elle hizalama yalnızca iki ya da daha çok köşe işareti bulunamadığında kendiliğinden açılır. İki yol vardır: dört köşe karesine sırası önemsiz tıklama (her tıklama karenin ortasına oturtulur, yön otomatik bulunur) ya da zemin çizgisinin iki ucu (üçgen tarafındaki uç önce; QR ters sırayı düzeltir). Normal ekranda "elle hizala" düğmesi yoktur.

**7.6 QR.**

> QR, hizalanmış sayfada bilinen yerinde, 10 mm yarıçaplı bir arama içinde okunur. Okunamazsa basılı 5 karakter okunur: her karakter saklı Courier ve Courier New örnekleriyle karşılaştırılır; denetim karakteri olası okumalar arasından seçer. Okuma ancak denetim karakterini geçiyor ve geçen başka her okumadan açıkça iyiyse kabul edilir; kesin okunan dört karakter varken tek kayıp karakter denetim karakterinden bulunur. Aksi halde kod önerilmez.

**7.7 Kırmızı figür.**

> Kırmızı figür başlangıç işaretinin 35 mm yakınında aranır (v1: 20 mm).

**7.8 ve 7.9 Snap ve otomatik öneri.**

> Tavan ve duvar tutamacı, ortalaması bırakılan yerin `snap_radius_mm` yakınındaki çizgiye, o çizginin ortalamasına oturur. Çizgi sütun sütun (tavan) ya da satır satır (duvar) izlenir: 1 mm'ye kadar kesintiler atlanır; başka bir çizgiye çarpınca ya da 45°'den fazla dönünce (köşe) durulur. Tavan önerisinde 10 mm'lik süreklilik koşulu, dalgalı bir çizgi bu 10 mm'nin en az %60'ında izlenebiliyorsa da sağlanmış sayılır. Biri taşınınca öteki (önerilmiş ya da çizgiye oturmuşsa) yeniden ortalanır.

## 5.1 Proje dosyası

Neden: gerçek ölçüleri proje başında bir kez girmek; tek yapılı çalışmada anahtar tablosu gerekmesin.

> Biçim sürümü 2. Yeni alan `structures`: `[{ code, name, true_vertical_m, true_horizontal_m }]` (en çok 16; kod büyük harf, rakam, tire; en az bir gerçek ölçü). Projede tek yapı varsa her kâğıt o yapıya aittir; birden çok yapıda yapı kâğıttaki kutudan okunur. Anahtar tablosu yalnızca katılımcı kodları ve düzeltmeler için gerekir. Biçim 1 dosyalar yapısız olarak açılır. Proje dosyası ölçümcülere de gider; Blind mod gerçek ölçüleri ölçüm sırasında hiç göstermez.

## 8. Ekranlar

> - **Açılış menüsü (8.1 yerine):** New project, Open project file, Continue (bu tarayıcıdaki son proje); bağlantılar: Try without a project, Calibration test, Guide. Proje içinde üst çubukta New project sekmesi yoktur; sol üstteki "HuSS Scorer" menüyü açar (Back to it, Edit project).
> - **Tables:** yalnızca anahtar tablosu; yapılar projede. Yapı açılır listeden seçilir. Results, yapısı bilinmeyen kâğıtları tek düğmeyle buraya ekler.
> - **Calibration test (menüden):** kalibrasyon sayfalarını basma, anahtar ve denetim tek ekranda; yazıcı ve tarayıcı başına bir kez.
> - **Results:** o oturumda ölçülen çizimler kendiliğinden gelir; birleştirme (8.6) ve rapor: özet kartları; yapı başına hata, tahmin–gerçek, yükseklik hatası–derinlik hatası, dağılımlar; puanlama kalitesi (değiştirilmeden kabul edilen öneriler, bayraklar, kod kaynağı, hizalama, süre); tablolar; ölçümcü ve değer seçimi; SVG, PNG, PDF ve tek dosyalık HTML çıktı.
> - **Compare (8.7):** ek olarak iki eksen için betimleyici uyum grafiği (ortalamaya karşı fark, %95 uyum sınırları). ICC ve kappa yine R'de.
> - **Score:** alt örneklem listesi yükleme; eksik alanların kırmızı vurgusu. Taramaları açan düğmeler ölçümcü kodu ve mod seçilmeden kilitlidir; üzerine gelince eksikler yazılır. "Basılı kodla aynı" onayı yalnızca QR'dan okunmayan kodlarda istenir ve "Confirm and next" düğmesinin hemen üstündedir. Previous, bu oturumda bakılan çizimlere sırayla geri gider.
> - **Kuyruk (8.4):** kodu okunamayan tarama sona değil, klasörde kendinden önceki taramanın arkasına girer. Kuyruk bitince "Review later" ile ayrılan çizimlere dönüldüğü ekranda yazılır.

## 10. Kabul testleri

**10.2 Sentetik sayfalar.** S10 değişir: tavan figürün sağında başlıyor; öneri o çizgiye, başladığı yerden ortalanarak yapılır. Eklenecekler:

> S16 (eğik ve dalgalı tavan ve duvar; öneri gerçek ortalamaya 0,3 mm içinde), S17 (belirgin eğik tavan; bayrak), C1 ve C10 (kalibrasyon sayfası; uzunluklar 0,3 mm ya da %1 içinde), T1 (180° dönüşte yön belirsizliği; QR karar verir). S14: tek köşe eksik sayfa artık otomatik hizalanır; iki köşe eksikse elle hizalama istenir.

**10.3 Kalibrasyon sayfası.**

> Kalibrasyon sayfaları açılış menüsündeki Calibration test ekranından basılır (on düzen; kırmızı figür, tavan ve duvar bilinen ölçülerde). Taranıp normal ölçülür; aynı ekran her uzunluğu kalibrasyon anahtarıyla karşılaştırır. Yazıcı ve tarayıcı başına bir kez yapılır.

## 14. v2 listesi

> "Bland-Altman grafiği" v1'e alınmıştır (betimleyici). Araç içinde ICC ve kappa hesabı v2'de kalır.

## 15. Açık konular

> - `foot_tolerance_mm`: varsayılan 4 mm (3. denemede serbest çizimler zeminin 0–3 mm üstünde bitti, bilerek havada çizilen 5,8 mm).
> - `flag_*_uneven` eşiği: 5 mm (denemelerde serbest tavanlar 2–4 mm saptı).
