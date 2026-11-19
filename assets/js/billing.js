/**
 * Bill Book — Bill Generator Module
 * Handles product selection, custom items, quantity steppers,
 * paise-accurate discount & GST calculations, and invoice generation.
 */
(function (global) {
  'use strict';

  const S = global.BillBookStorage;

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initBillingView(onBillCreated) {
    let cart = []; // { key, name, price, qty, isCustom }
    let discountType = 'percent'; // 'percent' | 'flat'

    const searchInput = document.getElementById('billing-product-search');
    const catSelect = document.getElementById('billing-category-filter');
    const pickerGrid = document.getElementById('billing-product-grid');
    const prodCountBadge = document.getElementById('billing-product-count');

    const customForm = document.getElementById('custom-item-form');
    const customNameInput = document.getElementById('custom-item-name');
    const customPriceInput = document.getElementById('custom-item-price');
    const customQtyInput = document.getElementById('custom-item-qty');

    const invoiceNoEl = document.getElementById('bill-invoice-no');
    const datetimeEl = document.getElementById('bill-datetime');
    const custNameInput = document.getElementById('bill-customer-name');
    const custPhoneInput = document.getElementById('bill-customer-phone');

    const cartListEl = document.getElementById('bill-cart-items');
    const cartCountEl = document.getElementById('cart-item-count');

    const segBtns = document.querySelectorAll('.seg-btn[data-discount-type]');
    const discountInput = document.getElementById('bill-discount-value');
    const taxPresetSelect = document.getElementById('bill-tax-preset');
    const taxRateInput = document.getElementById('bill-tax-rate');

    const subtotalEl = document.getElementById('bill-subtotal');
    const discountLabelEl = document.getElementById('bill-discount-label');
    const discountAmtEl = document.getElementById('bill-discount-amount');
    const taxLabelEl = document.getElementById('bill-tax-label');
    const taxAmtEl = document.getElementById('bill-tax-amount');
    const grandTotalEl = document.getElementById('bill-grand-total');

    function updateInvoiceHeader() {
      invoiceNoEl.textContent = S.peekNextInvoiceNumber();
      datetimeEl.textContent = S.formatDisplayDateTime(new Date().toISOString());
    }

    function populateCategories() {
      const products = S.getProducts();
      const cats = Array.from(new Set(products.map((p) => p.category))).sort();
      const prev = catSelect.value;
      catSelect.innerHTML = '<option value="">All Categories</option>';
      cats.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catSelect.appendChild(opt);
      });
      if (cats.includes(prev)) catSelect.value = prev;
    }

    function renderProductPicker() {
      populateCategories();
      const products = S.getProducts();
      const q = searchInput.value.trim().toLowerCase();
      const cat = catSelect.value;

      const filtered = products.filter((p) => {
        const matchQ = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q));
        const matchCat = !cat || p.category === cat;
        return matchQ && matchCat;
      });

      prodCountBadge.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
      pickerGrid.innerHTML = '';

      if (filtered.length === 0) {
        pickerGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:20px;">No matching products. Use "Add Custom Item" below.</div>';
        return;
      }

      filtered.forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-card';
        btn.dataset.productId = p.id;
        btn.innerHTML = `
          <div>
            <div class="picker-card-name">${escapeHTML(p.name)}</div>
            <div class="picker-card-cat">${escapeHTML(p.category)}</div>
          </div>
          <div class="picker-card-bottom">
            <span class="picker-card-price num">${S.formatINR(p.price)}</span>
            <span class="picker-add-pill">+ Add</span>
          </div>
        `;
        pickerGrid.appendChild(btn);
      });
    }

    function addProductToCart(product) {
      const key = 'prod:' + product.id;
      const existing = cart.find((item) => item.key === key);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({
          key,
          name: product.name,
          price: S.fromPaise(S.toPaise(product.price)),
          qty: 1,
          isCustom: false
        });
      }
      renderCart();
    }

    function getTaxRate() {
      if (taxPresetSelect.value === 'custom') {
        const v = Number(taxRateInput.value);
        return Number.isFinite(v) && v >= 0 ? Math.min(100, v) : 0;
      }
      return Number(taxPresetSelect.value) || 0;
    }

    function calculateTotals() {
      let subtotalPaise = 0;
      const lineItems = cart.map((item) => {
        const unitPaise = S.toPaise(item.price);
        const linePaise = unitPaise * item.qty;
        subtotalPaise += linePaise;
        return {
          name: item.name,
          price: S.fromPaise(unitPaise),
          qty: item.qty,
          total: S.fromPaise(linePaise)
        };
      });

      const rawDiscVal = Math.max(0, Number(discountInput.value) || 0);
      let discountPaise = 0;
      let effectiveDiscVal = rawDiscVal;

      if (discountType === 'percent') {
        effectiveDiscVal = Math.min(100, rawDiscVal);
        discountPaise = Math.round((subtotalPaise * effectiveDiscVal) / 100);
      } else {
        discountPaise = Math.min(subtotalPaise, S.toPaise(rawDiscVal));
        effectiveDiscVal = S.fromPaise(discountPaise);
      }

      const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
      const taxRate = getTaxRate();
      const taxPaise = Math.round((taxablePaise * taxRate) / 100);
      const grandTotalPaise = taxablePaise + taxPaise;

      return {
        items: lineItems,
        subtotal: S.fromPaise(subtotalPaise),
        discountType,
        discountValue: effectiveDiscVal,
        discountAmount: S.fromPaise(discountPaise),
        taxRate,
        taxAmount: S.fromPaise(taxPaise),
        grandTotal: S.fromPaise(grandTotalPaise)
      };
    }

    function renderTotals() {
      const t = calculateTotals();
      subtotalEl.textContent = S.formatINR(t.subtotal);
      discountLabelEl.textContent = t.discountAmount > 0 && t.discountType === 'percent'
        ? `(${t.discountValue}%)`
        : '';
      discountAmtEl.textContent = '-' + S.formatINR(t.discountAmount);
      taxLabelEl.textContent = `(${t.taxRate}%)`;
      taxAmtEl.textContent = S.formatINR(t.taxAmount);
      grandTotalEl.textContent = S.formatINR(t.grandTotal);
    }

    function renderCart() {
      const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
      cartCountEl.textContent = String(totalQty);
      cartListEl.innerHTML = '';

      if (cart.length === 0) {
        cartListEl.innerHTML = '<div class="cart-empty">No items added yet. Tap a product on the left to add it to the bill.</div>';
        renderTotals();
        return;
      }

      cart.forEach((item, idx) => {
        const lineTotal = S.fromPaise(S.toPaise(item.price) * item.qty);
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHTML(item.name)}</div>
            <div class="cart-item-rate num">${S.formatINR(item.price)} each</div>
          </div>
          <div class="qty-stepper">
            <button type="button" class="qty-btn qty-dec" data-idx="${idx}" aria-label="Decrease quantity">−</button>
            <input type="number" class="qty-val num" data-idx="${idx}" value="${item.qty}" min="1" step="1" aria-label="Quantity" />
            <button type="button" class="qty-btn qty-inc" data-idx="${idx}" aria-label="Increase quantity">+</button>
          </div>
          <div class="cart-item-right">
            <span class="cart-item-total num">${S.formatINR(lineTotal)}</span>
            <button type="button" class="cart-remove-btn" data-idx="${idx}" aria-label="Remove item">&times;</button>
          </div>
        `;
        cartListEl.appendChild(row);
      });

      renderTotals();
    }

    function clearBill(silent) {
      cart = [];
      custNameInput.value = '';
      custPhoneInput.value = '';
      discountInput.value = '0';
      taxPresetSelect.value = '0';
      taxRateInput.value = '0';
      taxRateInput.classList.add('hidden');
      updateInvoiceHeader();
      renderCart();
      if (!silent) {
        global.BillBookApp.showToast('Bill cleared.');
      }
    }

    // Event: Picker click
    pickerGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.picker-card');
      if (!card) return;
      const prod = S.getProducts().find((p) => p.id === card.dataset.productId);
      if (prod) addProductToCart(prod);
    });

    // Event: Custom Item submit
    customForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = customNameInput.value.trim();
      const price = Number(customPriceInput.value);
      const qty = parseInt(customQtyInput.value, 10);

      if (!name) {
        global.BillBookApp.showToast('Enter a custom item name.', 'error');
        customNameInput.focus();
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        global.BillBookApp.showToast('Enter a valid price greater than ₹0.', 'error');
        customPriceInput.focus();
        return;
      }
      if (!Number.isInteger(qty) || qty < 1) {
        global.BillBookApp.showToast('Quantity must be at least 1.', 'error');
        customQtyInput.focus();
        return;
      }

      cart.push({
        key: 'custom:' + Date.now() + ':' + Math.random().toString(36).slice(2, 5),
        name,
        price: S.fromPaise(S.toPaise(price)),
        qty,
        isCustom: true
      });

      customForm.reset();
      customQtyInput.value = '1';
      renderCart();
      global.BillBookApp.showToast(`Added "${name}" to bill.`, 'success');
    });

    // Event: Cart quantity & removal
    cartListEl.addEventListener('click', (e) => {
      const decBtn = e.target.closest('.qty-dec');
      const incBtn = e.target.closest('.qty-inc');
      const remBtn = e.target.closest('.cart-remove-btn');

      if (decBtn) {
        const idx = Number(decBtn.dataset.idx);
        if (cart[idx].qty > 1) {
          cart[idx].qty -= 1;
        } else {
          cart.splice(idx, 1);
        }
        renderCart();
      } else if (incBtn) {
        const idx = Number(incBtn.dataset.idx);
        cart[idx].qty += 1;
        renderCart();
      } else if (remBtn) {
        const idx = Number(remBtn.dataset.idx);
        cart.splice(idx, 1);
        renderCart();
      }
    });

    cartListEl.addEventListener('change', (e) => {
      const input = e.target.closest('.qty-val');
      if (!input) return;
      const idx = Number(input.dataset.idx);
      const val = parseInt(input.value, 10);
      if (!Number.isInteger(val) || val < 1) {
        cart[idx].qty = 1;
      } else {
        cart[idx].qty = val;
      }
      renderCart();
    });

    // Event: Discount & Tax
    segBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        segBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        discountType = btn.dataset.discountType;
        renderTotals();
      });
    });

    discountInput.addEventListener('input', () => {
      if (Number(discountInput.value) < 0) discountInput.value = '0';
      renderTotals();
    });

    taxPresetSelect.addEventListener('change', () => {
      const isCustom = taxPresetSelect.value === 'custom';
      taxRateInput.classList.toggle('hidden', !isCustom);
      if (isCustom) taxRateInput.focus();
      renderTotals();
    });

    taxRateInput.addEventListener('input', () => {
      const v = Number(taxRateInput.value);
      if (v < 0) taxRateInput.value = '0';
      if (v > 100) taxRateInput.value = '100';
      renderTotals();
    });

    document.getElementById('btn-clear-bill').addEventListener('click', () => {
      if (cart.length === 0 || confirm('Clear all items from the current bill?')) {
        clearBill(false);
      }
    });

    // Event: Generate Bill
    document.getElementById('btn-generate-bill').addEventListener('click', () => {
      if (cart.length === 0) {
        global.BillBookApp.showToast('Please add at least one item to generate a bill.', 'error');
        return;
      }

      const custPhone = custPhoneInput.value.trim();
      if (custPhone && !/^[0-9+\-\s]{7,15}$/.test(custPhone)) {
        global.BillBookApp.showToast('Please enter a valid customer phone number.', 'error');
        custPhoneInput.focus();
        return;
      }

      const rawDisc = Number(discountInput.value);
      if (!Number.isFinite(rawDisc) || rawDisc < 0) {
        global.BillBookApp.showToast('Discount cannot be negative.', 'error');
        discountInput.focus();
        return;
      }
      if (discountType === 'percent' && rawDisc > 100) {
        global.BillBookApp.showToast('Percentage discount cannot exceed 100%.', 'error');
        discountInput.focus();
        return;
      }

      const totals = calculateTotals();
      if (discountType === 'flat' && S.toPaise(rawDisc) > S.toPaise(totals.subtotal)) {
        global.BillBookApp.showToast('Discount cannot exceed subtotal.', 'error');
        discountInput.focus();
        return;
      }

      const nowIso = new Date().toISOString();
      const bill = {
        id: 'bill-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        invoiceNo: S.consumeNextInvoiceNumber(),
        createdAt: nowIso,
        dateKey: S.formatDateKey(nowIso),
        customerName: custNameInput.value.trim(),
        customerPhone: custPhone,
        items: totals.items,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal
      };

      S.saveBill(bill);
      clearBill(true);
      global.BillBookApp.showToast(`Bill ${bill.invoiceNo} generated!`, 'success');
      if (onBillCreated) onBillCreated(bill);
    });

    searchInput.addEventListener('input', renderProductPicker);
    catSelect.addEventListener('change', renderProductPicker);

    function render() {
      updateInvoiceHeader();
      renderProductPicker();
      renderCart();
    }

    render();
    return { render, renderProductPicker };
  }

  global.BillBookBilling = { initBillingView };
})(window);
