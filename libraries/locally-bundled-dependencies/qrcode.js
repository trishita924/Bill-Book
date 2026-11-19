/**
 * Bill Book — Locally Bundled QR Code Generator (ISO/IEC 18004)
 * Pure JavaScript, zero external dependencies, offline-ready.
 * Supports Byte mode (UTF-8), Error Correction Level M (15%), Versions 1-15.
 */
(function (global) {
  'use strict';

  // GF(256) log & antilog tables (primitive polynomial 0x11d)
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      EXP[i] = EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeEC(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const res = new Uint8Array(data.length + ecCount);
    res.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  // Version tables for Error Correction Level M
  // [totalCodewords, ecPerBlock, blocksGroup1, dataPerBlock1, blocksGroup2, dataPerBlock2]
  const VERSION_M = {
    1:  [26,  10, 1, 16, 0, 0],
    2:  [44,  16, 1, 28, 0, 0],
    3:  [70,  26, 1, 44, 0, 0],
    4:  [100, 18, 2, 32, 0, 0],
    5:  [134, 24, 2, 43, 0, 0],
    6:  [172, 16, 4, 27, 0, 0],
    7:  [196, 18, 4, 31, 0, 0],
    8:  [242, 22, 2, 38, 2, 39],
    9:  [292, 22, 3, 36, 2, 37],
    10: [346, 26, 4, 43, 1, 44],
    11: [404, 30, 1, 50, 4, 51],
    12: [466, 22, 6, 36, 2, 37],
    13: [532, 22, 8, 37, 1, 38],
    14: [581, 24, 4, 40, 5, 41],
    15: [655, 24, 5, 41, 5, 42]
  };

  const ALIGNMENT_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
    11: [6, 30, 54],
    12: [6, 32, 58],
    13: [6, 34, 62],
    14: [6, 26, 46, 66],
    15: [6, 26, 48, 70]
  };

  // Format info for EC Level M (00) + mask (0..7), pre-computed BCH(15,5) XOR 0x5412
  const FORMAT_INFO_M = [
    0x5412, 0x5125, 0x5E7C, 0x5B4B,
    0x45F9, 0x40CE, 0x4F97, 0x4AA0
  ];

  // Version info for versions 7..15, BCH(18,6)
  const VERSION_INFO = {
    7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3,
    11: 0x0BBF6, 12: 0x0C762, 13: 0x0D847, 14: 0x0E60D, 15: 0x0F928
  };

  function encodeUTF8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(str));
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return bytes;
  }

  function selectVersion(byteLen) {
    for (let v = 1; v <= 15; v++) {
      const [, , b1, d1, b2, d2] = VERSION_M[v];
      const totalDataBytes = b1 * d1 + b2 * d2;
      const headerBits = 4 + (v < 10 ? 8 : 16);
      const capacityBytes = Math.floor((totalDataBytes * 8 - headerBits) / 8);
      if (byteLen <= capacityBytes) return v;
    }
    throw new Error('Data too long for QR code (max ~412 bytes)');
  }

  function buildDataCodewords(bytes, version) {
    const [, , b1, d1, b2, d2] = VERSION_M[version];
    const totalDataBytes = b1 * d1 + b2 * d2;
    const bits = [];

    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }

    // Mode: Byte = 0100
    pushBits(0b0100, 4);
    // Character count indicator
    pushBits(bytes.length, version < 10 ? 8 : 16);
    // Data bytes
    for (let i = 0; i < bytes.length; i++) {
      pushBits(bytes[i], 8);
    }
    // Terminator (up to 4 zeros)
    const maxBits = totalDataBytes * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }

    // Pad codewords 0xEC, 0x11
    let padToggle = 0;
    while (codewords.length < totalDataBytes) {
      codewords.push(padToggle === 0 ? 0xec : 0x11);
      padToggle ^= 1;
    }
    return codewords;
  }

  function interleaveBlocks(dataCodewords, version) {
    const [, ecPerBlock, b1, d1, b2, d2] = VERSION_M[version];
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (let i = 0; i < b1; i++) {
      const block = dataCodewords.slice(offset, offset + d1);
      offset += d1;
      dataBlocks.push(block);
      ecBlocks.push(Array.from(rsComputeEC(block, ecPerBlock)));
    }
    for (let i = 0; i < b2; i++) {
      const block = dataCodewords.slice(offset, offset + d2);
      offset += d2;
      dataBlocks.push(block);
      ecBlocks.push(Array.from(rsComputeEC(block, ecPerBlock)));
    }

    const result = [];
    const maxDataLen = Math.max(d1, d2);
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (i < dataBlocks[b].length) result.push(dataBlocks[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        result.push(ecBlocks[b][i]);
      }
    }
    return result;
  }

  function createMatrix(version) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val, isReserved) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        modules[r][c] = val ? 1 : 0;
        if (isReserved) reserved[r][c] = 1;
      }
    }

    function placeFinder(r0, c0) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r;
          const cc = c0 + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(rr, cc, !isBorder && (isOuter || isInner), true);
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Alignment patterns (placed before timing patterns so only finder overlaps are skipped)
    const pos = ALIGNMENT_POS[version];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const r = pos[i];
        const c = pos[j];
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, dark, true);
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) setModule(6, i, i % 2 === 0, true);
      if (!reserved[i][6]) setModule(i, 6, i % 2 === 0, true);
    }

    // Dark module
    setModule(size - 8, 8, 1, true);

    // Reserve format info areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        reserved[8][i] = 1;
        reserved[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = 1;
      reserved[size - 1 - i][8] = 1;
    }

    // Version info for v >= 7
    if (version >= 7) {
      const vInfo = VERSION_INFO[version];
      for (let i = 0; i < 18; i++) {
        const bit = (vInfo >> i) & 1;
        const r = Math.floor(i / 3);
        const c = size - 11 + (i % 3);
        setModule(r, c, bit, true);
        setModule(c, r, bit, true);
      }
    }

    return { size, modules, reserved };
  }

  function placeData(matrix, codewords) {
    const { size, modules, reserved } = matrix;
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let up = true;

    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const r = up ? size - 1 - step : step;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (!reserved[r][c]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              const cw = codewords[bitIdx >> 3];
              bit = (cw >> (7 - (bitIdx & 7))) & 1;
              bitIdx++;
            }
            modules[r][c] = bit;
          }
        }
      }
      up = !up;
    }
  }

  function applyMask(baseMatrix, maskId) {
    const size = baseMatrix.size;
    const out = Array.from({ length: size }, (_, r) => Int8Array.from(baseMatrix.modules[r]));
    const reserved = baseMatrix.reserved;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r][c]) continue;
        let invert = false;
        switch (maskId) {
          case 0: invert = (r + c) % 2 === 0; break;
          case 1: invert = r % 2 === 0; break;
          case 2: invert = c % 3 === 0; break;
          case 3: invert = (r + c) % 3 === 0; break;
          case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
          case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
          case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
          case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        }
        if (invert) out[r][c] ^= 1;
      }
    }

    // Write format info
    const fmt = FORMAT_INFO_M[maskId];
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      // Vertical
      if (i < 6) out[i][8] = bit;
      else if (i < 8) out[i + 1][8] = bit;
      else out[size - 15 + i][8] = bit;
      // Horizontal
      if (i < 8) out[8][size - 1 - i] = bit;
      else if (i < 9) out[8][7] = bit;
      else out[8][14 - i] = bit;
    }

    return out;
  }

  function scorePenalty(modules) {
    const n = modules.length;
    let penalty = 0;

    // Rule 1: 5+ consecutive same-color modules
    for (let r = 0; r < n; r++) {
      let runLen = 1;
      for (let c = 1; c < n; c++) {
        if (modules[r][c] === modules[r][c - 1]) {
          runLen++;
          if (runLen === 5) penalty += 3;
          else if (runLen > 5) penalty += 1;
        } else {
          runLen = 1;
        }
      }
    }
    for (let c = 0; c < n; c++) {
      let runLen = 1;
      for (let r = 1; r < n; r++) {
        if (modules[r][c] === modules[r - 1][c]) {
          runLen++;
          if (runLen === 5) penalty += 3;
          else if (runLen > 5) penalty += 1;
        } else {
          runLen = 1;
        }
      }
    }

    // Rule 2: 2x2 blocks
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // Rule 3: 1:1:3:1:1 finder-like patterns
    const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n - 11; c++) {
        let m1 = true, m2 = true, m3 = true, m4 = true;
        for (let k = 0; k < 11; k++) {
          if (modules[r][c + k] !== p1[k]) m1 = false;
          if (modules[r][c + k] !== p2[k]) m2 = false;
          if (modules[c + k][r] !== p1[k]) m3 = false;
          if (modules[c + k][r] !== p2[k]) m4 = false;
        }
        if (m1 || m2) penalty += 40;
        if (m3 || m4) penalty += 40;
      }
    }

    // Rule 4: dark module ratio
    let dark = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (modules[r][c]) dark++;
      }
    }
    const pct = (dark * 100) / (n * n);
    const prev5 = Math.floor(pct / 5) * 5;
    const next5 = Math.ceil(pct / 5) * 5;
    penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

    return penalty;
  }

  /**
   * Generate a QR code matrix for the given text.
   * @param {string} text
   * @returns {{ size: number, modules: Int8Array[], version: number }}
   */
  function generateMatrix(text) {
    const bytes = encodeUTF8(String(text));
    const version = selectVersion(bytes.length);
    const dataCw = buildDataCodewords(bytes, version);
    const fullCw = interleaveBlocks(dataCw, version);
    const base = createMatrix(version);
    placeData(base, fullCw);

    let bestModules = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const masked = applyMask(base, mask);
      const score = scorePenalty(masked);
      if (score < bestScore) {
        bestScore = score;
        bestModules = masked;
      }
    }

    return { size: base.size, modules: bestModules, version };
  }

  /**
   * Render a QR code directly onto an HTML5 Canvas element.
   */
  function renderToCanvas(canvas, text, options) {
    const opts = Object.assign({
      size: 240,
      margin: 4,
      darkColor: '#0F172A',
      lightColor: '#FFFFFF'
    }, options || {});

    const qr = generateMatrix(text);
    const totalModules = qr.size + opts.margin * 2;
    const scale = Math.max(1, Math.floor(opts.size / totalModules));
    const actualSize = totalModules * scale;

    canvas.width = actualSize;
    canvas.height = actualSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.lightColor;
    ctx.fillRect(0, 0, actualSize, actualSize);

    ctx.fillStyle = opts.darkColor;
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          ctx.fillRect(
            (c + opts.margin) * scale,
            (r + opts.margin) * scale,
            scale,
            scale
          );
        }
      }
    }
    return actualSize;
  }

  global.BillBookQR = {
    generateMatrix,
    renderToCanvas
  };
})(typeof window !== 'undefined' ? window : globalThis);
