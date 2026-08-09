this contain user advice and improvement.

@Fhan Mazaya , untuk UI/UX tampilan di edge, bisa dibuat konsep seperti di atas? 
* RTSP stream dari kamera ditampilkan 
* Bounding box hasil deteksi truck number ditampilkan (tidak perlu menunggu proses OCR)
* Untuk beberapa sample truck number, lakukan OCR dan sampling hasilnya 
* Setelah yakin hasilnya, tampilkan hasil OCR nya as list (boleh di kiri/kanan)

NOTE: Koneksi ke edge nanti terbatas, karena di tempat pertambangan, tidak ada koneksi selain pake starlink. Bandwidthnya minimal, jadi, load data dari internet harus minimal juga. Contoh: library di docker harus seminimal mungkin. di Edge, cukup load yang diperlukan. Tidak perlu load SAM3, Nemotron, dll yang tidak diperlukan.

NEXT: Karena pake Jetson Nano, storage dan computing power yang tersedia minimal juga. Excercise menggunakan TENSORRT dan OCR yang paling kecil; coba pake PP OCRv6 tiny https://huggingface.co/PaddlePaddle/PP-OCRv6_tiny_rec https://huggingface.co/collections/PaddlePaddle/pp-ocrv6

Atau pake Paddle Lite: https://github.com/PaddlePaddle/Paddle-Lite/blob/develop/README_en.md

ditambahkan live view dari bbox yang terdeteksi di sisi kanan, zoom, agar terlihat

resep: banyak pake asynchronous process ya, biar nggak blocking ...
