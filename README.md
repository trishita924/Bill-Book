# Bill Book — Shop Billing, UPI QR & Daily Sales PWA

**Bill Book** is an offline-ready, mobile-friendly billing and shop management web application (Progressive Web App) designed for small Indian retail shops. Built with plain HTML, CSS, and modular JavaScript—with zero external APIs, zero build tools, and zero backend dependencies—it runs directly from static hosting such as **GitHub Pages**.

---

## Features

- **Daily Sales Dashboard**: Live KPIs computed directly from saved bills—Today's Total Sales, Bills Generated Today, Average Bill Value, All-Time Revenue, Recent Transactions, and an interactive **7-Day Sales Trend** chart.
- **Bill Generator**:
  - Quick-add saved products with search & category filtering.
  - Add manual custom items not in the product catalog.
  - Quantity steppers (`−` / `+` / direct input), percentage (`%`) or flat (`₹`) discounts, and GST/Tax presets (`0%`, `5%`, `12%`, `18%`, `28%`, or custom `%`).
  - Integer-paise arithmetic to avoid floating-point rounding errors.
  - Sequential invoice numbers (`INV-YYYYMMDD-XXXX`) and optional customer name & phone number.
- **Exact-Amount UPI QR Code**:
  - Locally bundled ISO/IEC 18004 QR Code generator (`libraries/locally-bundled-dependencies/qrcode.js`)—works 100% offline.
  - Generates standard NPCI `upi://pay?...` links with your saved UPI ID and the exact final payable amount.
  - Displays a clear prompt to configure a UPI ID if none is saved.
- **Share Bill as Image**:
  - Generates a crisp PNG receipt image via HTML5 Canvas (including shop logo, shop details, itemized list, discount, GST, total, and UPI QR code).
  - **Download Image** button and **Share Bill** button (uses Web Share API on supported mobile browsers with automatic download fallback).
- **Bill History**:
  - Search by invoice number or customer name.
  - Filter by All Dates, Today, Last 7 Days, or a specific calendar date.
  - Re-open, download, or share any previous bill.
- **Product Management & Sample Data**:
  - Add, edit, delete, search, and filter products by category.
  - Pre-loaded with 5 clearly labeled sample products (`Rice`, `Cooking Oil`, `Sugar`, `Milk`, `Bread`) and a one-click **Delete Sample Data** button.
- **Shop Profile**:
  - Configure Shop Name, Owner Name, Address, Phone, optional GSTIN, UPI ID, and Shop Logo (resized & stored locally).
- **Offline PWA Support**:
  - Installable on Android/iOS/Desktop via `manifest.json` and `service-worker.js`.
  - All data is stored locally in `localStorage`—nothing is ever sent to external servers.

---

## Technologies Used

- **HTML5** (Semantic structure, Canvas API for charts & receipt PNG export)
- **CSS3** (Custom properties, CSS Grid, Flexbox, responsive desktop sidebar & mobile bottom navigation)
- **Vanilla JavaScript (ES6+)** (Modular IIFE modules, `localStorage`, Web Share API, Service Worker API)
- **Locally Bundled QR Library**: Custom pure-JS ISO/IEC 18004 QR generator (`libraries/locally-bundled-dependencies/qrcode.js`)

---

## Folder Structure

```text
Bill-Book/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── TESTING-CHECKLIST.md
├── prompts.md
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── billing.js
│   │   ├── history.js
│   │   ├── products.js
│   │   ├── qr.js
│   │   └── storage.js
│   ├── images/
│   └── icons/
│       ├── apple-touch-icon.png
│       ├── favicon.png
│       ├── icon-192.png
│       └── icon-512.png
└── libraries/
    └── locally-bundled-dependencies/
        └── qrcode.js
```

---

## How to Run Locally

Because Service Workers require HTTP/HTTPS (not `file://`), serve the `Bill-Book/` folder with any static HTTP server:

```bash
# Using Python 3
cd Bill-Book
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## How to Deploy Using GitHub Pages

1. Extract `Bill-Book.zip` and push the contents of `Bill-Book/` (with `index.html` at the repository root) to a GitHub repository.
2. Open your repository on GitHub and go to **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose your `main` branch and `/ (root)` folder, then click **Save**.
5. Wait 1–2 minutes and open the published `https://<your-username>.github.io/<repo-name>/` URL.

All asset paths in `index.html`, `manifest.json`, and `service-worker.js` use relative `./` paths so the app works cleanly in any GitHub Pages subpath.

---

## How to Configure Shop Profile & UPI ID

1. Open **Shop Profile** from the sidebar (desktop) or bottom navigation (**Shop** tab on mobile).
2. Enter your **Shop Name**, **Owner Name**, **Phone Number**, **Shop Address**, and optional **GST Number**.
3. Enter your **UPI ID** (e.g., `myshop@okicici` or `9876543210@ybl`).
4. Optionally upload a **Shop Logo** (PNG/JPG).
5. Click **Save Shop Details**. Your details and UPI QR code will now appear automatically on all generated bills and receipt images.

---

## How to Install as a PWA on a Phone

- **Android (Chrome / Edge)**:
  1. Open the hosted GitHub Pages URL in Chrome.
  2. Tap the **Install App** button (or the browser menu `⋮` → **Install app** / **Add to Home screen**).
- **iOS (Safari)**:
  1. Open the hosted URL in Safari.
  2. Tap the **Share** button (`□↑`) → **Add to Home Screen**.

---

## Offline Functionality

On the first visit over HTTPS (or `localhost`), `service-worker.js` caches all HTML, CSS, JavaScript, icon, and QR library files. Subsequent visits work offline, and all products, shop profile settings, and bills continue to save in browser `localStorage`.

---

## Known Limitations

- **Single-Device Local Storage**: Data is stored in the browser's `localStorage` on the current device. Clearing browser site data will erase saved bills and products.
- **Web Share API Support**: Native image sharing (`navigator.share` with PNG files) works on supported mobile browsers (e.g., Android Chrome, iOS Safari). On desktop browsers where file sharing is unsupported, clicking **Share Bill** automatically falls back to downloading the receipt PNG image.
- **QR Code Capacity**: The bundled QR generator supports Byte mode up to Version 15 (~412 bytes), which easily covers standard UPI payment links.
