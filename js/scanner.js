(function () {
  'use strict';

  // 언어 감지: <html lang="en"> (즉 /en/ 페이지)이면 영어, 그 외에는 한국어.
  // 경로에 /en/ 이 포함된 경우도 영어로 처리(안전망). (js/app.js와 동일한 패턴)
  const IS_EN = (document.documentElement.lang || '').toLowerCase().startsWith('en') ||
    /\/en(\/|$)/.test(location.pathname);

  const I18N = {
    ko: {
      libError: 'QR 스캔 라이브러리를 불러오지 못했습니다. 네트워크 연결 확인 후 새로고침해주세요.',
      notFound: '이미지에서 QR코드를 찾지 못했습니다. QR코드가 선명하게 보이는 사진으로 다시 시도해보세요.',
      fileTooLarge: '이미지는 최대 10MB까지 업로드 가능합니다.',
      notAnImage: '이미지 파일만 업로드할 수 있습니다.',
      copied: '클립보드에 복사되었습니다!',
      copyFailed: '클립보드 복사에 실패했습니다. 브라우저를 확인해주세요.',
      cameraDenied: '카메라 권한이 거부되었습니다. 브라우저 주소창의 카메라 아이콘에서 권한을 허용해주세요.',
      cameraNotFound: '사용 가능한 카메라를 찾을 수 없습니다.',
      cameraNotSupported: '이 브라우저는 카메라 스캔을 지원하지 않습니다. 이미지 업로드를 이용해주세요.',
      cameraGenericError: '카메라를 시작할 수 없습니다. 이미지 업로드를 이용해주세요.',
      cameraStart: '카메라 시작',
      cameraStop: '카메라 중지',
      cameraScanning: 'QR코드를 카메라 중앙에 비춰주세요...',
      historyEmpty: '아직 스캔 기록이 없습니다',
      historyThumbAlt: '스캔 미리보기',
      scannedTotal: (n) => `QR코드를 스캔했습니다! 총 ${n}회 스캔`,
      externalLinkWarning: '⚠️ 이 링크는 외부 사이트로 이동합니다. QR코드는 누구나 만들 수 있으므로 출처가 확실하지 않다면 주소를 확인한 뒤 클릭하세요.',
      openLink: '🔗 링크 열기 (외부 사이트)'
    },
    en: {
      libError: 'Could not load the QR scanning library. Please check your connection and refresh.',
      notFound: 'No QR code was found in that image. Try again with a photo where the QR code is clear and unobstructed.',
      fileTooLarge: 'Image must be 10MB or smaller.',
      notAnImage: 'Only image files can be uploaded.',
      copied: 'Copied to clipboard!',
      copyFailed: 'Failed to copy to clipboard. Please check your browser.',
      cameraDenied: 'Camera access was denied. Allow it from the camera icon near your browser address bar.',
      cameraNotFound: 'No available camera was found.',
      cameraNotSupported: 'This browser does not support camera scanning. Please use image upload instead.',
      cameraGenericError: 'Could not start the camera. Please use image upload instead.',
      cameraStart: 'Start camera',
      cameraStop: 'Stop camera',
      cameraScanning: 'Point a QR code at the center of the camera...',
      historyEmpty: 'No scans yet',
      historyThumbAlt: 'Scan preview',
      scannedTotal: (n) => `QR code scanned! ${n} scans so far`,
      externalLinkWarning: '⚠️ This link leads to an external site. Anyone can create a QR code, so check the address before clicking if you do not trust the source.',
      openLink: '🔗 Open link (external site)'
    }
  };

  const T = IS_EN ? I18N.en : I18N.ko;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const state = {
    activeTab: 'upload',
    stream: null,
    scanning: false,
    rafId: null,
    lastResult: null
  };

  let totalScanned = parseInt(localStorage.getItem('qr_scan_total') || '0', 10);

  const video = $('#scanner-video');
  const canvas = $('#scanner-canvas');
  const imagePreview = $('#scanner-image-preview');
  const placeholder = $('#scanner-placeholder');
  const resultBox = $('#scan-result');
  const resultText = $('#scan-result-text');
  const linkWrap = $('#scan-result-link-wrap');
  const linkAnchor = $('#scan-result-link');
  const emptyState = $('#scan-empty-state');

  function init() {
    bindEvents();
    loadHistory();
    if (typeof jsQR === 'undefined') {
      showToast(T.libError);
    }
  }

  function bindEvents() {
    $$('[data-scan-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.scanTab));
    });

    $('#qr-image-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImageFile(file);
    });

    const dropzone = $('#scanner-dropzone');
    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });

    $('#camera-start').addEventListener('click', startCamera);
    $('#camera-stop').addEventListener('click', stopCamera);

    $('#scan-copy-btn').addEventListener('click', copyResultToClipboard);
    $('#scan-reset-btn').addEventListener('click', resetScan);
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$('[data-scan-tab]').forEach((btn) => {
      const isActive = btn.dataset.scanTab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    $$('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'panel-' + tab);
    });

    // 다른 입력 방식으로 전환하면 카메라는 정리한다 (탭이 백그라운드에서 계속 도는 것 방지)
    if (tab !== 'camera' && state.stream) {
      stopCamera();
    }
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast(T.notAnImage);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(T.fileTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        showPreviewImage(ev.target.result);
        decodeFromImageElement(img);
      };
      img.onerror = () => showToast(T.notAnImage);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showPreviewImage(dataUrl) {
    stopCamera();
    imagePreview.src = dataUrl;
    imagePreview.classList.remove('hidden');
    video.classList.add('hidden');
    placeholder.classList.add('hidden');
  }

  function decodeFromImageElement(img) {
    const tempCanvas = document.createElement('canvas');
    // 초대형 이미지는 축소해서 디코딩 속도를 유지한다 (jsQR은 픽셀 수에 비례해 느려짐)
    const maxDim = 1600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext('2d');
    tctx.drawImage(img, 0, 0, w, h);

    const imageData = tctx.getImageData(0, 0, w, h);
    const code = safeDecode(imageData);

    if (code && code.data) {
      onScanSuccess(code.data);
    } else {
      onScanNotFound();
    }
  }

  function safeDecode(imageData) {
    if (typeof jsQR === 'undefined') {
      showToast(T.libError);
      return null;
    }
    try {
      return jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
    } catch (err) {
      console.error('QR decode error:', err);
      return null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast(T.cameraNotSupported);
      return;
    }

    hideCameraError();
    resetResultUI();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      state.stream = stream;
      video.srcObject = stream;
      await video.play();

      placeholder.classList.add('hidden');
      imagePreview.classList.add('hidden');
      video.classList.remove('hidden');

      $('#camera-start').classList.add('hidden');
      $('#camera-stop').classList.remove('hidden');

      state.scanning = true;
      showToast(T.cameraScanning);
      scanLoop();
    } catch (err) {
      console.error('Camera start error:', err);
      handleCameraError(err);
    }
  }

  function handleCameraError(err) {
    let message = T.cameraGenericError;
    if (err && err.name === 'NotAllowedError') message = T.cameraDenied;
    else if (err && err.name === 'NotFoundError') message = T.cameraNotFound;
    showCameraError(message);
  }

  function showCameraError(message) {
    const el = $('#camera-error');
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideCameraError() {
    $('#camera-error').classList.add('hidden');
  }

  function stopCamera() {
    state.scanning = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }
    video.pause();
    video.srcObject = null;
    video.classList.add('hidden');

    $('#camera-start').classList.remove('hidden');
    $('#camera-stop').classList.add('hidden');
  }

  function scanLoop() {
    if (!state.scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = safeDecode(imageData);

      if (code && code.data) {
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
    }

    state.rafId = requestAnimationFrame(scanLoop);
  }

  function onScanSuccess(content) {
    state.lastResult = content;
    emptyState.classList.add('hidden');
    renderResult(content);
    saveToHistory(content);

    totalScanned++;
    localStorage.setItem('qr_scan_total', totalScanned.toString());
    showToast(T.scannedTotal(totalScanned));

    // GA4: 사이트의 기존 qr_export 이벤트 패턴과 동일하게 실사용 전환 시점에만 발생
    if (typeof gtag === 'function') {
      gtag('event', 'qr_scan', {
        scan_method: state.activeTab || 'unknown',
        content_type: classifyContent(content),
        total_scanned: totalScanned
      });
    }
  }

  function onScanNotFound() {
    resultBox.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }

  function classifyContent(content) {
    if (/^https?:\/\//i.test(content)) return 'url';
    if (/^WIFI:/i.test(content)) return 'wifi';
    if (/^BEGIN:VCARD/i.test(content)) return 'vcard';
    return 'text';
  }

  function renderResult(content) {
    resultText.textContent = content;
    resultBox.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const isUrl = /^https?:\/\//i.test(content.trim());
    if (isUrl) {
      linkAnchor.href = content.trim();
      linkWrap.classList.remove('hidden');
    } else {
      linkAnchor.href = '#';
      linkWrap.classList.add('hidden');
    }
  }

  function resetResultUI() {
    resultBox.classList.add('hidden');
    emptyState.classList.add('hidden');
    linkWrap.classList.add('hidden');
    resultText.textContent = '';
  }

  function resetScan() {
    stopCamera();
    resetResultUI();
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
    placeholder.classList.remove('hidden');
    $('#qr-image-input').value = '';
    state.lastResult = null;
  }

  async function copyResultToClipboard() {
    if (!state.lastResult) return;
    try {
      await navigator.clipboard.writeText(state.lastResult);
      showToast(T.copied);
    } catch (err) {
      showToast(T.copyFailed);
    }
  }

  function saveToHistory(content) {
    const entry = {
      content,
      type: classifyContent(content),
      scannedAt: Date.now()
    };

    let history = JSON.parse(localStorage.getItem('qr_scan_history') || '[]');
    history = history.filter((h) => h.content !== content);
    history.unshift(entry);
    history = history.slice(0, 10);

    // localStorage 용량 초과 시 오래된 항목부터 제거 후 재시도 (js/app.js와 동일 패턴)
    while (history.length > 0) {
      try {
        localStorage.setItem('qr_scan_history', JSON.stringify(history));
        break;
      } catch (err) {
        history.pop();
      }
    }
    loadHistory();
  }

  function loadHistory() {
    const list = $('#scan-history-list');
    if (!list) return;
    const history = JSON.parse(localStorage.getItem('qr_scan_history') || '[]');

    if (history.length === 0) {
      list.innerHTML = '<li class="history-empty">' + escapeHtml(T.historyEmpty) + '</li>';
      return;
    }

    list.innerHTML = '';
    history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="history-thumb scan-history-icon">${typeIcon(item.type)}</span>
        <span class="history-text">${escapeHtml(item.content.substring(0, 50))}</span>
      `;
      li.addEventListener('click', () => {
        resetResultUI();
        placeholder.classList.add('hidden');
        imagePreview.classList.add('hidden');
        video.classList.add('hidden');
        onScanSuccess(item.content);
      });
      list.appendChild(li);
    });
  }

  function typeIcon(type) {
    switch (type) {
      case 'url': return '🔗';
      case 'wifi': return '📶';
      case 'vcard': return '👤';
      default: return '📝';
    }
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
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
