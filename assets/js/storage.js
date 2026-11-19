/**
 * Bill Book — Storage & Money Math Module
 * Persists Shop Profile, Products, Bills, and Invoice Sequence in localStorage.
 * Uses integer paise arithmetic to prevent floating-point rounding errors.
 */
(function (global) {
  'use strict';

  const KEYS = {
    PROFILE: 'billbook_shop_profile_v1',
    PRODUCTS: 'billbook_products_v1',
    BILLS: 'billbook_bills_v1',
    INVOICE_SEQ: 'billbook_invoice_seq_v1',
    INITIALIZED: 'billbook_initialized_v1'
  };

  const DEFAULT_PROFILE = {
    shopName: 'My Shop',
    ownerName: '',
    address: '',
    phone: '',
    gstNumber: '',
    upiId: '',
    logoDataUrl: ''
  };

  const SAMPLE_PRODUCTS = [
    { id: 'sample-1', name: 'Rice (1 kg)', price: 60, category: 'Groceries', code: 'RICE-1KG', isSample: true },
    { id: 'sample-2', name: 'Cooking Oil (1 L)', price: 165, category: 'Groceries', code: 'OIL-1L', isSample: true },
    { id: 'sample-3', name: 'Sugar (1 kg)', price: 45, category: 'Groceries', code: 'SUGAR-1KG', isSample: true },
    { id: 'sample-4', name: 'Milk (Packet)', price: 30, category: 'Dairy & Bakery', code: 'MILK-PKT', isSample: true },
    { id: 'sample-5', name: 'Bread (Packet)', price: 40, category: 'Dairy & Bakery', code: 'BREAD-PKT', isSample: true }
  ];

  // ==================== EXACT MONEY HELPERS ====================
  function toPaise(rupees) {
    const n = Number(rupees);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromPaise(paise) {
    return Math.round(paise) / 100;
  }

  function formatINR(rupees) {
    const val = fromPaise(toPaise(rupees));
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatDateKey(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDisplayDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // ==================== STORAGE CORE ====================
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function init() {
    if (!localStorage.getItem(KEYS.INITIALIZED)) {
      writeJSON(KEYS.PROFILE, DEFAULT_PROFILE);
      writeJSON(KEYS.PRODUCTS, SAMPLE_PRODUCTS);
      writeJSON(KEYS.BILLS, []);
      writeJSON(KEYS.INVOICE_SEQ, 1);
      localStorage.setItem(KEYS.INITIALIZED, 'true');
    }
  }

  // ==================== SHOP PROFILE ====================
  function getProfile() {
    init();
    return Object.assign({}, DEFAULT_PROFILE, readJSON(KEYS.PROFILE, {}));
  }

  function saveProfile(profile) {
    const clean = Object.assign({}, DEFAULT_PROFILE, profile);
    writeJSON(KEYS.PROFILE, clean);
    return clean;
  }

  // ==================== PRODUCTS ====================
  function getProducts() {
    init();
    return readJSON(KEYS.PRODUCTS, []);
  }

  function saveProducts(products) {
    writeJSON(KEYS.PRODUCTS, products);
  }

  function addProduct(productData) {
    const products = getProducts();
    const newProduct = {
      id: 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: productData.name.trim(),
      price: fromPaise(toPaise(productData.price)),
      category: productData.category || 'Other',
      code: (productData.code || '').trim(),
      isSample: false
    };
    products.unshift(newProduct);
    saveProducts(products);
    return newProduct;
  }

  function updateProduct(id, updates) {
    const products = getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    products[idx] = Object.assign({}, products[idx], {
      name: updates.name.trim(),
      price: fromPaise(toPaise(updates.price)),
      category: updates.category || 'Other',
      code: (updates.code || '').trim(),
      isSample: false
    });
    saveProducts(products);
    return products[idx];
  }

  function deleteProduct(id) {
    const products = getProducts().filter((p) => p.id !== id);
    saveProducts(products);
    return products;
  }

  function clearSampleProducts() {
    const products = getProducts().filter((p) => !p.isSample);
    saveProducts(products);
    return products;
  }

  // ==================== BILLS & INVOICE NUMBER ====================
  function getBills() {
    init();
    return readJSON(KEYS.BILLS, []);
  }

  function peekNextInvoiceNumber() {
    init();
    const seq = Number(readJSON(KEYS.INVOICE_SEQ, 1)) || 1;
    const todayStr = formatDateKey(new Date()).replace(/-/g, '');
    return `INV-${todayStr}-${String(seq).padStart(4, '0')}`;
  }

  function consumeNextInvoiceNumber() {
    const inv = peekNextInvoiceNumber();
    const seq = Number(readJSON(KEYS.INVOICE_SEQ, 1)) || 1;
    writeJSON(KEYS.INVOICE_SEQ, seq + 1);
    return inv;
  }

  function saveBill(bill) {
    const bills = getBills();
    bills.unshift(bill);
    writeJSON(KEYS.BILLS, bills);
    return bill;
  }

  function deleteBill(billId) {
    const bills = getBills().filter((b) => b.id !== billId);
    writeJSON(KEYS.BILLS, bills);
    return bills;
  }

  global.BillBookStorage = {
    toPaise,
    fromPaise,
    formatINR,
    formatDateKey,
    formatDisplayDateTime,
    getProfile,
    saveProfile,
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    clearSampleProducts,
    getBills,
    peekNextInvoiceNumber,
    consumeNextInvoiceNumber,
    saveBill,
    deleteBill
  };
})(window);
