/**
 * Bill Book — Product Management Module
 * Handles Add, Edit, Delete, Search, Category Filter, and Sample Data cleanup.
 */
(function (global) {
  'use strict';

  const S = global.BillBookStorage;

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initProductsView(onProductsChanged) {
    const searchInput = document.getElementById('products-search');
    const categorySelect = document.getElementById('products-category-filter');
    const tbody = document.getElementById('products-tbody');
    const emptyState = document.getElementById('products-empty');
    const clearSampleBtn = document.getElementById('btn-clear-sample-products');

    // Modal elements
    const modal = document.getElementById('modal-product');
    const modalTitle = document.getElementById('modal-product-title');
    const form = document.getElementById('product-form');
    const editIdInput = document.getElementById('product-edit-id');
    const nameInput = document.getElementById('product-name');
    const priceInput = document.getElementById('product-price');
    const catInput = document.getElementById('product-category');
    const codeInput = document.getElementById('product-code');

    function populateCategoryFilter() {
      const products = S.getProducts();
      const cats = Array.from(new Set(products.map((p) => p.category))).sort();
      const currentVal = categorySelect.value;
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      cats.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        categorySelect.appendChild(opt);
      });
      if (cats.includes(currentVal)) categorySelect.value = currentVal;
    }

    function render() {
      populateCategoryFilter();
      const products = S.getProducts();
      const hasSamples = products.some((p) => p.isSample);
      clearSampleBtn.classList.toggle('hidden', !hasSamples);

      const q = searchInput.value.trim().toLowerCase();
      const cat = categorySelect.value;

      const filtered = products.filter((p) => {
        const matchQ = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q));
        const matchCat = !cat || p.category === cat;
        return matchQ && matchCat;
      });

      tbody.innerHTML = '';
      emptyState.classList.toggle('hidden', filtered.length > 0);

      filtered.forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong>${escapeHTML(p.name)}</strong>
            ${p.isSample ? '<span class="badge badge-sample" style="margin-left:6px;">Sample</span>' : ''}
          </td>
          <td><span class="badge badge-neutral">${escapeHTML(p.category)}</span></td>
          <td class="num muted">${p.code ? escapeHTML(p.code) : '—'}</td>
          <td class="text-right num"><strong>${S.formatINR(p.price)}</strong></td>
          <td class="text-right">
            <button type="button" class="icon-btn edit-prod-btn" data-id="${p.id}">Edit</button>
            <button type="button" class="icon-btn danger del-prod-btn" data-id="${p.id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function openModal(product) {
      if (product) {
        modalTitle.textContent = 'Edit Product';
        editIdInput.value = product.id;
        nameInput.value = product.name;
        priceInput.value = Number(product.price).toFixed(2);
        catInput.value = product.category || 'Other';
        codeInput.value = product.code || '';
      } else {
        modalTitle.textContent = 'Add Product';
        form.reset();
        editIdInput.value = '';
        catInput.value = 'Groceries';
      }
      modal.classList.remove('hidden');
      nameInput.focus();
    }

    function closeModal() {
      modal.classList.add('hidden');
      form.reset();
    }

    document.getElementById('btn-open-add-product').addEventListener('click', () => openModal(null));
    document.getElementById('modal-product-close').addEventListener('click', closeModal);
    document.getElementById('modal-product-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const price = Number(priceInput.value);
      const category = catInput.value;
      const code = codeInput.value.trim();

      if (!name) {
        global.BillBookApp.showToast('Please enter a product name.', 'error');
        nameInput.focus();
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        global.BillBookApp.showToast('Please enter a valid price greater than ₹0.', 'error');
        priceInput.focus();
        return;
      }

      const editId = editIdInput.value;
      if (editId) {
        S.updateProduct(editId, { name, price, category, code });
        global.BillBookApp.showToast('Product updated.', 'success');
      } else {
        S.addProduct({ name, price, category, code });
        global.BillBookApp.showToast('Product added.', 'success');
      }

      closeModal();
      render();
      if (onProductsChanged) onProductsChanged();
    });

    tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-prod-btn');
      if (editBtn) {
        const prod = S.getProducts().find((p) => p.id === editBtn.dataset.id);
        if (prod) openModal(prod);
        return;
      }
      const delBtn = e.target.closest('.del-prod-btn');
      if (delBtn) {
        const prod = S.getProducts().find((p) => p.id === delBtn.dataset.id);
        if (prod && confirm(`Delete "${prod.name}"?`)) {
          S.deleteProduct(prod.id);
          render();
          if (onProductsChanged) onProductsChanged();
          global.BillBookApp.showToast('Product deleted.');
        }
      }
    });

    clearSampleBtn.addEventListener('click', () => {
      if (confirm('Delete all sample products? Your own added products will remain untouched.')) {
        S.clearSampleProducts();
        render();
        if (onProductsChanged) onProductsChanged();
        global.BillBookApp.showToast('Sample products removed.', 'success');
      }
    });

    searchInput.addEventListener('input', render);
    categorySelect.addEventListener('change', render);

    return { render };
  }

  global.BillBookProducts = { initProductsView };
})(window);
