/**
 * Bill Book — Main Application Controller
 * Coordinates Navigation, Daily Sales Dashboard & 7-Day Chart,
 * Shop Profile, Receipt Modal, Image Download/Share, and PWA Offline Support.
 */
(function (global) {
  'use strict';

  const S = global.BillBookStorage;
  const UPI = global.BillBookUPI;

  let activeBillForReceipt = null;
  let deferredInstallPrompt = null;
  let lastChartBars = [];

  // ==================== TOASTS ====================
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // ==================== NAVIGATION ====================
  let productsCtrl = null;
  let billingCtrl = null;
  let historyCtrl = null;

  function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === 'view-' + viewName);
    });
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'billing' && billingCtrl) billingCtrl.render();
    if (viewName === 'products' && productsCtrl) productsCtrl.render();
    if (viewName === 'history' && historyCtrl) historyCtrl.render();
    if (viewName === 'profile') loadProfileForm();
  }

  // ==================== DASHBOARD & 7-DAY CHART ====================
  function renderDashboard() {
    const bills = S.getBills();
    const products = S.getProducts();
    const todayKey = S.formatDateKey(new Date());

    document.getElementById('dashboard-date-label').textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const todayBills = bills.filter((b) => b.dateKey === todayKey);
    const todayTotalPaise = todayBills.reduce((sum, b) => sum + S.toPaise(b.grandTotal), 0);
    const avgBillPaise = todayBills.length > 0 ? Math.round(todayTotalPaise / todayBills.length) : 0;

    document.getElementById('kpi-today-sales').textContent = S.formatINR(S.fromPaise(todayTotalPaise));
    document.getElementById('kpi-today-bills').textContent = String(todayBills.length);
    document.getElementById('kpi-avg-bill').textContent = S.formatINR(S.fromPaise(avgBillPaise));

    const allTimePaise = bills.reduce((sum, b) => sum + S.toPaise(b.grandTotal), 0);
    document.getElementById('summary-alltime-sales').textContent = S.formatINR(S.fromPaise(allTimePaise));
    document.getElementById('summary-alltime-bills').textContent = String(bills.length);
    document.getElementById('summary-products-count').textContent = String(products.length);

    // 7-day data
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = S.formatDateKey(d);
      const dayPaise = bills
        .filter((b) => b.dateKey === key)
        .reduce((sum, b) => sum + S.toPaise(b.grandTotal), 0);
      days.push({
        key,
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        amount: S.fromPaise(dayPaise)
      });
    }

    const sevenDayTotalPaise = days.reduce((sum, d) => sum + S.toPaise(d.amount), 0);
    document.getElementById('chart-7day-total').textContent = S.formatINR(S.fromPaise(sevenDayTotalPaise));
    document.getElementById('summary-7day-avg').textContent = S.formatINR(S.fromPaise(Math.round(sevenDayTotalPaise / 7)));

    drawSalesChart(days);
    renderRecentTransactions(bills.slice(0, 5));
  }

  function renderRecentTransactions(recentBills) {
    const list = document.getElementById('recent-transactions-list');
    list.innerHTML = '';
    if (recentBills.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:18px 8px;">No bills generated yet.</div>';
      return;
    }

    recentBills.forEach((b) => {
      const div = document.createElement('div');
      div.className = 'recent-item';
      div.innerHTML = `
        <div>
          <div class="recent-item-title num">${b.invoiceNo}</div>
          <div class="recent-item-sub">${b.customerName || 'Walk-in'} • ${S.formatDisplayDateTime(b.createdAt)}</div>
        </div>
        <div class="recent-item-amt num">${S.formatINR(b.grandTotal)}</div>
      `;
      div.addEventListener('click', () => openReceiptModal(b));
      list.appendChild(div);
    });
  }

  function drawSalesChart(days) {
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(280, rect.width || 500);
    const height = Math.max(220, rect.height || 260);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padTop = 24;
    const padBottom = 38;
    const padLeft = 14;
    const padRight = 14;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = Math.max(...days.map((d) => d.amount), 100);

    // Subtle horizontal gridlines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const gy = padTop + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(width - padRight, gy);
      ctx.stroke();
    }

    const slotW = chartW / days.length;
    const barW = Math.min(40, slotW * 0.56);
    lastChartBars = [];

    days.forEach((d, idx) => {
      const ratio = maxVal > 0 ? d.amount / maxVal : 0;
      const barH = Math.max(d.amount > 0 ? 6 : 2, ratio * chartH);
      const x = padLeft + slotW * idx + (slotW - barW) / 2;
      const y = padTop + chartH - barH;
      const isToday = idx === days.length - 1;

      ctx.fillStyle = d.amount === 0 ? '#E2E8F0' : (isToday ? '#0F8B5D' : '#6EE7B7');
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
      } else {
        ctx.rect(x, y, barW, barH);
      }
      ctx.fill();

      // Day label
      ctx.fillStyle = isToday ? '#0F172A' : '#64748B';
      ctx.font = `${isToday ? '600' : '500'} 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, height - 14);

      lastChartBars.push({ x, y: padTop, w: barW, h: chartH, data: d });
    });
  }

  function setupChartTooltip() {
    const canvas = document.getElementById('sales-chart');
    const tooltip = document.getElementById('chart-tooltip');
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const hit = lastChartBars.find((b) => mx >= b.x - 6 && mx <= b.x + b.w + 6);
      if (hit) {
        tooltip.textContent = `${hit.data.dateLabel}: ${S.formatINR(hit.data.amount)}`;
        tooltip.style.left = Math.min(rect.width - 130, Math.max(8, hit.x - 20)) + 'px';
        tooltip.style.top = '8px';
        tooltip.classList.remove('hidden');
      } else {
        tooltip.classList.add('hidden');
      }
    });
    canvas.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  }

  // ==================== SHOP PROFILE ====================
  function updateSidebarShopBadge() {
    const p = S.getProfile();
    document.getElementById('sidebar-shop-name').textContent = p.shopName || 'My Shop';
    document.getElementById('mobile-shop-name').textContent = p.shopName || 'My Shop';
    const upiEl = document.getElementById('sidebar-shop-upi');
    if (p.upiId) {
      upiEl.textContent = 'UPI: ' + p.upiId;
      upiEl.style.color = '#0F8B5D';
    } else {
      upiEl.textContent = 'UPI not configured';
      upiEl.style.color = '#64748B';
    }
  }

  function loadProfileForm() {
    const p = S.getProfile();
    document.getElementById('profile-shop-name').value = p.shopName || '';
    document.getElementById('profile-owner-name').value = p.ownerName || '';
    document.getElementById('profile-address').value = p.address || '';
    document.getElementById('profile-phone').value = p.phone || '';
    document.getElementById('profile-gst').value = p.gstNumber || '';
    document.getElementById('profile-upi').value = p.upiId || '';
    renderLogoPreview(p.logoDataUrl);
  }

  function renderLogoPreview(dataUrl) {
    const preview = document.getElementById('profile-logo-preview');
    const removeBtn = document.getElementById('profile-logo-remove');
    if (dataUrl) {
      preview.innerHTML = `<img src="${dataUrl}" alt="Shop Logo" />`;
      removeBtn.classList.remove('hidden');
    } else {
      preview.innerHTML = '<span>LOGO</span>';
      removeBtn.classList.add('hidden');
    }
  }

  function setupProfileForm() {
    let pendingLogoDataUrl = S.getProfile().logoDataUrl || '';

    document.getElementById('profile-logo-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          pendingLogoDataUrl = canvas.toDataURL('image/png', 0.9);
          renderLogoPreview(pendingLogoDataUrl);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('profile-logo-remove').addEventListener('click', () => {
      pendingLogoDataUrl = '';
      document.getElementById('profile-logo-input').value = '';
      renderLogoPreview('');
    });

    document.getElementById('shop-profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const shopName = document.getElementById('profile-shop-name').value.trim();
      const ownerName = document.getElementById('profile-owner-name').value.trim();
      const address = document.getElementById('profile-address').value.trim();
      const phone = document.getElementById('profile-phone').value.trim();
      const gstNumber = document.getElementById('profile-gst').value.trim().toUpperCase();
      const upiId = document.getElementById('profile-upi').value.trim();

      if (!shopName) {
        showToast('Shop Name is required.', 'error');
        document.getElementById('profile-shop-name').focus();
        return;
      }
      if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) {
        showToast('Please enter a valid phone number.', 'error');
        document.getElementById('profile-phone').focus();
        return;
      }
      if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber)) {
        showToast('GST Number format looks invalid (expected 15-character GSTIN).', 'error');
        document.getElementById('profile-gst').focus();
        return;
      }
      if (upiId && !/^[a-zA-Z0-9._\-]{2,}@[a-zA-Z0-9]{2,}$/.test(upiId)) {
        showToast('Please enter a valid UPI ID (e.g., myshop@okicici).', 'error');
        document.getElementById('profile-upi').focus();
        return;
      }

      S.saveProfile({
        shopName,
        ownerName,
        address,
        phone,
        gstNumber,
        upiId,
        logoDataUrl: pendingLogoDataUrl
      });

      updateSidebarShopBadge();
      showToast('Shop profile saved!', 'success');
    });
  }

  // ==================== RECEIPT MODAL & IMAGE EXPORT ====================
  function openReceiptModal(bill) {
    activeBillForReceipt = bill;
    const profile = S.getProfile();
    const modal = document.getElementById('modal-receipt');

    const logoEl = document.getElementById('receipt-shop-logo');
    if (profile.logoDataUrl) {
      logoEl.src = profile.logoDataUrl;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.classList.add('hidden');
    }

    document.getElementById('receipt-shop-name').textContent = profile.shopName || 'My Shop';
    document.getElementById('receipt-shop-address').textContent = profile.address || '';

    const contactParts = [];
    if (profile.ownerName) contactParts.push(profile.ownerName);
    if (profile.phone) contactParts.push('Ph: ' + profile.phone);
    document.getElementById('receipt-shop-contact').textContent = contactParts.join(' • ');
    document.getElementById('receipt-shop-gst').textContent = profile.gstNumber ? 'GSTIN: ' + profile.gstNumber : '';

    document.getElementById('receipt-inv-no').textContent = bill.invoiceNo;
    document.getElementById('receipt-date').textContent = S.formatDisplayDateTime(bill.createdAt);

    const custRow = document.getElementById('receipt-customer-row');
    if (bill.customerName || bill.customerPhone) {
      custRow.textContent = 'Customer: ' + (bill.customerName || 'Walk-in') + (bill.customerPhone ? ' (' + bill.customerPhone + ')' : '');
      custRow.classList.remove('hidden');
    } else {
      custRow.classList.add('hidden');
    }

    const tbody = document.getElementById('receipt-items-body');
    tbody.innerHTML = '';
    bill.items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td class="text-right num">${item.qty}</td>
        <td class="text-right num">${S.formatINR(item.price)}</td>
        <td class="text-right num"><strong>${S.formatINR(item.total)}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('receipt-subtotal').textContent = S.formatINR(bill.subtotal);

    const discRow = document.getElementById('receipt-discount-row');
    if (bill.discountAmount > 0) {
      document.getElementById('receipt-discount-label').textContent = bill.discountType === 'percent'
        ? `Discount (${bill.discountValue}%)`
        : 'Discount';
      document.getElementById('receipt-discount').textContent = '-' + S.formatINR(bill.discountAmount);
      discRow.classList.remove('hidden');
    } else {
      discRow.classList.add('hidden');
    }

    const taxRow = document.getElementById('receipt-tax-row');
    if (bill.taxAmount > 0) {
      document.getElementById('receipt-tax-label').textContent = `GST (${bill.taxRate}%)`;
      document.getElementById('receipt-tax').textContent = S.formatINR(bill.taxAmount);
      taxRow.classList.remove('hidden');
    } else {
      taxRow.classList.add('hidden');
    }

    document.getElementById('receipt-total').textContent = S.formatINR(bill.grandTotal);

    // Render UPI QR or Missing Message
    const qrCanvas = document.getElementById('receipt-qr-canvas');
    const qrValidBox = document.getElementById('receipt-qr-valid');
    const qrMissingBox = document.getElementById('receipt-qr-missing');
    const qrRes = UPI.renderUpiQrToCanvas(qrCanvas, bill, profile, 180);

    if (qrRes.ok) {
      document.getElementById('receipt-qr-amount').textContent = S.formatINR(bill.grandTotal);
      document.getElementById('receipt-qr-upi').textContent = 'UPI ID: ' + profile.upiId;
      qrValidBox.classList.remove('hidden');
      qrMissingBox.classList.add('hidden');
    } else {
      qrValidBox.classList.add('hidden');
      qrMissingBox.classList.remove('hidden');
    }

    modal.classList.remove('hidden');
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function setupReceiptModal() {
    const modal = document.getElementById('modal-receipt');
    const close = () => modal.classList.add('hidden');

    document.getElementById('modal-receipt-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.getElementById('btn-go-profile-upi').addEventListener('click', () => {
      close();
      switchView('profile');
      document.getElementById('profile-upi').focus();
    });

    document.getElementById('btn-download-bill-img').addEventListener('click', async () => {
      if (!activeBillForReceipt) return;
      const blob = await UPI.generateReceiptImageBlob(activeBillForReceipt, S.getProfile());
      triggerBlobDownload(blob, `Bill-${activeBillForReceipt.invoiceNo}.png`);
      showToast('Receipt image downloaded!', 'success');
    });

    document.getElementById('btn-share-bill-img').addEventListener('click', async () => {
      if (!activeBillForReceipt) return;
      const profile = S.getProfile();
      const blob = await UPI.generateReceiptImageBlob(activeBillForReceipt, profile);
      const filename = `Bill-${activeBillForReceipt.invoiceNo}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${profile.shopName || 'Bill Book'} — ${activeBillForReceipt.invoiceNo}`,
            text: `Invoice ${activeBillForReceipt.invoiceNo} for ${S.formatINR(activeBillForReceipt.grandTotal)}`,
            files: [file]
          });
          showToast('Bill shared!', 'success');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

      // Fallback to download
      triggerBlobDownload(blob, filename);
      showToast('Sharing not supported on this browser — receipt image downloaded instead.', 'success');
    });
  }

  // ==================== PWA & NETWORK STATUS ====================
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }

    const installBtn = document.getElementById('btn-install-pwa');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });

    function updateOnlineStatus() {
      const dot = document.querySelector('#network-status .status-dot');
      const text = document.querySelector('#network-status .status-text');
      if (navigator.onLine) {
        dot.className = 'status-dot online';
        text.textContent = 'Ready Offline';
      } else {
        dot.className = 'status-dot offline';
        text.textContent = 'Offline Mode';
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  // ==================== BOOTSTRAP ====================
  document.addEventListener('DOMContentLoaded', () => {
    updateSidebarShopBadge();
    setupProfileForm();
    setupReceiptModal();
    setupChartTooltip();
    setupPWA();

    productsCtrl = global.BillBookProducts.initProductsView(() => {
      if (billingCtrl) billingCtrl.renderProductPicker();
      renderDashboard();
    });

    billingCtrl = global.BillBookBilling.initBillingView((bill) => {
      renderDashboard();
      if (historyCtrl) historyCtrl.render();
      openReceiptModal(bill);
    });

    historyCtrl = global.BillBookHistory.initHistoryView(
      (bill) => openReceiptModal(bill),
      () => renderDashboard()
    );

    // Navigation bindings
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('dash-new-bill-btn').addEventListener('click', () => switchView('billing'));
    document.getElementById('mobile-quick-bill').addEventListener('click', () => switchView('billing'));
    document.getElementById('dash-view-all-history').addEventListener('click', () => switchView('history'));

    window.addEventListener('resize', () => {
      if (document.getElementById('view-dashboard').classList.contains('active')) {
        renderDashboard();
      }
    });

    renderDashboard();
  });

  global.BillBookApp = { showToast, switchView };
})(window);
