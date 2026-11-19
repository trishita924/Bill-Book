/**
 * Bill Book — Bill History Module
 * Search by invoice number or customer name, filter by date, view or re-download old bills.
 */
(function (global) {
  'use strict';

  const S = global.BillBookStorage;

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initHistoryView(onOpenBill, onHistoryChanged) {
    const searchInput = document.getElementById('history-search');
    const datePreset = document.getElementById('history-date-preset');
    const datePicker = document.getElementById('history-date-picker');
    const tbody = document.getElementById('history-tbody');
    const emptyState = document.getElementById('history-empty');

    function getLast7DayKeys() {
      const keys = new Set();
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        keys.add(S.formatDateKey(d));
      }
      return keys;
    }

    function render() {
      const bills = S.getBills();
      const q = searchInput.value.trim().toLowerCase();
      const preset = datePreset.value;
      const todayKey = S.formatDateKey(new Date());
      const last7Keys = preset === '7days' ? getLast7DayKeys() : null;
      const customKey = datePicker.value;

      const filtered = bills.filter((b) => {
        const matchQ = !q ||
          b.invoiceNo.toLowerCase().includes(q) ||
          (b.customerName && b.customerName.toLowerCase().includes(q));

        let matchDate = true;
        if (preset === 'today') {
          matchDate = b.dateKey === todayKey;
        } else if (preset === '7days') {
          matchDate = last7Keys.has(b.dateKey);
        } else if (preset === 'custom' && customKey) {
          matchDate = b.dateKey === customKey;
        }
        return matchQ && matchDate;
      });

      tbody.innerHTML = '';
      emptyState.classList.toggle('hidden', filtered.length > 0);

      filtered.forEach((b) => {
        const itemCount = b.items.reduce((sum, it) => sum + it.qty, 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong class="num">${escapeHTML(b.invoiceNo)}</strong></td>
          <td class="num muted">${S.formatDisplayDateTime(b.createdAt)}</td>
          <td>${b.customerName ? escapeHTML(b.customerName) : '<span class="muted">Walk-in</span>'}</td>
          <td class="text-right num">${itemCount}</td>
          <td class="text-right num"><strong>${S.formatINR(b.grandTotal)}</strong></td>
          <td class="text-right">
            <button type="button" class="icon-btn view-bill-btn" data-id="${b.id}">View</button>
            <button type="button" class="icon-btn danger del-bill-btn" data-id="${b.id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    datePreset.addEventListener('change', () => {
      const isCustom = datePreset.value === 'custom';
      datePicker.classList.toggle('hidden', !isCustom);
      if (isCustom && !datePicker.value) {
        datePicker.value = S.formatDateKey(new Date());
      }
      render();
    });

    datePicker.addEventListener('change', render);
    searchInput.addEventListener('input', render);

    tbody.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.view-bill-btn');
      if (viewBtn) {
        const bill = S.getBills().find((b) => b.id === viewBtn.dataset.id);
        if (bill && onOpenBill) onOpenBill(bill);
        return;
      }
      const delBtn = e.target.closest('.del-bill-btn');
      if (delBtn) {
        const bill = S.getBills().find((b) => b.id === delBtn.dataset.id);
        if (bill && confirm(`Delete invoice ${bill.invoiceNo}?`)) {
          S.deleteBill(bill.id);
          render();
          if (onHistoryChanged) onHistoryChanged();
          global.BillBookApp.showToast(`Deleted ${bill.invoiceNo}.`);
        }
      }
    });

    return { render };
  }

  global.BillBookHistory = { initHistoryView };
})(window);
