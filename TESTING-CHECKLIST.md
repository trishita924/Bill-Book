# Testing Checklist — Bill Book

This checklist tracks all 13 verification scenarios for **Bill Book**.

> **Environment Note:** Automated syntax, asset-path, `localStorage` persistence, paise calculation, and OpenCV QR-decoding tests were executed in Node.js + Python (`cv2.QRCodeDetector`). Live interactive browser tests (Service Worker offline reload, Web Share API on mobile, and live Chromium DOM rendering) require an unrestricted browser environment because Chromium in the build sandbox blocks `127.0.0.1` and `file://` via enterprise policy.

| # | Test Scenario | Status | Verification Details |
|---|---------------|--------|----------------------|
| 1 | Add a product and refresh the page; product remains saved | **Verified (Logic)** / Pending Live Browser | Verified `BillBookStorage.addProduct()` & reload persistence in Node.js `localStorage` mock. Re-verify in live browser after deployment. |
| 2 | Generate a bill with multiple products | **Verified (Logic)** / Pending Live Browser | Verified multi-item cart & custom item aggregation in `billing.js` and `storage.js`. |
| 3 | Verify subtotal manually | **Passed (Automated)** | Tested integer-paise arithmetic (`toPaise` / `fromPaise`), including floating-point edge case `19.99 × 3 = 59.97`. |
| 4 | Apply a discount and verify the result | **Verified (Logic)** / Pending Live Browser | Verified both `%` and flat `₹` discount clamping & paise math in `billing.js`. |
| 5 | Apply tax (GST) and verify the final amount | **Verified (Logic)** / Pending Live Browser | Verified GST calculation on `(subtotal - discount)` and final payable rounding in `billing.js`. |
| 6 | Generate a UPI QR code and verify UPI ID & exact amount | **Passed (Automated)** | Generated QR matrix via `BillBookQR.generateMatrix()` for `upi://pay?pa=sharmageneral@okicici&...&am=378.00&cu=INR` and decoded byte-for-byte with OpenCV `cv2.QRCodeDetector()`. |
| 7 | Download a bill as an image | **Pending Manual Browser Verification** | Canvas PNG generation (`generateReceiptImageBlob`) is implemented in `qr.js`; download trigger requires live browser verification. |
| 8 | Share a bill or use the download fallback | **Pending Manual Browser Verification** | Web Share API + automatic download fallback implemented in `app.js`; requires mobile/desktop browser verification. |
| 9 | Generate multiple bills and verify bill history | **Verified (Logic)** / Pending Live Browser | Verified `saveBill()` & `getBills()` storage ordering; search/date filter UI requires live browser verification. |
| 10 | Verify today's sales total against saved bills | **Verified (Logic)** / Pending Live Browser | Dashboard KPIs & 7-day chart compute directly from `BillBookStorage.getBills()` (zero hardcoded values). |
| 11 | Close and reopen browser and check that all data remains | **Pending Manual Browser Verification** | Data is persisted in `localStorage`; verify across browser restart on your target device. |
| 12 | Test offline functionality after first successful load | **Verified (Assets)** / Pending Live Browser | Verified `manifest.json` and all 15 `PRECACHE_ASSETS` in `service-worker.js` exist on disk; live offline reload requires HTTP/HTTPS browser testing. |
| 13 | Test layout on mobile and desktop | **Pending Manual Browser Verification** | Responsive CSS (`@media (max-width: 1024px)` and `(max-width: 767px)`) implemented; verify visually on desktop and mobile screens. |
