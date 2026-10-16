/**
 * SMAN 1 Sekayam - Website Katalog Siswa
 * Vanilla JavaScript (read-only, tanpa login, akses publik)
 * Diturunkan dari DESIGN.md dan Revision.md
 */

(() => {
  'use strict';

  // Konfigurasi ambang batas katalog usang (dalam milidetik, misal 24 jam)
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  // State aplikasi
  const state = {
    books: [],
    metadata: {
      school: 'SMAN 1 Sekayam',
      catalogVersion: '',
      updatedAt: '',
      totalTitles: 0,
      totalCopies: 0,
      availableCopies: 0,
    },
    filter: {
      search: '',
      category: 'ALL',
      onlyAvailable: false,
      shelf: 'ALL',
    },
    loading: true,
    error: null,
    selectedBook: null,
  };

  // Elemen DOM
  const dom = {
    statTitles: document.getElementById('stat-titles'),
    statCopies: document.getElementById('stat-copies'),
    statAvailable: document.getElementById('stat-available'),
    searchInput: document.getElementById('search-input'),
    searchForm: document.getElementById('search-form'),
    categoryChips: document.getElementById('category-chips'),
    categorySelect: document.getElementById('category-select'),
    availabilityFilter: document.getElementById('filter-available'),
    shelfSelect: document.getElementById('shelf-select'),
    clearFiltersBtn: document.getElementById('btn-clear-filters'),
    noticeBanner: document.getElementById('notice-banner'),
    resultsCount: document.getElementById('results-count'),
    resultsGrid: document.getElementById('books-grid'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    btnRetry: document.getElementById('btn-retry'),
    btnResetEmpty: document.getElementById('btn-reset-empty'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCloseAction: document.getElementById('modal-close-action'),
    modalTitle: document.getElementById('modal-title'),
    modalCategory: document.getElementById('modal-category'),
    modalAuthor: document.getElementById('modal-author'),
    modalPublisher: document.getElementById('modal-publisher'),
    modalYear: document.getElementById('modal-year'),
    modalIsbn: document.getElementById('modal-isbn'),
    modalShelf: document.getElementById('modal-shelf'),
    modalCopies: document.getElementById('modal-copies'),
    modalStatusTag: document.getElementById('modal-status-tag'),
    modalDescription: document.getElementById('modal-description'),
    modalTimestamp: document.getElementById('modal-timestamp'),
    modalCoverImg: document.getElementById('modal-cover-img'),
    modalCoverFallback: document.getElementById('modal-cover-fallback'),
    modalFallbackCat: document.getElementById('modal-fallback-cat'),
    modalFallbackTitle: document.getElementById('modal-fallback-title'),
    modalFallbackAuthor: document.getElementById('modal-fallback-author'),
    modalShelfCode: document.getElementById('modal-shelf-code'),
  };

  // Format Tanggal Indonesia: DD-MM-YYYY HH.mm WIB
  function formatDateTime(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const pad = (n) => String(n).padStart(2, '0');
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${day}-${month}-${year} ${hours}.${minutes} WIB`;
    } catch {
      return isoString;
    }
  }

  // Parse data katalog dari sumber JSON, window.CATALOG_DATA, atau embedded fallback
  async function loadCatalog() {
    state.loading = true;
    state.error = null;
    renderLoading();

    try {
      let rawData = null;
      let usedLocal = false;

      // 1. Cek snapshot terbaru dari localStorage jika ada
      const localSnapshot = localStorage.getItem('smansa_published_catalog');
      if (localSnapshot) {
        try {
          rawData = JSON.parse(localSnapshot);
          usedLocal = true;
        } catch (e) {
          console.warn('Gagal mem-parse snapshot localStorage:', e);
        }
      }

      // 2. Jika bukan dari localStorage atau jika berjalan di web server, coba fetch 'data/books.json'
      if (!rawData && window.location.protocol !== 'file:') {
        try {
          const res = await fetch('data/books.json', { cache: 'no-store' });
          if (res.ok) {
            rawData = await res.json();
          }
        } catch (fetchErr) {
          console.warn('Fetch data/books.json gagal, mencoba sumber data cadangan:', fetchErr);
        }
      }

      // 3. Jika dibuka langsung via double-click file:// di Windows Explorer (atau jika fetch gagal karena pembatasan CORS browser):
      // Ambil dari window.CATALOG_DATA yang dimuat dari data/books.js
      if (!rawData && typeof window.CATALOG_DATA === 'object' && window.CATALOG_DATA !== null) {
        rawData = window.CATALOG_DATA;
      }

      // 4. Cadangan darurat: ambil dari tag script embedded di dalam index.html
      if (!rawData) {
        const embeddedEl = document.getElementById('initial-catalog-data');
        if (embeddedEl && embeddedEl.textContent && embeddedEl.textContent.trim()) {
          try {
            rawData = JSON.parse(embeddedEl.textContent);
          } catch (e) {
            console.warn('Gagal membaca embedded JSON data:', e);
          }
        }
      }

      // 5. Coba fetch sekali lagi jika belum ada
      if (!rawData) {
        try {
          const res = await fetch('data/books.json');
          if (res.ok) {
            rawData = await res.json();
          }
        } catch (finalErr) {
          // ignore
        }
      }

      // Validasi struktur JSON minimal
      if (!rawData || (!Array.isArray(rawData.books) && !Array.isArray(rawData))) {
        throw new Error('Format berkas katalog tidak valid atau berkas data belum tersedia.');
      }

      const bookList = Array.isArray(rawData.books) ? rawData.books : rawData;
      const meta = rawData.metadata || {};
      const updatedAt = meta.generatedAt || meta.catalogVersion || rawData.updated_at || new Date().toISOString();

      // Normalisasi setiap buku
      state.books = bookList.map((b, idx) => {
        const total = typeof b.totalCopies === 'number' ? b.totalCopies : (b.total ?? 1);
        const avail = typeof b.availableCopies === 'number'
          ? b.availableCopies
          : typeof b.available === 'number'
          ? b.available
          : total;

        const shelfCode = typeof b.shelf === 'object' && b.shelf !== null ? b.shelf.code : (b.shelf || 'Umum');
        const shelfName = typeof b.shelf === 'object' && b.shelf !== null ? b.shelf.name : '';

        return {
          id: b.id || `BK-${String(idx + 1).padStart(6, '0')}`,
          title: b.title || 'Tanpa Judul',
          author: b.author || 'Pengarang Tidak Diketahui',
          publisher: b.publisher || '—',
          year: b.publicationYear || b.year || '—',
          isbn: b.isbn || '—',
          category: b.category || 'Umum',
          description: b.description || 'Tidak ada deskripsi tambahan.',
          cover: b.cover || (b.id ? `assets/covers/${b.id.toLowerCase()}.svg` : ''),
          shelfCode,
          shelfName,
          totalCopies: total,
          availableCopies: avail,
          isAvailable: avail > 0,
        };
      });

      // Hitung agregat
      const totalTitles = state.books.length;
      const totalCopies = state.books.reduce((acc, cur) => acc + cur.totalCopies, 0);
      const totalAvail = state.books.reduce((acc, cur) => acc + cur.availableCopies, 0);

      state.metadata = {
        school: meta.school || 'SMAN 1 Sekayam',
        catalogVersion: meta.catalogVersion || '',
        updatedAt,
        totalTitles: meta.totalTitles || totalTitles,
        totalCopies: meta.totalCopies || totalCopies,
        availableCopies: meta.availableCopies || totalAvail,
        usedLocal,
      };

      state.loading = false;
      renderAll();
    } catch (err) {
      state.loading = false;
      state.error = err.message || 'Gagal memuat katalog buku.';
      renderError();
    }
  }

  // Render semua komponen UI
  function renderAll() {
    if (dom.errorState) dom.errorState.style.display = 'none';

    renderStats();
    renderNoticeBanner();
    renderCategoryChips();
    renderShelfSelect();
    renderResults();
  }

  // Render statistik ringkasan di pita hero
  function renderStats() {
    if (dom.statTitles) dom.statTitles.textContent = state.metadata.totalTitles.toLocaleString('id-ID');
    if (dom.statCopies) dom.statCopies.textContent = state.metadata.totalCopies.toLocaleString('id-ID');
    if (dom.statAvailable) dom.statAvailable.textContent = state.metadata.availableCopies.toLocaleString('id-ID');
  }

  // Render pemberitahuan waktu pembaruan dan status usang
  function renderNoticeBanner() {
    if (!dom.noticeBanner) return;

    const formattedTime = formatDateTime(state.metadata.updatedAt);
    let isStale = false;

    if (state.metadata.updatedAt) {
      const updatedDate = new Date(state.metadata.updatedAt);
      if (!isNaN(updatedDate.getTime())) {
        const diff = Date.now() - updatedDate.getTime();
        if (diff > STALE_THRESHOLD_MS) {
          isStale = true;
        }
      }
    }

    if (isStale) {
      dom.noticeBanner.className = 'notice notice-warning';
      dom.noticeBanner.innerHTML = `
        <svg class="notice-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <strong>Katalog belum diperbarui dalam 24 jam terakhir.</strong>
          <p>Pembaruan terakhir tercatat pada ${formattedTime}. Ketersediaan fisik di rak mungkin berbeda dengan data ini, silakan tanyakan ke petugas perpustakaan.</p>
        </div>
      `;
    } else {
      dom.noticeBanner.className = 'notice notice-info';
      dom.noticeBanner.innerHTML = `
        <svg class="notice-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <div>
          Data katalog per <strong>${formattedTime}</strong>. Ketersediaan eksemplar dapat berubah sewaktu-waktu sesuai transaksi di meja sirkulasi.
        </div>
      `;
    }
  }

  // Render chip filter kategori secara dinamis beserta jumlahnya
  function renderCategoryChips() {
    if (!dom.categoryChips) return;

    // Hitung kemunculan tiap kategori
    const catCounts = {};
    state.books.forEach((b) => {
      catCounts[b.category] = (catCounts[b.category] || 0) + 1;
    });

    const categories = Object.keys(catCounts).sort();

    dom.categoryChips.innerHTML = '';

    // Chip "Semua Kategori"
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = `filter-chip ${state.filter.category === 'ALL' ? 'active' : ''}`;
    allChip.innerHTML = `Semua <span class="chip-count">${state.books.length}</span>`;
    allChip.addEventListener('click', () => {
      state.filter.category = 'ALL';
      renderCategoryChips();
      renderResults();
    });
    dom.categoryChips.appendChild(allChip);

    // Chip untuk masing-masing kategori
    categories.forEach((cat) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `filter-chip ${state.filter.category === cat ? 'active' : ''}`;
      chip.innerHTML = `${escapeHtml(cat)} <span class="chip-count">${catCounts[cat]}</span>`;
      chip.addEventListener('click', () => {
        state.filter.category = state.filter.category === cat ? 'ALL' : cat;
        renderCategoryChips();
        renderResults();
      });
      dom.categoryChips.appendChild(chip);
    });

    // Dropdown kategori untuk HP, isinya sama dengan chip
    if (dom.categorySelect) {
      dom.categorySelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = 'ALL';
      allOpt.textContent = `Semua Kategori (${state.books.length})`;
      allOpt.dataset.label = 'Semua Kategori';
      allOpt.dataset.count = state.books.length;
      dom.categorySelect.appendChild(allOpt);
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${cat} (${catCounts[cat]})`;
        opt.dataset.label = cat;
        opt.dataset.count = catCounts[cat];
        dom.categorySelect.appendChild(opt);
      });
      dom.categorySelect.value = state.filter.category;
      syncDropdown(dom.categorySelect);
    }
  }

  // Render pilihan rak unik di dropdown
  function renderShelfSelect() {
    if (!dom.shelfSelect) return;

    const shelves = Array.from(new Set(state.books.map((b) => b.shelfCode))).filter(Boolean).sort();
    const currentVal = state.filter.shelf;

    dom.shelfSelect.innerHTML = '<option value="ALL">Semua Lokasi Rak</option>';
    shelves.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Rak ${s}`;
      if (s === currentVal) opt.selected = true;
      dom.shelfSelect.appendChild(opt);
    });
    syncDropdown(dom.shelfSelect);
  }

  // Filter buku berdasarkan kriteria pencarian dan filter aktif
  function getFilteredBooks() {
    const q = state.filter.search.trim().toLowerCase();

    return state.books.filter((b) => {
      // 1. Pencarian teks
      if (q) {
        const haystack = `${b.title} ${b.author} ${b.isbn} ${b.category} ${b.shelfCode} ${b.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 2. Filter kategori
      if (state.filter.category !== 'ALL' && b.category !== state.filter.category) {
        return false;
      }

      // 3. Filter hanya yang tersedia
      if (state.filter.onlyAvailable && !b.isAvailable) {
        return false;
      }

      // 4. Filter rak
      if (state.filter.shelf !== 'ALL' && b.shelfCode !== state.filter.shelf) {
        return false;
      }

      return true;
    });
  }

  // Render daftar kartu hasil pencarian
  function renderResults() {
    if (!dom.resultsGrid) return;

    const filtered = getFilteredBooks();

    // Update jumlah hasil
    if (dom.resultsCount) {
      dom.resultsCount.textContent = `${filtered.length} buku ditemukan`;
    }

    // Toggle tombol bersihkan filter
    const hasFilter = Boolean(
      state.filter.search ||
      state.filter.category !== 'ALL' ||
      state.filter.onlyAvailable ||
      state.filter.shelf !== 'ALL'
    );
    if (dom.clearFiltersBtn) {
      dom.clearFiltersBtn.style.display = hasFilter ? 'inline-block' : 'none';
    }

    // Tampilkan empty state jika tidak ada hasil
    if (filtered.length === 0) {
      dom.resultsGrid.innerHTML = '';
      if (dom.emptyState) dom.emptyState.style.display = 'block';
      return;
    }

    if (dom.emptyState) dom.emptyState.style.display = 'none';

    // Render kartu buku
    dom.resultsGrid.innerHTML = filtered
      .map((b) => {
        const isAvailable = b.isAvailable;
        const statusLabel = isAvailable
          ? `Tersedia (${b.availableCopies})`
          : 'Tidak tersedia';
        const statusClass = isAvailable ? 'status-tag-available' : 'status-tag-unavailable';
        const iconSvg = isAvailable
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-dasharray="4 4"/></svg>`;

        return `
          <article class="book-card" data-book-id="${escapeHtml(b.id)}">
            <div>
              <div class="card-top">
                <span class="card-category">${escapeHtml(b.category)}</span>
                <span class="status-tag ${statusClass}">
                  ${iconSvg}
                  ${statusLabel}
                </span>
              </div>
              <div class="card-cover-container">
                <div class="card-cover-wrapper">
                  <img
                    src="${escapeHtml(b.cover)}"
                    alt="Sampul ${escapeHtml(b.title)}"
                    class="card-cover-image"
                    loading="lazy"
                    onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                  />
                  <div class="card-cover-fallback" style="display: none;">
                    <div class="fallback-spine"></div>
                    <span class="fallback-cat">${escapeHtml(b.category)}</span>
                    <strong class="fallback-title">${escapeHtml(b.title)}</strong>
                    <span class="fallback-author">${escapeHtml(b.author)}</span>
                  </div>
                </div>
              </div>
              <h3 class="card-title">${escapeHtml(b.title)}</h3>
              <p class="card-author">${escapeHtml(b.author)}</p>
            </div>

            <div>
              <div class="card-details">
                <div class="detail-row">
                  <span class="shelf-pill">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Rak ${escapeHtml(b.shelfCode)}
                  </span>
                  <span class="copies-info">
                    ${isAvailable ? `Tersedia <strong>${b.availableCopies}</strong> dari ${b.totalCopies}` : `0 dari ${b.totalCopies} tersedia`}
                  </span>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-block btn-open-detail" data-book-id="${escapeHtml(b.id)}">
                Lihat detail
              </button>
            </div>
          </article>
        `;
      })
      .join('');

    // Tambahkan event listener ke setiap tombol "Lihat detail"
    dom.resultsGrid.querySelectorAll('.btn-open-detail').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-book-id');
        openModal(id);
      });
    });
  }

  // Render skeleton loading
  function renderLoading() {
    if (!dom.resultsGrid) return;
    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.errorState) dom.errorState.style.display = 'none';

    dom.resultsGrid.innerHTML = Array(6)
      .fill(0)
      .map(
        () => `
        <div class="skeleton-card">
          <div class="skeleton-line" style="width: 40%"></div>
          <div class="skeleton-line" style="width: 85%; height: 1.75rem"></div>
          <div class="skeleton-line" style="width: 60%"></div>
          <div class="skeleton-line" style="width: 100%; margin-top: 1rem"></div>
          <div class="skeleton-line" style="width: 100%; height: 3rem; border-radius: 8px"></div>
        </div>
      `
      )
      .join('');
  }

  // Render error state
  function renderError() {
    if (dom.resultsGrid) dom.resultsGrid.innerHTML = '';
    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.errorState) {
      dom.errorState.style.display = 'block';
      if (dom.errorMessage) {
        dom.errorMessage.textContent = state.error || 'Terjadi kesalahan saat memuat berkas katalog.';
      }
    }
  }

  // Buka Modal Dialog Detail Buku
  function openModal(bookId) {
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return;

    state.selectedBook = book;

    const isAvailable = book.isAvailable;
    const statusLabel = isAvailable ? `Tersedia (${book.availableCopies} eksemplar)` : 'Tidak tersedia';
    const statusClass = isAvailable ? 'status-tag-available' : 'status-tag-unavailable';
    const iconSvg = isAvailable
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-dasharray="4 4"/></svg>`;

    if (dom.modalTitle) dom.modalTitle.textContent = book.title;
    if (dom.modalCategory) dom.modalCategory.textContent = book.category;
    if (dom.modalAuthor) dom.modalAuthor.textContent = book.author;
    if (dom.modalPublisher) dom.modalPublisher.textContent = book.publisher;
    if (dom.modalYear) dom.modalYear.textContent = book.year;
    if (dom.modalIsbn) dom.modalIsbn.textContent = book.isbn;
    if (dom.modalShelf) dom.modalShelf.textContent = `Rak ${book.shelfCode}${book.shelfName ? ` (${book.shelfName})` : ''}`;
    if (dom.modalShelfCode) dom.modalShelfCode.textContent = book.shelfCode;
    if (dom.modalCopies) dom.modalCopies.textContent = `${book.availableCopies} eksemplar tersedia (total ${book.totalCopies})`;
    if (dom.modalDescription) dom.modalDescription.textContent = book.description;
    if (dom.modalTimestamp) dom.modalTimestamp.textContent = `Data ketersediaan per ${formatDateTime(state.metadata.updatedAt)}.`;

    // Pasang sampul buku modal dengan fallback aman
    if (dom.modalCoverImg) {
      dom.modalCoverImg.style.display = 'block';
      dom.modalCoverImg.src = book.cover || '';
      dom.modalCoverImg.alt = `Sampul buku ${book.title}`;
    }
    if (dom.modalCoverFallback) {
      dom.modalCoverFallback.style.display = 'none';
      if (dom.modalFallbackCat) dom.modalFallbackCat.textContent = book.category;
      if (dom.modalFallbackTitle) dom.modalFallbackTitle.textContent = book.title;
      if (dom.modalFallbackAuthor) dom.modalFallbackAuthor.textContent = book.author;
    }

    if (dom.modalStatusTag) {
      dom.modalStatusTag.className = `status-tag ${statusClass}`;
      dom.modalStatusTag.innerHTML = `${iconSvg} ${statusLabel}`;
    }

    if (dom.modalOverlay) {
      dom.modalOverlay.classList.add('open');
      dom.modalOverlay.setAttribute('aria-hidden', 'false');
      dom.modalCloseBtn.focus();
    }

    document.body.style.overflow = 'hidden';
  }

  // Tutup Modal Dialog
  function closeModal() {
    if (dom.modalOverlay) {
      dom.modalOverlay.classList.remove('open');
      dom.modalOverlay.setAttribute('aria-hidden', 'true');
    }
    state.selectedBook = null;
    document.body.style.overflow = '';
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Inisialisasi Event Handlers
  /* Dropdown kustom di atas <select>: select tetap menyimpan nilai dan memicu "change",
     daftar pilihannya digambar sendiri agar mengikuti desain (menu bersudut 14px). */
  const CHEVRON_SVG = '<svg class="dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  let dropdownSeq = 0;

  function optionMarkup(opt) {
    const label = escapeHtml(opt.dataset.label || opt.textContent);
    const count = opt.dataset.count ? `<span class="chip-count">${escapeHtml(opt.dataset.count)}</span>` : '';
    return { label, count };
  }

  function enhanceSelect(select) {
    if (!select || select._dropdown) return;
    const id = `dropdown-${++dropdownSeq}`;
    const wrap = document.createElement('div');
    wrap.className = `dropdown ${select.dataset.dropdownClass || ''}`.trim();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-list`);

    const list = document.createElement('ul');
    list.id = `${id}-list`;
    list.className = 'dropdown-panel';
    list.tabIndex = -1;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', select.getAttribute('aria-label') || '');

    select.parentNode.insertBefore(wrap, select);
    wrap.append(select, trigger, list);

    let active = -1;
    const items = () => Array.from(list.children);
    const isOpen = () => wrap.classList.contains('open');

    function setActive(i) {
      const els = items();
      if (!els.length) return;
      active = Math.max(0, Math.min(els.length - 1, i));
      els.forEach((el, n) => el.classList.toggle('active', n === active));
      list.setAttribute('aria-activedescendant', els[active].id);
      els[active].scrollIntoView({ block: 'nearest' });
    }

    function sync() {
      const opts = Array.from(select.options);
      list.innerHTML = opts.map((opt, i) => {
        const { label, count } = optionMarkup(opt);
        return `<li id="${id}-opt-${i}" class="dropdown-option" role="option" aria-selected="${opt.selected}"><span class="dropdown-option-label">${label}</span>${count}</li>`;
      }).join('');
      const current = select.options[select.selectedIndex];
      const { label, count } = current ? optionMarkup(current) : { label: '', count: '' };
      trigger.innerHTML = `<span class="dropdown-label">${label}</span>${count}${CHEVRON_SVG}`;
      trigger.setAttribute('aria-label', `${select.getAttribute('aria-label') || ''}: ${current ? current.textContent : ''}`.trim());
    }

    function open() {
      if (isOpen()) return;
      wrap.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      list.focus({ preventScroll: true });
      setActive(Math.max(0, select.selectedIndex));
    }

    function close(returnFocus) {
      if (!isOpen()) return;
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus({ preventScroll: true });
    }

    function choose(i) {
      close(true);
      if (i < 0 || i === select.selectedIndex) return;
      select.selectedIndex = i;
      sync();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    trigger.addEventListener('click', () => (isOpen() ? close(false) : open()));
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
      }
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.dropdown-option');
      if (li) choose(items().indexOf(li));
    });
    list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.dropdown-option');
      if (li && !li.classList.contains('active')) setActive(items().indexOf(li));
    });
    list.addEventListener('keydown', (e) => {
      const last = items().length - 1;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(last); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') { close(true); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (isOpen() && !wrap.contains(e.target)) close(false);
    });

    select._dropdown = { sync };
    sync();
  }

  /** Samakan tampilan dropdown setelah pilihan atau nilai <select> diubah lewat kode. */
  function syncDropdown(select) {
    if (select && select._dropdown) select._dropdown.sync();
  }

  function initEvents() {
    enhanceSelect(dom.categorySelect);
    enhanceSelect(dom.shelfSelect);

    // Input Pencarian
    let searchTimeout = null;
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          state.filter.search = e.target.value;
          renderResults();
        }, 150);
      });
    }

    // Submit Form Pencarian
    if (dom.searchForm) {
      dom.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.filter.search = dom.searchInput.value;
        renderResults();
        const resultsEl = document.getElementById('hasil-katalog');
        if (resultsEl) resultsEl.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Filter Ketersediaan
    if (dom.availabilityFilter) {
      dom.availabilityFilter.addEventListener('click', () => {
        state.filter.onlyAvailable = !state.filter.onlyAvailable;
        dom.availabilityFilter.classList.toggle('active', state.filter.onlyAvailable);
        renderResults();
      });
    }

    // Filter Kategori (dropdown di HP)
    if (dom.categorySelect) {
      dom.categorySelect.addEventListener('change', (e) => {
        state.filter.category = e.target.value;
        renderCategoryChips();
        renderResults();
      });
    }

    // Filter Rak
    if (dom.shelfSelect) {
      dom.shelfSelect.addEventListener('change', (e) => {
        state.filter.shelf = e.target.value;
        renderResults();
      });
    }

    // Bersihkan Filter
    function resetAllFilters() {
      state.filter.search = '';
      state.filter.category = 'ALL';
      state.filter.onlyAvailable = false;
      state.filter.shelf = 'ALL';

      if (dom.searchInput) dom.searchInput.value = '';
      if (dom.availabilityFilter) dom.availabilityFilter.classList.remove('active');
      if (dom.shelfSelect) dom.shelfSelect.value = 'ALL';
      syncDropdown(dom.shelfSelect);

      renderCategoryChips();
      renderResults();
    }

    if (dom.clearFiltersBtn) dom.clearFiltersBtn.addEventListener('click', resetAllFilters);
    if (dom.btnResetEmpty) dom.btnResetEmpty.addEventListener('click', resetAllFilters);
    if (dom.btnRetry) dom.btnRetry.addEventListener('click', loadCatalog);

    // Modal Events
    if (dom.modalCloseBtn) dom.modalCloseBtn.addEventListener('click', closeModal);
    if (dom.modalCloseAction) dom.modalCloseAction.addEventListener('click', closeModal);
    if (dom.modalOverlay) {
      dom.modalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.modalOverlay) closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.modalOverlay && dom.modalOverlay.classList.contains('open')) {
        closeModal();
      }
    });
  }

  // Mulai Aplikasi
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadCatalog();
  });
})();
