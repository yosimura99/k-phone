/* K.Phone – vỏ PWA toàn màn hình cho máy Android đám mây ProxyDancu.
 * Không lưu mật khẩu / thông tin đăng nhập. Chỉ lưu URL trình xem + chế độ hiển thị trong localStorage.
 */
(function () {
  'use strict';

  // Link truy cập từ xa (có mật khẩu – người dùng tự nhập trên trang, KHÔNG lưu trong mã).
  var DEFAULT_URL = 'https://app.proxydancu.com/api/v1/cloud-phone/s/FlsIb3YJ';
  var LS_URL = 'kphone.url';
  var LS_MODE = 'kphone.mode';          // auto | iframe | direct
  var LS_AUTOOPEN = 'kphone.autoopen';  // '1' | '0'
  var LOAD_TIMEOUT_MS = 12000;
  var HOLD_MS = 1000;

  // Các trang đã kiểm tra là chặn nhúng iframe (curl -I ngày 02/11/2026):
  // app.proxydancu.com (/user/..., /account/login, ...) trả về "X-Frame-Options: SAMEORIGIN".
  // Ngoại lệ: link chia sẻ /api/v1/cloud-phone/s/... KHÔNG có X-Frame-Options/CSP -> nhúng được.
  var KNOWN_BLOCKED = [{ host: 'app.proxydancu.com', allowPrefixes: ['/api/v1/cloud-phone/s/'] }];

  var $ = function (id) { return document.getElementById(id); };
  var frame = $('phone');
  var loading = $('loading');
  var fallback = $('fallback');
  var toastEl = $('toast');
  var loadTimer = null;
  var toastTimer = null;
  var forceEmbedOnce = false; // đặt bởi "Thử nhúng lại", giữ trong phiên hiện tại

  /* ---------- Lưu trữ ---------- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function isValidUrl(u) {
    try { var p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; } catch (e) { return false; }
  }

  // ?url=... ghi đè và được lưu lại để lần mở sau từ màn hình chính vẫn dùng.
  (function readQuery() {
    try {
      var q = new URLSearchParams(location.search);
      var u = q.get('url');
      if (u && isValidUrl(u)) lsSet(LS_URL, u);
      var m = q.get('mode');
      if (m && /^(auto|iframe|direct)$/.test(m)) lsSet(LS_MODE, m);
      if (u || m) history.replaceState(null, '', location.pathname); // giữ start_url sạch
    } catch (e) {}
  })();

  function getUrl() { var u = lsGet(LS_URL, DEFAULT_URL); return isValidUrl(u) ? u : DEFAULT_URL; }
  function getMode() { return lsGet(LS_MODE, 'auto'); }
  function getAutoOpen() { return lsGet(LS_AUTOOPEN, '0') === '1'; }
  function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }
  function isKnownBlocked(u) {
    var p; try { p = new URL(u); } catch (e) { return false; }
    return KNOWN_BLOCKED.some(function (r) {
      return r.host === p.hostname && !r.allowPrefixes.some(function (a) { return p.pathname.indexOf(a) === 0; });
    });
  }

  /* ---------- Toast ---------- */
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 1600);
  }

  /* ---------- Tải máy ---------- */
  function showFallback(reason) {
    clearTimeout(loadTimer);
    loading.hidden = true;
    fallback.hidden = false;
    $('fallback-msg').textContent = reason;
    if (getAutoOpen()) setTimeout(openDirect, 600);
  }

  function openDirect() {
    // Mở ngay trong cửa sổ standalone hiện tại (không mở tab mới).
    window.location.href = getUrl();
  }

  function load() {
    var url = getUrl();
    var mode = getMode();
    clearTimeout(loadTimer);
    fallback.hidden = true;

    if (mode === 'direct') {
      frame.removeAttribute('src');
      showFallback('Chế độ mở trực tiếp. Bấm “Mở máy” để vào máy Android.');
      return;
    }
    if (mode === 'auto' && isKnownBlocked(url) && !forceEmbedOnce) {
      frame.removeAttribute('src');
      showFallback('Trang ' + hostOf(url) + ' không cho phép hiển thị bên trong ứng dụng khác (X-Frame-Options). Bấm “Mở máy” để mở toàn màn hình.');
      return;
    }

    loading.hidden = false;
    var loaded = false;
    frame.onload = function () {
      if (!frame.getAttribute('src')) return;
      loaded = true;
      clearTimeout(loadTimer);
      loading.hidden = true;
      // Lưu ý: trang bị chặn nhúng vẫn có thể bắn sự kiện load (trang lỗi của trình duyệt).
      // Với trang khác nguồn, không thể đọc nội dung để kiểm tra chắc chắn -> dùng danh sách
      // KNOWN_BLOCKED + hết thời gian chờ + nút "Thử nhúng lại"/"Mở máy" trong cài đặt.
    };
    frame.onerror = function () { showFallback('Không tải được trang máy.'); };
    loadTimer = setTimeout(function () {
      if (!loaded && mode === 'auto') showFallback('Trang máy không phản hồi hoặc không cho phép nhúng.');
      else if (!loaded) { loading.hidden = true; toast('Tải chậm…'); }
    }, LOAD_TIMEOUT_MS);
    frame.src = url;
  }

  $('open-direct').addEventListener('click', openDirect);
  $('retry-embed').addEventListener('click', function () { forceEmbedOnce = true; load(); });
  $('btn-reload').addEventListener('click', function () { toast('Đang tải lại…'); load(); });

  /* ---------- Phím Android ---------- */
  // TODO: Khi biết API của trình xem ProxyDancu, ánh xạ các phím này thành lệnh thật
  // (ví dụ gửi keyevent BACK=4, HOME=3, APP_SWITCH=187). Hiện tại chỉ postMessage vào iframe.
  var KEYCODES = { back: 4, home: 3, recents: 187 };
  var KEYNAMES = { back: 'Quay lại', home: 'Home', recents: 'Gần đây' };
  Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-key');
      try {
        if (frame.contentWindow && frame.getAttribute('src')) {
          frame.contentWindow.postMessage({ type: 'kphone:key', key: key, keycode: KEYCODES[key] }, '*');
        }
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(10);
      toast(KEYNAMES[key], 700);
    });
  });

  /* ---------- Thoát: giữ 1 giây ---------- */
  (function exitHold() {
    var btn = $('btn-exit');
    var timer = null, start = 0, done = false;
    function begin(e) {
      e.preventDefault();
      done = false;
      start = Date.now();
      btn.classList.add('holding');
      clearTimeout(timer);
      timer = setTimeout(function () {
        done = true;
        if (navigator.vibrate) navigator.vibrate(30);
        location.replace('exit.html');
      }, HOLD_MS);
    }
    function end(e) {
      if (e) e.preventDefault();
      if (!btn.classList.contains('holding')) return;
      clearTimeout(timer);
      btn.classList.remove('holding');
      if (!done && Date.now() - start < HOLD_MS) toast('Giữ 1 giây để thoát');
    }
    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', begin);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
      btn.addEventListener('pointerleave', end);
    } else {
      btn.addEventListener('touchstart', begin, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', begin);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    }
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function (e) { e.preventDefault(); });
  })();

  /* ---------- Cài đặt ---------- */
  var sheet = $('settings');
  $('default-url').textContent = DEFAULT_URL;
  function openSettings() {
    $('set-url').value = getUrl();
    $('set-mode').value = getMode();
    $('set-autoopen').checked = getAutoOpen();
    sheet.hidden = false;
  }
  function closeSettings() { sheet.hidden = true; document.activeElement && document.activeElement.blur && document.activeElement.blur(); }
  $('btn-settings').addEventListener('click', openSettings);
  $('set-cancel').addEventListener('click', closeSettings);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSettings(); });
  $('set-save').addEventListener('click', function () {
    var u = $('set-url').value.trim();
    if (u && !isValidUrl(u)) { toast('URL không hợp lệ'); return; }
    if (u) lsSet(LS_URL, u); else lsDel(LS_URL);
    lsSet(LS_MODE, $('set-mode').value);
    lsSet(LS_AUTOOPEN, $('set-autoopen').checked ? '1' : '0');
    closeSettings();
    toast('Đã lưu');
    load();
  });
  $('set-reset').addEventListener('click', function () {
    lsDel(LS_URL); lsDel(LS_MODE); lsDel(LS_AUTOOPEN);
    openSettings();
    toast('Đã khôi phục mặc định');
  });

  /* ---------- Chống cuộn / nảy / phóng to ở lớp vỏ ---------- */
  // Sự kiện chạm bên trong iframe không lan ra trang này, nên thao tác trong máy Android không bị ảnh hưởng.
  function inScrollable(el) {
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('scrollable')) return el;
      el = el.parentNode;
    }
    return null;
  }
  document.addEventListener('touchmove', function (e) {
    var s = inScrollable(e.target);
    if (s && s.scrollHeight > s.clientHeight) return; // cho phép cuộn trong bảng cài đặt
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300 && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) {
    if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
  });
  document.addEventListener('selectstart', function (e) {
    if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
  });
  window.addEventListener('scroll', function () { if (window.scrollY) window.scrollTo(0, 0); });

  /* ---------- Service worker (chỉ cache vỏ ứng dụng) ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    });
  }

  load();
})();
