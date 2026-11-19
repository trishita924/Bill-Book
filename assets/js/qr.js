/**
 * Bill Book — UPI QR & Receipt Image Generator Module
 * Uses locally bundled BillBookQR library and HTML5 Canvas for offline image export.
 */
(function (global) {
  'use strict';

  /**
   * Build standard NPCI UPI deep link URI.
   * Returns null if no UPI ID is configured.
   */
  function buildUpiUri(bill, profile) {
    const upiId = (profile.upiId || '').trim();
    if (!upiId) return null;

    const shopName = (profile.shopName || 'Shop').trim();
    const amountStr = Number(bill.grandTotal).toFixed(2);
    const params = [
      'pa=' + encodeURIComponent(upiId),
      'pn=' + encodeURIComponent(shopName),
      'tr=' + encodeURIComponent(bill.invoiceNo),
      'tn=' + encodeURIComponent('Bill ' + bill.invoiceNo),
      'am=' + encodeURIComponent(amountStr),
      'cu=INR'
    ];
    return 'upi://pay?' + params.join('&');
  }

  /**
   * Render UPI QR onto a target <canvas> element.
   * Returns { ok: boolean, uri: string|null }.
   */
  function renderUpiQrToCanvas(canvas, bill, profile, size) {
    const uri = buildUpiUri(bill, profile);
    if (!uri || !global.BillBookQR) {
      return { ok: false, uri: null };
    }
    global.BillBookQR.renderToCanvas(canvas, uri, {
      size: size || 200,
      margin: 3,
      darkColor: '#0F172A',
      lightColor: '#FFFFFF'
    });
    return { ok: true, uri };
  }

  /**
   * Load an image DataURL into an HTMLImageElement for Canvas drawing.
   */
  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /**
   * Render a crisp, shareable PNG receipt image (including UPI QR when configured)
   * using HTML5 Canvas. Returns a Promise<Blob>.
   */
  async function generateReceiptImageBlob(bill, profile) {
    const S = global.BillBookStorage;
    const width = 760;
    const padX = 48;
    const contentW = width - padX * 2;
    const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const logoImg = await loadImage(profile.logoDataUrl);
    const upiUri = buildUpiUri(bill, profile);

    // Pre-calculate dynamic height
    let h = 50;
    if (logoImg) h += 84;
    h += 42; // shop name
    if (profile.address) h += 28;
    if (profile.phone || profile.ownerName) h += 26;
    if (profile.gstNumber) h += 26;
    h += 34; // dashed line
    h += 54; // invoice & date
    if (bill.customerName || bill.customerPhone) h += 30;
    h += 30; // dashed line + table header
    h += bill.items.length * 42;
    h += 28; // dashed line
    h += 32; // subtotal
    if (bill.discountAmount > 0) h += 30;
    if (bill.taxAmount > 0) h += 30;
    h += 54; // grand total
    h += 28; // dashed line
    if (upiUri) {
      h += 290; // QR + label + UPI ID
    } else {
      h += 40;
    }
    h += 56; // footer

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, h);

    // Subtle top accent bar
    ctx.fillStyle = '#0F8B5D';
    ctx.fillRect(0, 0, width, 10);

    let y = 46;

    // Shop Logo
    if (logoImg) {
      const logoSize = 68;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(width / 2 - logoSize / 2, y, logoSize, logoSize, 12);
      ctx.clip();
      ctx.drawImage(logoImg, width / 2 - logoSize / 2, y, logoSize, logoSize);
      ctx.restore();
      y += logoSize + 16;
    }

    // Shop Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 28px ${fontFamily}`;
    ctx.fillText(profile.shopName || 'My Shop', width / 2, y);
    y += 30;

    ctx.fillStyle = '#475569';
    ctx.font = `400 17px ${fontFamily}`;
    if (profile.address) {
      ctx.fillText(profile.address, width / 2, y, contentW);
      y += 26;
    }
    if (profile.phone || profile.ownerName) {
      const parts = [];
      if (profile.ownerName) parts.push(profile.ownerName);
      if (profile.phone) parts.push('Ph: ' + profile.phone);
      ctx.fillText(parts.join('  •  '), width / 2, y, contentW);
      y += 26;
    }
    if (profile.gstNumber) {
      ctx.fillText('GSTIN: ' + profile.gstNumber, width / 2, y);
      y += 26;
    }

    function drawDash(currY) {
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(padX, currY);
      ctx.lineTo(width - padX, currY);
      ctx.stroke();
      ctx.restore();
    }

    y += 10;
    drawDash(y);
    y += 30;

    // Invoice & Date
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 18px ${fontFamily}`;
    ctx.fillText('Invoice: ' + bill.invoiceNo, padX, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `400 16px ${fontFamily}`;
    ctx.fillText(S.formatDisplayDateTime(bill.createdAt), width - padX, y);
    y += 28;

    if (bill.customerName || bill.customerPhone) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = `500 16px ${fontFamily}`;
      const cust = ['Customer: ' + (bill.customerName || 'Walk-in')];
      if (bill.customerPhone) cust.push('(' + bill.customerPhone + ')');
      ctx.fillText(cust.join(' '), padX, y, contentW);
      y += 28;
    }

    y += 4;
    drawDash(y);
    y += 26;

    // Items Table Header
    ctx.fillStyle = '#64748B';
    ctx.font = `700 14px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.fillText('ITEM', padX, y);
    ctx.textAlign = 'right';
    ctx.fillText('QTY', padX + contentW * 0.60, y);
    ctx.fillText('RATE', padX + contentW * 0.78, y);
    ctx.fillText('AMOUNT', width - padX, y);
    y += 14;

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
    y += 26;

    // Items Rows
    ctx.font = `500 17px ${fontFamily}`;
    bill.items.forEach((item) => {
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'left';
      const maxNameW = contentW * 0.50;
      let displayName = item.name;
      if (ctx.measureText(displayName).width > maxNameW) {
        while (displayName.length > 3 && ctx.measureText(displayName + '…').width > maxNameW) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '…';
      }
      ctx.fillText(displayName, padX, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#334155';
      ctx.fillText(String(item.qty), padX + contentW * 0.60, y);
      ctx.fillText(S.formatINR(item.price), padX + contentW * 0.78, y);
      ctx.fillStyle = '#0F172A';
      ctx.font = `600 17px ${fontFamily}`;
      ctx.fillText(S.formatINR(item.total), width - padX, y);
      ctx.font = `500 17px ${fontFamily}`;
      y += 40;
    });

    drawDash(y - 10);
    y += 22;

    // Totals
    function drawTotalRow(label, valStr, color, bold) {
      ctx.textAlign = 'left';
      ctx.fillStyle = color || '#475569';
      ctx.font = `${bold ? '700 22px' : '500 17px'} ${fontFamily}`;
      ctx.fillText(label, padX, y);
      ctx.textAlign = 'right';
      ctx.fillText(valStr, width - padX, y);
      y += bold ? 42 : 30;
    }

    drawTotalRow('Subtotal', S.formatINR(bill.subtotal));
    if (bill.discountAmount > 0) {
      const discLabel = bill.discountType === 'percent'
        ? `Discount (${bill.discountValue}%)`
        : 'Discount';
      drawTotalRow(discLabel, '-' + S.formatINR(bill.discountAmount), '#0F8B5D');
    }
    if (bill.taxAmount > 0) {
      drawTotalRow(`GST (${bill.taxRate}%)`, S.formatINR(bill.taxAmount));
    }

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, y - 14);
    ctx.lineTo(width - padX, y - 14);
    ctx.stroke();
    y += 10;

    drawTotalRow('TOTAL PAYABLE', S.formatINR(bill.grandTotal), '#0F172A', true);

    drawDash(y - 6);
    y += 22;

    // UPI QR Section
    if (upiUri && global.BillBookQR) {
      const qrCanvas = document.createElement('canvas');
      global.BillBookQR.renderToCanvas(qrCanvas, upiUri, {
        size: 196,
        margin: 3,
        darkColor: '#0F172A',
        lightColor: '#FFFFFF'
      });

      const qrBoxSize = qrCanvas.width + 16;
      const qrX = (width - qrBoxSize) / 2;
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX, y, qrBoxSize, qrBoxSize);
      ctx.drawImage(qrCanvas, qrX + 8, y + 8);
      y += qrBoxSize + 26;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.font = `600 17px ${fontFamily}`;
      ctx.fillText(`Scan to pay ${S.formatINR(bill.grandTotal)} via UPI`, width / 2, y);
      y += 22;

      ctx.fillStyle = '#64748B';
      ctx.font = `400 15px ${fontFamily}`;
      ctx.fillText('UPI ID: ' + profile.upiId, width / 2, y);
      y += 28;
    }

    // Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = `500 15px ${fontFamily}`;
    ctx.fillText('Thank you for your business!  •  Bill Book', width / 2, y + 12);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  global.BillBookUPI = {
    buildUpiUri,
    renderUpiQrToCanvas,
    generateReceiptImageBlob
  };
})(window);
