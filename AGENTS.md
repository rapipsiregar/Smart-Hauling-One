# Agent Instructions

You must follow these workflow rules strictly to support rapid, iterative enhancements of the platform:

## 1. Trigger "e" or "enhance"
If the user types "e", "enhance", or requests an enhancement plan:
- Read `plans/next-enhancements.md` to understand the current platform structure, history, and active tasks.
- Overwrite or update the active tasks list inside `plans/next-enhancements.md`.
- The plan must cover each main section/module of the application.
- Inside the tasks list, define **exactly 3 new enhancements per section** with:
  1. A unique number (e.g., `1.1`, `1.2`, `1.3`).
  2. A clear, specific description of the functional change.
  3. A status (initially set to `[TODO]`).
- Present this plan to the user in your final summary response.

## 2. Trigger "n", "next", or "n{x}"
If the user types "n", "next", "n{x}" (where `{x}` is a positive integer representing the number of enhancements, e.g., "n3"), or requests execution of the next enhancement task(s):
- Read `plans/next-enhancements.md` to check the status of tasks.
- If all enhancement tasks in `plans/next-enhancements.md` are marked `[DONE]` (or there are no tasks marked `[TODO]`), automatically execute the **Trigger "e" or "enhance"** workflow to generate a new set of tasks.
- Otherwise, identify and select the most impactful enhancement task(s) currently marked `[TODO]` (evaluating which tasks have the highest strategic value, functional impact, or user experience contribution). If `{x}` is specified, select the top `{x}` most impactful enhancement tasks and execute them sequentially.
- Implement the selected enhancement task(s) fully in the codebase. Note: all enhancement tasks must operate exclusively on the OCR smart hauling web application and dashboard, utilizing Python for the backend.
- Once completed:
  1. Update the specific task(s) status of `plans/next-enhancements.md` to `[DONE]`.
  2. Document the new or updated feature(s) in the `docs/feature-list.md` file (maintaining an organized list of all platform features under the appropriate section heading).
- Verify the build integrity of the workspace.
- In your final response, state which task(s) have been completed and inform the user of the exact menu or navigation path where they can view and interact with the new/updated feature(s).

## 3. File Size & Refactoring Rules
- **Threshold Rule**: Any new or refactored file exceeding 256 lines of code (LOC) must be refactored and split into multiple smaller, modular, and logical components/files.

## 4. Ad-hoc Feature Requests
- For direct feature requests not using "n"/"next", implement the feature and document it in `docs/feature-list.md`.

## 5. Relative Paths in Documentation
- Do not use absolute full paths or root-slashed paths in markdown files/documentation. Always use relative paths (e.g., `./` or `../` relative to the file's directory).

## Package Manager

Use **uv** for all Python work. Do not use `pip`, `pipenv`, `poetry`, or bare `python`/`python3` for dependency or script execution.

| Task | Command |
|------|---------|
| Initialize project | `uv init` |
| Add dependency | `uv add <package>` |
| Add dev dependency | `uv add --dev <package>` |
| Sync environment | `uv sync` |
| Run script | `uv run labs/script.py` |
| Run module | `uv run python -m <module>` |
| Run one-liner | `uv run python -c "..."` |

If `pyproject.toml` is missing, run `uv init` before adding packages or running scripts.

## Project Layout

- `labs/` — Python lab scripts (numbered)
- `data/` — downloaded/generated data (gitignored as needed)

Never edit files inside git submodules.

## 6. Self-Correction & Context Reset (Dump Zone Rule)
- **Dump Zone Awareness**: Jika agent mengalami disorientasi lokasi folder, kebingungan konteks repositori, atau menerima indikasi "dump zone" dari user:
  - Agent harus **segera melakukan verifikasi ulang lokasi working directory aktif** (misalnya mengecek file `package.json`, `pyproject.toml`, atau nama repositori tempat file yang sedang dibuka).
  - Agent wajib **melakukan reset pemahaman konteks (refresh state)** seolah-olah memulai percakapan baru (*new chat fresh state*), tanpa mengulangi asumsi dari percakapan atau repositori sebelumnya.
  - Berikan respon yang lugas, tepat sasaran, dan langsung berfokus pada repositori serta file aktif yang sedang dikerjakan user.

## 7. Bahasa & Penulisan UI (Language & UX Rules)
- **Wajib Selalu Menggunakan Bahasa Indonesia**: Agent wajib selalu berkomunikasi, memberikan penjelasan, serta menuliskan dokumen/respon menggunakan Bahasa Indonesia.
- **UI Wajib Menggunakan Bahasa Non-Teknis**: Tampilan antarmuka (UI) **WAJIB menggunakan bahasa non-teknis** yang awam dan mudah dipahami oleh operator lapangan maupun supervisor operasional tambang. **Dilarang keras menggunakan bahasa/istilah teknis** (seperti istilah pemrograman, database, JSON, HTTP, API, query, backend, status code, dsb.) pada label, tombol, tabel, notifikasi, modul, maupun judul visual di UI.

## 8. Lokasi Resmi UI & Backend Proyek (Strict Project Directory Rules)
- **Folder UI Resmi (WAJIB)**: Aplikasi tampilan antarmuka resmi proyek **WAJIB HANYA DI `core/frontend`** (aplikasi Next.js buatan user). Agent DILARANG KERAS membuat, mengubah, mengacak-acak, atau mengarahkan dev server ke folder UI lain.
- **Folder Backend Resmi (WAJIB)**: Backend Python resmi berada di **`core/backend`** (FastAPI `app.main:app`).
- **Perintah Menjalankan Aplikasi Resmi**:
  - Frontend: `npm --prefix core/frontend run dev` (atau `npm run dev` pada root proyek).
  - Backend: `cd "core/backend"` kemudian `uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **Larangan Mengubah Desain & Layout Asli User**: Agent DILARANG KERAS mengubah, merusak, atau mengganti layout antarmuka buatan user di `core/frontend`. Semua penambahan fitur baru WAJIB disesuaikan dan diintegrasikan langsung ke dalam komponen Next.js resmi di `core/frontend`.

## 9. Prinsip Verifikasi Empiris Tanpa Asumsi (Zero-Assumption Protocol)
- **DILARANG BERSPEKULASI / ASUMSI**: Agent DILARANG KERAS memberikan klaim bahwa server berjalan, kode berhasil, atau path benar tanpa mengeksekusi perintah verifikasi empiris di terminal terlebih dahulu.
- **BUKTI DAHULU, BARU LAPOR**: Setiap pernyataan status keberhasilan WAJIB menyertakan bukti output log/eksekusi terminal riil yang membuktikan bahwa fitur/server tersebut benar-benar berfungsi 100%.
- **VERIFIKASI FILE DAHULU**: Sebelum mengubah atau mengarahkan path/file apa pun, Agent WAJIB memeriksa keberadaan file secara riil di sistem menggunakan perintah pencarian file/baca file.

## 10. Larangan Mutlak Gimmick & Data Palsu (Strict Real-Backend Only)
- **GARIS KERAS DILARANG KERAS MEMBUAT GIMMICK**: Agent DILARANG KERAS membuat data palsu, mock data, `Math.random()`, data simulasi, atau gimmick visual apa pun di frontend maupun backend.
- **WAJIB 100% DATA RIIL DARI BACKEND**: Semua data statistik, ritase, dan metrik operasional WAJIB 100% bersumber dari query database SQLite / backend API Python (`core/backend`) yang sebenarnya.
- **TAMPILKAN 0 JIKA KOSONG**: Jika data pada tanggal/periode yang dipilih di database belum ada atau 0, UI WAJIB menampilkan 0/kosong secara jujur. Dilarang keras merekayasa angka fallback atau simulasi.

## 11. Standar Estetika Antarmuka (Strict UI/UX Rules)
- **KUALITAS ANTARMUKA TERBAIK**: Tampilan UI wajib profesional, rapih, jelas, mudah dipahami, seimbang, dan semuanya sinkron. 
- **LARANGAN KERAS BERBAGI LAYOUT KAKU ATAU TERTUTUP**: Komponen visual tidak boleh bertabrakan dengan legenda, teks, atau elemen kontrol lainnya. Tata letak harus responsif dan menyatu dengan tema visual utama.
- **KETERBACAAN & KONTRAS TINGGI**: Pada mode terang (*light mode*), dilarang menggunakan teks abu-abu terang (seperti `#94a3b8` atau `slate-400`) di atas latar belakang putih/terang. Gunakan warna abu-abu yang lebih gelap (seperti `#475569` atau slate-600) untuk teks sekunder/pendukung. Seluruh teks aksen emas/amber wajib menggunakan warna yang lebih gelap (seperti `text-amber-600` atau `#ea8a04`) di atas latar belakang terang agar terbaca jelas dengan kontras yang memadai.
- **ADAPTASI TEMA DINAMIS**: Hindari penggunaan warna background statis hitam pekat (seperti `bg-slate-900` or `bg-slate-950`) atau putih solid pada komponen atau panel utama. Selalu gunakan variabel CSS dinamis (seperti `bg-[var(--bg-elevated)]` dan `text-[var(--text-primary)]`) agar antarmuka beradaptasi dengan sempurna baik di mode gelap maupun terang tanpa merusak kontras.
