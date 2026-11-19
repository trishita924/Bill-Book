# Development Prompts Log — Bill Book

## 1. Primary Product & Architecture Prompt
- Build **Bill Book**, an offline-ready, mobile-friendly billing and shop management PWA for small Indian retail shops using plain HTML, CSS, and modular JavaScript (no build tools, no backend, GitHub Pages compatible).
- Core modules:
  - `storage.js`: `localStorage` persistence with integer-paise arithmetic and clearly labeled sample products (`Rice`, `Cooking Oil`, `Sugar`, `Milk`, `Bread`) with delete capability.
  - `libraries/locally-bundled-dependencies/qrcode.js`: Pure-JS ISO/IEC 18004 QR code generator for offline UPI QR codes.
  - `qr.js`: NPCI `upi://pay` link builder and HTML5 Canvas PNG receipt image generator.
  - `products.js`, `billing.js`, `history.js`, `app.js`: Product CRUD, Bill Generator (with custom items, `%`/`₹` discounts, GST presets), Bill History (search & date filters), Shop Profile (with logo upload & UPI ID), and Daily Sales Dashboard with a 7-day Canvas bar chart.
  - `manifest.json` & `service-worker.js`: Relative-path PWA installability and offline caching.

## 2. Verification & Packaging Prompt
- Verify all JavaScript syntax (`node --check`), `manifest.json`, `service-worker.js` precache paths, HTML asset references, paise-exact calculations, and UPI QR scannability via OpenCV `QRCodeDetector`.
- Package the complete project into `Bill-Book.zip` with `index.html` in the root folder.
