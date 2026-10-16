# Website Katalog Buku Siswa — SMAN 1 Sekayam

Aplikasi katalog buku publik khusus siswa SMAN 1 Sekayam. Dibangun menggunakan teknologi **Vanilla HTML, CSS, dan JavaScript murni** tanpa framework atau build tool tambahan, sesuai dengan dokumen `DESIGN.md` dan `Revision.md`.

## Fitur Utama

- **Akses Bebas Tanpa Login:** Siswa dapat langsung mencari buku dan lokasi rak tanpa perlu akun.
- **Baca-Saja (Read-Only):** Tidak mengekspos data pribadi siswa, riwayat peminjaman, denda, atau akun petugas.
- **Pencarian Cepat & Filter:**
  - Pencarian fleksibel berdasarkan judul, pengarang, ISBN, atau kategori.
  - Filter kategori dinamis dengan jumlah eksemplar.
  - Filter hanya yang tersedia di rak dan filter lokasi rak.
- **Informasi Ketersediaan Snapshot:** Menampilkan jumlah eksemplar tersedia berdasarkan publikasi katalog terakhir dari sistem pengelolaan perpustakaan.
- **Pemberitahuan Waktu & Katalog Usang:** Memberi tahu siswa tanggal dan jam data katalog diperbarui, serta menandai jika data belum diperbarui lebih dari 24 jam.
- **Modal Detail Lengkap:** Menampilkan informasi buku, lokasi rak, sinopsis, dan panduan tata cara peminjaman di meja petugas perpustakaan.
- **Kesesuaian Desain Penuh:**
  - Mengikuti token warna dan tipografi `DESIGN.md` (Navy `#172146`, Hijau Daun `#2b6032`, Plus Jakarta Sans, Lora).
  - Kepadatan publik: font 18px (`text-base`), kontrol minimal 48px.
  - Responsif mulai dari 360px (mobile-first) hingga desktop.

## Struktur Berkas

```
student-catalog/
├── index.html        # Antarmuka web semantik utama
├── styles.css        # Stylesheet sesuai token DESIGN.md
├── script.js         # Logika pencarian, filter, dan modal vanilla JS
├── data/
│   └── books.json    # Berkas data katalog yang dipublikasikan dari sistem lokal
└── README.md
```

## Menjalankan Lokal

Buka berkas `index.html` langsung di browser, atau jalankan server statis lokal:

```bash
# Menggunakan Python
python -m http.server 3000

# Atau menggunakan npx serve
npx serve .
```

Akses di peramban: `http://localhost:3000`.
