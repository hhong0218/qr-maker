(function () {
  'use strict';

  const FG_PRESETS = [
    { name: '검정', color: '#000000' },
    { name: '남색', color: '#1e3a5f' },
    { name: '빨강', color: '#dc2626' },
    { name: '초록', color: '#16a34a' },
    { name: '보라', color: '#7c3aed' },
    { name: '주황', color: '#ea580c' },
    { name: '카카오노랑', color: '#FEE500' },
    { name: '네이버', color: '#03C75A' }
  ];

  const BG_PRESETS = [
    { name: '흰색', color: '#ffffff' },
    { name: '베이지', color: '#f5f0e8' },
    { name: '하늘', color: '#e0f2fe' },
    { name: '연두', color: '#ecfccb' },
    { name: '연노랑', color: '#fef9c3' },
    { name: '연분홍', color: '#fce7f3' },
    { name: '연회색', color: '#f1f5f9' },
    { name: '민트', color: '#ccfbf1' }
  ];

  const ECC_GUIDES = {
    L: 'L: 깨끗한 환경, 로고 없을 때',
    M: 'M: 일반 사용 (기본 권장)',
    Q: 'Q: 중간 수준의 오류 복구',
    H: 'H: 로고 삽입 시 필수'
  };

  const state = {
    activeTab: 'url',
    size: 300,
    ecc: 'M',
    fgColor: '#000000',
    bgColor: '#ffffff',
    transparentBg: false,
    dotStyle: 'square',
    cornerStyle: 'square',
    margin: 2,
    logoImage: null,
    logoSizePercent: 20,
    logoBorder: 'none',
    snsType: null,
    matrix: null,
    moduleCount: 0
  };

  let debounceTimer = null;
  let totalGenerated = parseInt(localStorage.getItem('qr_total_generated') || '0', 10);

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const canvas = $('#qr-canvas');
  const ctx = canvas.getContext('2d');

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = typeof r === 'number' ? r : r[0] || 0;
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.lineTo(x + w, y + h - radius);
      this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.lineTo(x + radius, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.lineTo(x, y + radius);
      this.quadraticCurveTo(x, y, x + radius, y);
      this.closePath();
    };
  }

  function init() {
    renderColorPresets();
    bindEvents();
    rotateTips();
    loadHistory();
    applyPresetDefaults();
    scheduleRender();
  }

  function renderColorPresets() {
    const fgContainer = $('#fg-presets');
    const bgContainer = $('#bg-presets');

    FG_PRESETS.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'color-preset' + (i === 0 ? ' active' : '');
      btn.style.background = p.color;
      btn.title = p.name;
      btn.dataset.color = p.color;
      btn.dataset.target = 'fg';
      fgContainer.appendChild(btn);
    });

    BG_PRESETS.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'color-preset' + (i === 0 ? ' active' : '');
      btn.style.background = p.color;
      btn.title = p.name;
      btn.dataset.color = p.color;
      btn.dataset.target = 'bg';
      bgContainer.appendChild(btn);
    });
  }

  function bindEvents() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const inputs = [
      '#url-input', '#text-input', '#vcard-name', '#vcard-phone',
      '#vcard-email', '#vcard-address', '#vcard-company',
      '#wifi-ssid', '#wifi-password', '#wifi-security',
      '#sns-kakao', '#sns-instagram', '#sns-youtube', '#sns-naver'
    ];
    inputs.forEach((sel) => {
      const el = $(sel);
      if (el) el.addEventListener('input', scheduleRender);
    });

    $('#text-input').addEventListener('input', (e) => {
      $('#text-count').textContent = e.target.value.length;
    });

    $('#short-url-check').addEventListener('change', (e) => {
      $('#short-url-notice').classList.toggle('hidden', !e.target.checked);
    });

    $('#size-slider').addEventListener('input', (e) => {
      state.size = parseInt(e.target.value, 10);
      $('#size-value').textContent = state.size;
      scheduleRender();
    });

    $$('.ecc-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.ecc-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.ecc = btn.dataset.ecc;
        $('#ecc-guide').textContent = ECC_GUIDES[state.ecc];
        scheduleRender();
      });
    });

    $('#fg-color').addEventListener('input', (e) => {
      state.fgColor = e.target.value;
      $('#fg-hex').value = e.target.value;
      updatePresetActive('fg', e.target.value);
      scheduleRender();
    });

    $('#fg-hex').addEventListener('input', (e) => {
      const val = normalizeHex(e.target.value);
      if (val) {
        state.fgColor = val;
        $('#fg-color').value = val;
        updatePresetActive('fg', val);
        scheduleRender();
      }
    });

    $('#bg-color').addEventListener('input', (e) => {
      state.bgColor = e.target.value;
      $('#bg-hex').value = e.target.value;
      updatePresetActive('bg', e.target.value);
      scheduleRender();
    });

    $('#bg-hex').addEventListener('input', (e) => {
      const val = normalizeHex(e.target.value);
      if (val) {
        state.bgColor = val;
        $('#bg-color').value = val;
        updatePresetActive('bg', val);
        scheduleRender();
      }
    });

    $('#transparent-bg').addEventListener('change', (e) => {
      state.transparentBg = e.target.checked;
      scheduleRender();
    });

    $$('[data-dot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-dot]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.dotStyle = btn.dataset.dot;
        scheduleRender();
      });
    });

    $$('[data-corner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-corner]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.cornerStyle = btn.dataset.corner;
        scheduleRender();
      });
    });

    $('#logo-upload').addEventListener('change', handleLogoUpload);
    $('#logo-size-slider').addEventListener('input', (e) => {
      state.logoSizePercent = parseInt(e.target.value, 10);
      $('#logo-size-value').textContent = state.logoSizePercent;
      scheduleRender();
    });
    $('#logo-border').addEventListener('change', (e) => {
      state.logoBorder = e.target.value;
      scheduleRender();
    });

    $('#margin-slider').addEventListener('input', (e) => {
      state.margin = parseInt(e.target.value, 10);
      $('#margin-value').textContent = state.margin;
      scheduleRender();
    });

    $$('.color-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const color = btn.dataset.color;
        if (target === 'fg') {
          state.fgColor = color;
          $('#fg-color').value = color;
          $('#fg-hex').value = color;
        } else {
          state.bgColor = color;
          $('#bg-color').value = color;
          $('#bg-hex').value = color;
        }
        updatePresetActive(target, color);
        scheduleRender();
      });
    });

    $$('.preset-card').forEach((card) => {
      card.addEventListener('click', () => applyPreset(card.dataset.preset));
    });

    $('#save-png').addEventListener('click', () => exportPNG(1));
    $('#save-png-hd').addEventListener('click', () => exportPNG(4));
    $('#save-svg').addEventListener('click', exportSVG);
    $('#copy-clipboard').addEventListener('click', copyToClipboard);

    $('#business-card-link').addEventListener('click', (e) => {
      e.preventDefault();
      showToast('명함 제작기는 준비 중입니다. 곧 연결됩니다!');
    });
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$('.tab-btn').forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    $$('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'panel-' + tab);
    });
    scheduleRender();
  }

  function normalizeHex(val) {
    val = val.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) return val;
    if (/^[0-9A-Fa-f]{6}$/.test(val)) return '#' + val;
    return null;
  }

  function updatePresetActive(target, color) {
    $$(`.color-preset[data-target="${target}"]`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  function getQRContent() {
    state.snsType = null;

    switch (state.activeTab) {
      case 'url': {
        let url = $('#url-input').value.trim();
        if (!url) return 'https://example.com';
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        return url;
      }
      case 'text': {
        const text = $('#text-input').value.trim();
        return text || 'Hello, QR!';
      }
      case 'vcard': {
        const name = $('#vcard-name').value.trim();
        const phone = $('#vcard-phone').value.trim();
        const email = $('#vcard-email').value.trim();
        const address = $('#vcard-address').value.trim();
        const company = $('#vcard-company').value.trim();
        let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
        if (name) vcard += 'FN:' + name + '\n';
        if (phone) vcard += 'TEL:' + phone + '\n';
        if (email) vcard += 'EMAIL:' + email + '\n';
        if (address) vcard += 'ADR:;;' + address + ';;;\n';
        if (company) vcard += 'ORG:' + company + '\n';
        vcard += 'END:VCARD';
        return vcard;
      }
      case 'wifi': {
        const ssid = $('#wifi-ssid').value.trim() || 'WiFi';
        const password = $('#wifi-password').value;
        const security = $('#wifi-security').value;
        if (security === 'nopass') {
          return 'WIFI:T:nopass;S:' + escapeWifi(ssid) + ';;';
        }
        return 'WIFI:T:' + security + ';S:' + escapeWifi(ssid) + ';P:' + escapeWifi(password) + ';;';
      }
      case 'sns': {
        const links = [
          { id: 'sns-kakao', type: 'kakao', icon: '💬' },
          { id: 'sns-instagram', type: 'instagram', icon: '📷' },
          { id: 'sns-youtube', type: 'youtube', icon: '▶' },
          { id: 'sns-naver', type: 'naver', icon: 'N' }
        ];
        for (const link of links) {
          const val = $('#' + link.id).value.trim();
          if (val) {
            state.snsType = link;
            return val;
          }
        }
        return 'https://example.com';
      }
      default:
        return 'https://example.com';
    }
  }

  function escapeWifi(str) {
    return str.replace(/[\\;,"]/g, '\\$&');
  }

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderQR, 300);
  }

  function generateMatrix(text) {
    const container = $('#hidden-qr');
    container.innerHTML = '';

    try {
      const qr = new QRCode(container, {
        text: text,
        width: 1,
        height: 1,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel[state.ecc]
      });

      const modules = qr._oQRCode.modules;
      const count = qr._oQRCode.getModuleCount();
      const matrix = [];
      for (let row = 0; row < count; row++) {
        matrix[row] = [];
        for (let col = 0; col < count; col++) {
          matrix[row][col] = modules[row][col];
        }
      }
      return { matrix, count };
    } catch (err) {
      console.error('QR generation error:', err);
      return null;
    }
  }

  function isFinderArea(row, col, count) {
    if (row < 7 && col < 7) return 'tl';
    if (row < 7 && col >= count - 7) return 'tr';
    if (row >= count - 7 && col < 7) return 'bl';
    return null;
  }

  function isInLogoArea(row, col, count, logoModuleRadius) {
    const center = (count - 1) / 2;
    const dr = Math.abs(row - center);
    const dc = Math.abs(col - center);
    return dr <= logoModuleRadius && dc <= logoModuleRadius;
  }

  function paintQR(targetCanvas, targetCtx, canvasSize, matrix, count) {
    const totalModules = count + state.margin * 2;
    const moduleSize = canvasSize / totalModules;

    targetCanvas.width = canvasSize;
    targetCanvas.height = canvasSize;
    targetCtx.clearRect(0, 0, canvasSize, canvasSize);

    if (!state.transparentBg) {
      targetCtx.fillStyle = state.bgColor;
      targetCtx.fillRect(0, 0, canvasSize, canvasSize);
    }

    const offset = state.margin * moduleSize;
    const logoModuleRadius = state.logoImage
      ? Math.ceil((state.logoSizePercent / 100) * totalModules / 2)
      : 0;

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix[row][col]) continue;
        if (isFinderArea(row, col, count)) continue;
        if (state.logoImage && isInLogoArea(row, col, count, logoModuleRadius)) continue;

        const x = offset + col * moduleSize;
        const y = offset + row * moduleSize;
        drawModuleOn(targetCtx, x, y, moduleSize, state.fgColor, state.dotStyle);
      }
    }

    drawFinderPatternOn(targetCtx, offset, offset, moduleSize, state.fgColor, state.cornerStyle);
    drawFinderPatternOn(targetCtx, offset + (count - 7) * moduleSize, offset, moduleSize, state.fgColor, state.cornerStyle);
    drawFinderPatternOn(targetCtx, offset, offset + (count - 7) * moduleSize, moduleSize, state.fgColor, state.cornerStyle);

    drawLogoOn(targetCtx, canvasSize, state.logoImage);
  }

  function drawModuleOn(c, x, y, size, color, style) {
    c.fillStyle = color;
    const pad = size * 0.08;

    switch (style) {
      case 'circle':
        c.beginPath();
        c.arc(x + size / 2, y + size / 2, size / 2 - pad, 0, Math.PI * 2);
        c.fill();
        break;
      case 'rounded': {
        const r = size * 0.3;
        c.beginPath();
        c.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
        c.fill();
        break;
      }
      default:
        c.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    }
  }

  function drawFinderPatternOn(c, startX, startY, moduleSize, color, style) {
    const outerSize = moduleSize * 7;
    const innerOffset = moduleSize * 2;
    const innerSize = moduleSize * 3;
    const midOffset = moduleSize;
    const midSize = moduleSize * 5;

    c.fillStyle = color;

    if (style === 'circle') {
      c.beginPath();
      c.arc(startX + outerSize / 2, startY + outerSize / 2, outerSize / 2 - moduleSize * 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
      if (!state.transparentBg) {
        c.beginPath();
        c.arc(startX + outerSize / 2, startY + outerSize / 2, midSize / 2, 0, Math.PI * 2);
        c.fill();
      } else {
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.arc(startX + outerSize / 2, startY + outerSize / 2, midSize / 2, 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.fillStyle = color;
      c.beginPath();
      c.arc(startX + outerSize / 2, startY + outerSize / 2, innerSize / 2, 0, Math.PI * 2);
      c.fill();
    } else if (style === 'rounded') {
      const r = moduleSize * 1.5;
      c.beginPath();
      c.roundRect(startX, startY, outerSize, outerSize, r);
      c.fill();
      c.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
      if (!state.transparentBg) {
        c.beginPath();
        c.roundRect(startX + midOffset, startY + midOffset, midSize, midSize, r * 0.6);
        c.fill();
      } else {
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.roundRect(startX + midOffset, startY + midOffset, midSize, midSize, r * 0.6);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(startX + innerOffset, startY + innerOffset, innerSize, innerSize, r * 0.4);
      c.fill();
    } else {
      c.fillRect(startX, startY, outerSize, outerSize);
      c.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
      if (!state.transparentBg) {
        c.fillRect(startX + midOffset, startY + midOffset, midSize, midSize);
      } else {
        c.globalCompositeOperation = 'destination-out';
        c.fillRect(startX + midOffset, startY + midOffset, midSize, midSize);
        c.globalCompositeOperation = 'source-over';
      }
      c.fillStyle = color;
      c.fillRect(startX + innerOffset, startY + innerOffset, innerSize, innerSize);
    }
  }

  function drawLogoOn(c, canvasSize, logoImage) {
    if (!logoImage) return;

    const logoPixelSize = canvasSize * (state.logoSizePercent / 100);
    const x = (canvasSize - logoPixelSize) / 2;
    const y = (canvasSize - logoPixelSize) / 2;

    if (state.logoBorder === 'padding') {
      const padding = logoPixelSize * 0.12;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.roundRect(x - padding, y - padding, logoPixelSize + padding * 2, logoPixelSize + padding * 2, padding);
      c.fill();
    }

    c.save();
    if (state.logoBorder === 'circle') {
      c.beginPath();
      c.arc(x + logoPixelSize / 2, y + logoPixelSize / 2, logoPixelSize / 2, 0, Math.PI * 2);
      c.clip();
    }
    c.drawImage(logoImage, x, y, logoPixelSize, logoPixelSize);
    c.restore();

    if (state.ecc !== 'H') {
      $('#logo-warning').classList.remove('hidden');
    }
  }

  function renderQR() {
    const content = getQRContent();
    const result = generateMatrix(content);

    if (!result) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { matrix, count } = result;
    state.matrix = matrix;
    state.moduleCount = count;

    paintQR(canvas, ctx, state.size, matrix, count);
    updateSnsBadge();
  }

  function updateSnsBadge() {
    const badge = $('#sns-badge');
    if (state.activeTab === 'sns' && state.snsType) {
      badge.className = 'sns-badge ' + state.snsType.type;
      badge.textContent = state.snsType.icon;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) {
      state.logoImage = null;
      $('#logo-options').classList.add('hidden');
      $('#logo-warning').classList.add('hidden');
      scheduleRender();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('이미지는 최대 2MB까지 업로드 가능합니다.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        state.logoImage = img;
        $('#logo-options').classList.remove('hidden');
        $('#logo-warning').classList.remove('hidden');
        scheduleRender();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function createExportCanvas(scale) {
    if (!state.matrix) return canvas;
    const tempCanvas = document.createElement('canvas');
    const tctx = tempCanvas.getContext('2d');
    paintQR(tempCanvas, tctx, state.size * scale, state.matrix, state.moduleCount);
    return tempCanvas;
  }

  function exportPNG(scale) {
    const exportCanvas = scale === 1 ? canvas : createExportCanvas(scale);
    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode' + (scale > 1 ? '-hd' : '') + '.png';
      a.click();
      URL.revokeObjectURL(url);
      onExportSuccess();
    }, 'image/png');
  }

  function exportSVG() {
    if (!state.matrix) return;

    const { matrix, moduleCount: count } = state;
    const totalModules = count + state.margin * 2;
    const moduleSize = state.size / totalModules;
    const offset = state.margin * moduleSize;
    const fg = state.fgColor;
    const bg = state.transparentBg ? 'none' : state.bgColor;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${state.size}" height="${state.size}" viewBox="0 0 ${state.size} ${state.size}">`;
    if (!state.transparentBg) {
      svg += `<rect width="100%" height="100%" fill="${bg}"/>`;
    }

    const logoModuleRadius = state.logoImage
      ? Math.ceil((state.logoSizePercent / 100) * totalModules / 2)
      : 0;

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix[row][col]) continue;
        if (isFinderArea(row, col, count)) continue;
        if (state.logoImage && isInLogoArea(row, col, count, logoModuleRadius)) continue;

        const x = offset + col * moduleSize;
        const y = offset + row * moduleSize;
        const s = moduleSize * 0.84;
        const pad = moduleSize * 0.08;

        if (state.dotStyle === 'circle') {
          svg += `<circle cx="${x + moduleSize / 2}" cy="${y + moduleSize / 2}" r="${s / 2}" fill="${fg}"/>`;
        } else if (state.dotStyle === 'rounded') {
          svg += `<rect x="${x + pad}" y="${y + pad}" width="${s}" height="${s}" rx="${moduleSize * 0.3}" fill="${fg}"/>`;
        } else {
          svg += `<rect x="${x + pad}" y="${y + pad}" width="${s}" height="${s}" fill="${fg}"/>`;
        }
      }
    }

    const finderPositions = [
      [offset, offset],
      [offset + (count - 7) * moduleSize, offset],
      [offset, offset + (count - 7) * moduleSize]
    ];

    finderPositions.forEach(([fx, fy]) => {
      const outer = moduleSize * 7;
      const mid = moduleSize * 5;
      const inner = moduleSize * 3;
      const mo = moduleSize;
      const io = moduleSize * 2;

      if (state.cornerStyle === 'circle') {
        svg += `<circle cx="${fx + outer / 2}" cy="${fy + outer / 2}" r="${outer / 2}" fill="${fg}"/>`;
        if (!state.transparentBg) {
          svg += `<circle cx="${fx + outer / 2}" cy="${fy + outer / 2}" r="${mid / 2}" fill="${bg}"/>`;
        }
        svg += `<circle cx="${fx + outer / 2}" cy="${fy + outer / 2}" r="${inner / 2}" fill="${fg}"/>`;
      } else {
        const rx = state.cornerStyle === 'rounded' ? moduleSize * 1.5 : 0;
        svg += `<rect x="${fx}" y="${fy}" width="${outer}" height="${outer}" rx="${rx}" fill="${fg}"/>`;
        if (!state.transparentBg) {
          svg += `<rect x="${fx + mo}" y="${fy + mo}" width="${mid}" height="${mid}" rx="${rx * 0.6}" fill="${bg}"/>`;
        }
        svg += `<rect x="${fx + io}" y="${fy + io}" width="${inner}" height="${inner}" rx="${rx * 0.4}" fill="${fg}"/>`;
      }
    });

    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.svg';
    a.click();
    URL.revokeObjectURL(url);
    onExportSuccess();
  }

  async function copyToClipboard() {
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      onExportSuccess('클립보드에 복사되었습니다!');
    } catch (err) {
      showToast('클립보드 복사에 실패했습니다. 브라우저를 확인해주세요.');
    }
  }

  function onExportSuccess(message) {
    totalGenerated++;
    localStorage.setItem('qr_total_generated', totalGenerated.toString());
    saveToHistory();
    showToast(message || `QR코드가 저장되었습니다! 총 ${totalGenerated}개 생성`);
  }

  function getStateSnapshot() {
    return {
      activeTab: state.activeTab,
      size: state.size,
      ecc: state.ecc,
      fgColor: state.fgColor,
      bgColor: state.bgColor,
      transparentBg: state.transparentBg,
      dotStyle: state.dotStyle,
      cornerStyle: state.cornerStyle,
      margin: state.margin,
      logoSizePercent: state.logoSizePercent,
      logoBorder: state.logoBorder,
      content: getQRContent(),
      url: $('#url-input').value,
      text: $('#text-input').value,
      vcard: {
        name: $('#vcard-name').value,
        phone: $('#vcard-phone').value,
        email: $('#vcard-email').value,
        address: $('#vcard-address').value,
        company: $('#vcard-company').value
      },
      wifi: {
        ssid: $('#wifi-ssid').value,
        password: $('#wifi-password').value,
        security: $('#wifi-security').value
      },
      sns: {
        kakao: $('#sns-kakao').value,
        instagram: $('#sns-instagram').value,
        youtube: $('#sns-youtube').value,
        naver: $('#sns-naver').value
      },
      thumb: canvas.toDataURL('image/png', 0.5)
    };
  }

  function saveToHistory() {
    const snapshot = getStateSnapshot();
    let history = JSON.parse(localStorage.getItem('qr_history') || '[]');
    history = history.filter((h) => h.content !== snapshot.content);
    history.unshift(snapshot);
    history = history.slice(0, 10);
    localStorage.setItem('qr_history', JSON.stringify(history));
    loadHistory();
  }

  function loadHistory() {
    const list = $('#history-list');
    const history = JSON.parse(localStorage.getItem('qr_history') || '[]');

    if (history.length === 0) {
      list.innerHTML = '<li class="history-empty">아직 생성 기록이 없습니다</li>';
      return;
    }

    list.innerHTML = '';
    history.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <img class="history-thumb" src="${item.thumb}" alt="QR 미리보기" width="32" height="32">
        <span class="history-text">${escapeHtml(item.content.substring(0, 50))}</span>
      `;
      li.addEventListener('click', () => restoreHistory(item));
      list.appendChild(li);
    });
  }

  function restoreHistory(item) {
    switchTab(item.activeTab);

    state.size = item.size;
    state.ecc = item.ecc;
    state.fgColor = item.fgColor;
    state.bgColor = item.bgColor;
    state.transparentBg = item.transparentBg;
    state.dotStyle = item.dotStyle;
    state.cornerStyle = item.cornerStyle;
    state.margin = item.margin;
    state.logoSizePercent = item.logoSizePercent;
    state.logoBorder = item.logoBorder;

    $('#size-slider').value = item.size;
    $('#size-value').textContent = item.size;
    $('#fg-color').value = item.fgColor;
    $('#fg-hex').value = item.fgColor;
    $('#bg-color').value = item.bgColor;
    $('#bg-hex').value = item.bgColor;
    $('#transparent-bg').checked = item.transparentBg;
    $('#margin-slider').value = item.margin;
    $('#margin-value').textContent = item.margin;
    $('#logo-size-slider').value = item.logoSizePercent;
    $('#logo-size-value').textContent = item.logoSizePercent;
    $('#logo-border').value = item.logoBorder;

    $$('.ecc-btn').forEach((b) => b.classList.toggle('active', b.dataset.ecc === item.ecc));
    $('#ecc-guide').textContent = ECC_GUIDES[item.ecc];

    $$('[data-dot]').forEach((b) => b.classList.toggle('active', b.dataset.dot === item.dotStyle));
    $$('[data-corner]').forEach((b) => b.classList.toggle('active', b.dataset.corner === item.cornerStyle));

    if (item.url !== undefined) $('#url-input').value = item.url;
    if (item.text !== undefined) {
      $('#text-input').value = item.text;
      $('#text-count').textContent = item.text.length;
    }
    if (item.vcard) {
      $('#vcard-name').value = item.vcard.name || '';
      $('#vcard-phone').value = item.vcard.phone || '';
      $('#vcard-email').value = item.vcard.email || '';
      $('#vcard-address').value = item.vcard.address || '';
      $('#vcard-company').value = item.vcard.company || '';
    }
    if (item.wifi) {
      $('#wifi-ssid').value = item.wifi.ssid || '';
      $('#wifi-password').value = item.wifi.password || '';
      $('#wifi-security').value = item.wifi.security || 'WPA';
    }
    if (item.sns) {
      $('#sns-kakao').value = item.sns.kakao || '';
      $('#sns-instagram').value = item.sns.instagram || '';
      $('#sns-youtube').value = item.sns.youtube || '';
      $('#sns-naver').value = item.sns.naver || '';
    }

    updatePresetActive('fg', item.fgColor);
    updatePresetActive('bg', item.bgColor);
    scheduleRender();
    showToast('이전 설정이 복원되었습니다');
  }

  function applyPreset(preset) {
    const hints = {
      restaurant: '메뉴판에 인쇄 시 최소 2×2cm 크기로 인쇄하세요',
      'cafe-wifi': '카페 Wi-Fi QR이 준비되었습니다. SSID와 비밀번호를 입력하세요',
      kakao: '카카오 채널 URL을 입력하세요',
      label: '제품 라벨용 소형 QR 설정이 적용되었습니다',
      'business-card': '명함용 vCard QR 설정이 적용되었습니다',
      store: '스마트스토어/쇼핑몰 URL을 입력하세요'
    };

    $('#preset-hint').textContent = hints[preset] || '';

    switch (preset) {
      case 'restaurant':
        switchTab('url');
        setOptions({ size: 300, fg: '#000000', bg: '#ffffff', ecc: 'M', margin: 2 });
        break;
      case 'cafe-wifi':
        switchTab('wifi');
        setOptions({ size: 400, fg: '#1e3a5f', bg: '#ffffff', ecc: 'M', margin: 3 });
        break;
      case 'kakao':
        switchTab('sns');
        setOptions({ size: 350, fg: '#3C1E1E', bg: '#FEE500', ecc: 'H', margin: 2 });
        break;
      case 'label':
        switchTab('url');
        setOptions({ size: 200, fg: '#000000', bg: '#ffffff', ecc: 'M', margin: 1 });
        break;
      case 'business-card':
        switchTab('vcard');
        setOptions({ size: 250, fg: '#000000', bg: '#ffffff', ecc: 'H', margin: 2 });
        break;
      case 'store':
        switchTab('url');
        setOptions({ size: 400, fg: '#03C75A', bg: '#ffffff', ecc: 'M', margin: 2 });
        break;
    }
    scheduleRender();
  }

  function setOptions(opts) {
    if (opts.size) {
      state.size = opts.size;
      $('#size-slider').value = opts.size;
      $('#size-value').textContent = opts.size;
    }
    if (opts.fg) {
      state.fgColor = opts.fg;
      $('#fg-color').value = opts.fg;
      $('#fg-hex').value = opts.fg;
      updatePresetActive('fg', opts.fg);
    }
    if (opts.bg) {
      state.bgColor = opts.bg;
      $('#bg-color').value = opts.bg;
      $('#bg-hex').value = opts.bg;
      updatePresetActive('bg', opts.bg);
    }
    if (opts.ecc) {
      state.ecc = opts.ecc;
      $$('.ecc-btn').forEach((b) => b.classList.toggle('active', b.dataset.ecc === opts.ecc));
      $('#ecc-guide').textContent = ECC_GUIDES[opts.ecc];
    }
    if (opts.margin !== undefined) {
      state.margin = opts.margin;
      $('#margin-slider').value = opts.margin;
      $('#margin-value').textContent = opts.margin;
    }
  }

  function applyPresetDefaults() {
    $('#url-input').value = '';
  }

  function rotateTips() {
    const tips = $$('.tip');
    let current = 0;

    setInterval(() => {
      tips[current].classList.remove('active');
      current = (current + 1) % tips.length;
      tips[current].classList.add('active');
    }, 5000);
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();