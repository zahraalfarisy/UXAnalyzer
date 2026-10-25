# UX Analyzer

Webcam eye tracking dan mouse tracking untuk merekam sesi evaluasi UX.

## Menjalankan versi perbaikan

Gunakan terminal di folder repository ini. Buat virtual environment dengan Python yang kompatibel dengan MediaPipe, lalu:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

macOS / Linux:

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

EyeTrax akan mendownload `face_landmarker.task` pada penggunaan pertama. Izinkan akses webcam dan, jika dibutuhkan OS, mouse monitoring. Gunakan satu layar utama, resolusi dan display scaling yang sama selama calibration, validation, dan recording. Jangan pindah layar atau mengubah posisi webcam di tengah sesi. Multi-monitor dengan koordinat desktop berbeda belum divalidasi.

## Alur sesi

1. Face detection dan countdown.
2. Calibration 4x4: semua dots tetap terlihat. Fokus hanya pada dot hijau dengan pusat putih. Dots yang selesai berubah warna, bukan hilang. Waktu settling tidak menjadi training data.
3. Validation pada lima lokasi yang berbeda dari training grid. Data ini mengukur raw gaze error dan mengestimasi measurement noise Kalman; tidak melatih ulang regression model.
4. Preview dengan seluruh calibration dots tetap terlihat dan cursor gaze biru. Tidak ada data UX yang direkam pada tahap ini.
5. Tekan **Enter** di preview untuk mulai recording, **R** untuk calibration ulang, atau **Esc** untuk membatalkan. Recording tidak dimulai otomatis.
6. Setelah Enter, pindah ke website yang ingin diuji. Gaze dan mouse direkam bersama. Untuk berhenti, kembali ke terminal dan tekan **Ctrl+C**. Perpindahan window juga termasuk interaksi desktop yang direkam; recording ini belum memiliki penanda batas task website.

```bash
python main.py --grid-rows 5 --grid-cols 5 --settle 1.2 --capture 2 --ema-alpha 0.25
```

Untuk hanya merekam gaze:

```bash
python eyetrax/gaze_logger.py
```

Untuk memuat model lokal tepercaya, gunakan `--model-file path/to/gaze_model.pkl`. Model yang dimuat tetap melalui validation dan preview. Default selalu melakukan calibration baru. Model pickle harus berasal dari sumber yang dipercaya.

## Output

Setiap sesi memiliki folder baru di `data/sessions/<session_id>/`:

| File | Isi |
| --- | --- |
| `gaze_log.csv` | Timestamp, gaze_x, gaze_y yang valid, setelah filtering. Kompatibel dengan loader fusion lama. |
| `gaze_quality.csv` | Raw dan filtered gaze per frame, status valid, alasan blink/no_face/off_screen/nonfinite. |
| `mouse_session.json` | Mouse move, click, dan scroll; timestamp detik, struktur events/ts/meta. Dibuat dalam mode gaze + mouse. |
| `calibration_report.json` | Konfigurasi, raw validation error, per-target error, noise covariance, valid frame ratio. |
| `gaze_model.pkl` | Model hasil calibration sesi ini. |
| `friction_events.json` | Kandidat dari heuristic rage click dan gaze-mouse mismatch yang sudah ada, dengan pairing timestamp terdekat. Dibuat setelah mode gaze + mouse selesai normal/Ctrl+C. |

Data recording tidak mencakup video webcam. Output sesi tidak ditambahkan ke git.

### Playback melalui web app

Record pada web app menyimpan video layar utama sebagai `screen.mp4` (H.264), gaze, dan mouse dalam satu folder sesi. Buka Results → pilih sesi → Playback untuk memutar, pause, seek, dan melihat titik gaze hijau serta cursor/klik oranye sesuai waktu video. Klik penanda friction di bawah video untuk melompat ke kejadian tersebut. Tab Heatmap memakai screenshot statis per tampilan halaman, dengan gaze digabung dari semua kunjungan ke tampilan yang cocok. Smoothing Gaussian tetap (radius 90px), tanpa kontrol kustom. Pilih thumbnail halaman dan unduh screenshot beserta heatmap melalui Download PNG. Screenshot dibuat dari rekaman tersimpan saat tab dibuka, lalu disimpan di `page_snapshots/` agar sesi lama juga didukung. Pengelompokan visual bukan identifikasi URL/DOM; posisi scroll berbeda dapat menjadi screenshot terpisah. Tampilan kurang dari 0,75 detik diabaikan untuk mengurangi screenshot transisi.

Setelah memperbarui aplikasi, restart backend dan frontend agar proxy `/data` aktif. Tunggu indikator frame kamera dan valid gaze muncul sebelum memulai tugas. Jika gaze tetap 0, halaman detail menampilkan penyebab tracking gagal; rekaman lama tanpa sampel gaze tidak bisa dipulihkan menjadi data gaze. Untuk akurasi, gunakan resolusi layar dan posisi kamera yang sama dengan saat kalibrasi. Perekaman web memakai kalibrasi terakhir jika tersedia.

Tes playback tanpa kamera: `python -m unittest discover -s tests -p test_session_playback.py -v` dan `node --test frontend/src/components/playbackTimeline.test.js`.

## Apa yang diperbaiki

- Persistent calibration dots dengan satu active target; titik yang selesai tetap terlihat.
- Minimal 10 valid samples per target, maksimal dua kali retry jika data kurang. Jika tetap gagal, calibration berhenti dengan pesan error, bukan melatih model pada grid yang tidak lengkap.
- Settling terpisah dari capture; frame blink, no face, atau nonfinite tidak digunakan untuk training.
- Camera dan window dibersihkan saat calibration dibatalkan atau gagal.
- Fine tuning Kalman memakai variasi gaze **di dalam tiap target**, setelah mean masing-masing target dikurangi. Jarak antar-target dan systematic bias tidak dihitung sebagai noise.
- Kalman menggunakan hasil `correct()` untuk frame saat ini, bukan prediction sebelum correction.
- Smoother direset ketika valid tracking kembali setelah gap lebih dari 250 ms, agar fixation sebelumnya tidak terbawa. Raw gaze di luar layar tidak dipaksa ke pinggir layar.
- Entry point utama yang sebelumnya memanggil path mouse tracker yang tidak ada diganti dengan satu recording flow. Calibration dan OpenCV UI berjalan di main thread; mouse listener baru dimulai setelah preview diterima.

## Menilai akurasi

`mean_error_px` dan `p90_error_px` mengukur jarak raw prediction ke validation target. Nilai lebih kecil berarti hasil lebih dekat ke target. Angka ini belum membuktikan akurasi pada semua posisi dan kondisi penggunaan. Filter noise diestimasi pada pass validation yang sama, sehingga laporan ini bukan evaluasi independen untuk filtered output.

Kalman dan EMA dapat mengurangi jitter, tetapi tidak menghilangkan systematic bias. `ema-alpha` di implementasi ini merupakan bobot output sebelumnya: semakin besar nilainya, semakin kuat smoothing dan semakin besar lag. Mulai dari 0.25, lalu bandingkan beberapa sesi dengan posisi kepala dan pencahayaan yang sama.

Jika error masih besar, lakukan calibration ulang dengan posisi kepala stabil, pencahayaan merata, dan kamera sejajar wajah. Coba capture lebih lama atau grid 5x5, kemudian bandingkan validation error. Grid lebih padat dan capture lebih lama belum tentu meningkatkan akurasi pada semua pengguna.

Heuristic gaze-mouse mismatch saat ini memakai threshold 150 px. Jika validation error mendekati atau melebihi nilai itu, interpretasi kandidat mismatch perlu ditinjau. Kandidat friction bukan diagnosis kebingungan pengguna. Implementasi ini belum mengubah threshold menjadi threshold tervalidasi, belum menambah rekomendasi UI, dan belum menghubungkan gaze ke DOM/viewport website.

## Verifikasi

```bash
python -m pip install pytest
python -m pytest -q
```

Automated tests mencakup noise covariance, posterior Kalman, reset EMA, persistent dots, validation error, grid alignment, calibration cancellation, insufficient samples, validation tanpa training, preview handoff, kualitas frame, dan pembatalan sebelum recording. Webcam, fullscreen, dan akurasi pada perangkat pengguna tetap perlu diuji langsung.
