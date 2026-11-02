/* Runs inside index.html BEFORE the Vite entrypoint. Never requires the JS bundle. */
(function () {
  'use strict';
  var LOCAL_BUILD = '__CONSUBOV_BUILD_TIMESTAMP__';
  var LOCAL_APP = '__CONSUBOV_APP_VERSION__';
  var ATTEMPT_KEY = 'consubov:pwa-recovery-attempt';
  var MAX_WAIT = 18000;
  var retryTimer = null;
  var started = false;
  var failed = false;
  var deferred = false;
  var checking = false;
  var mode = 'boot';
  var panel = null;
  var guards = {
    isCritical: function () { return false; },
    whenIdle: function (callback) { callback(); return function () {}; },
    whenAuthIdle: function (callback) { callback(); }
  };

  function currentHostAllowed() {
    return location.hostname !== 'consubov.com.br' && location.hostname !== 'www.consubov.com.br';
  }
  if (!currentHostAllowed()) return;

  function version(value) {
    return typeof value === 'string' && /^\d{12,15}$/.test(value) ? Number(value) : null;
  }
  function semver(value) {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
    return value.split('.').map(Number);
  }
  function downgrade(a, b) {
    var aa = semver(a), bb = semver(b);
    if (!aa || !bb) return true;
    for (var i = 0; i < 3; i += 1) {
      if (aa[i] < bb[i]) return true;
      if (aa[i] > bb[i]) return false;
    }
    return false;
  }
  function matchesWorker(worker, build) {
    if (!worker || !worker.scriptURL) return false;
    try {
      var url = new URL(worker.scriptURL, location.origin);
      return url.origin === location.origin && url.pathname === '/sw.js' && url.searchParams.get('v') === build;
    } catch (_e) {
      return false;
    }
  }
  function wasAttempted(build) {
    try { return sessionStorage.getItem(ATTEMPT_KEY) === build; } catch (_e) { return true; }
  }
  function markAttempt(build) {
    try { sessionStorage.setItem(ATTEMPT_KEY, build); return true; } catch (_e) { return false; }
  }
  function isBusy() {
    try { return guards.isCritical(); } catch (_e) { return true; }
  }
  function show(message) {
    if (started && mode === 'boot') return;
    var root = document.body || document.documentElement;
    if (!root) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'consubov-pwa-recovery';
      panel.setAttribute('role', 'status');
      panel.setAttribute('aria-live', 'polite');
      panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#f4f7f4;color:#173f2d;padding:24px;text-align:center;font:600 17px/1.5 system-ui,sans-serif';
      root.appendChild(panel);
    }
    if (started && mode === 'chunk') {
      // Never block a capataz form while a lazy chunk is being recovered.
      panel.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483647;max-width:480px;margin:auto;padding:12px;border-radius:12px;background:#eef6ed;color:#173f2d;pointer-events:none;text-align:center;font:500 14px/1.4 system-ui,sans-serif';
    }
    panel.textContent = message;
  }
  function hide() {
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
  }
  function scheduleRetry() {
    if (retryTimer || !failed) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (failed && navigator.onLine !== false && document.visibilityState !== 'hidden') void recover();
    }, 25000);
  }
  function safeWhenIdle(callback) {
    if (!isBusy()) return callback();
    // A full-screen recovery overlay must NEVER cover an unfinished form.
    if (mode === 'boot' && !started) show('Concluindo sua operação antes de atualizar o aplicativo…');
    if (deferred) return;
    deferred = true;
    var finished = false;
    var unsubscribe = null;
    function continueWhenIdle() {
      if (finished) return;
      finished = true;
      deferred = false;
      if (unsubscribe) unsubscribe();
      if (failed) callback();
    }
    unsubscribe = guards.whenIdle(continueWhenIdle);
    if (!isBusy()) continueWhenIdle();
  }
  function waitForWaiting(registration, build) {
    return new Promise(function (resolve) {
      var done = false;
      var timer;
      var observed = [];
      function finish(worker) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { registration.removeEventListener('updatefound', found); } catch (_e) {}
        observed.forEach(function (item) {
          try { item.removeEventListener('statechange', changed); } catch (_e) {}
        });
        resolve(worker || null);
      }
      function checked() {
        if (matchesWorker(registration.waiting, build)) finish(registration.waiting);
        else if (matchesWorker(navigator.serviceWorker.controller, build)) finish(navigator.serviceWorker.controller);
      }
      function changed() {
        checked();
        // Browser may assign registration.waiting just after statechange.
        if (!done) setTimeout(checked, 0);
      }
      function listen() {
        var installing = registration.installing;
        if (installing && observed.indexOf(installing) < 0) {
          observed.push(installing);
          installing.addEventListener('statechange', changed);
        }
        checked();
      }
      function found() { listen(); }
      registration.addEventListener('updatefound', found);
      timer = setTimeout(function () { finish(null); }, MAX_WAIT);
      listen();
    });
  }
  function waitForController(build) {
    return new Promise(function (resolve) {
      if (matchesWorker(navigator.serviceWorker.controller, build)) return resolve(true);
      var finished = false;
      var timer;
      function check() {
        if (finished || !matchesWorker(navigator.serviceWorker.controller, build)) return;
        finished = true;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', check);
        resolve(true);
      }
      navigator.serviceWorker.addEventListener('controllerchange', check);
      timer = setTimeout(function () {
        if (finished) return;
        finished = true;
        navigator.serviceWorker.removeEventListener('controllerchange', check);
        resolve(false);
      }, MAX_WAIT);
      check();
    });
  }
  function reloadVerified(build) {
    safeWhenIdle(function () {
      if (!failed || wasAttempted(build)) {
        show('O aplicativo aguarda uma atualização segura. Seus registros locais estão preservados.');
        return;
      }
      if (!matchesWorker(navigator.serviceWorker.controller, build)) {
        scheduleRetry();
        return;
      }
      if (!markAttempt(build)) {
        show('O aplicativo não conseguiu concluir a recuperação automática. Tente novamente quando houver conexão.');
        return;
      }
      guards.whenAuthIdle(function () {
        if (isBusy()) { safeWhenIdle(function () { location.reload(); }); return; }
        location.reload();
      });
    });
  }
  async function recover() {
    if (!failed || checking) return;
    if (mode === 'boot' && started) return;
    if (isBusy()) {
      safeWhenIdle(function () { void recover(); });
      return;
    }
    checking = true;
    show(navigator.onLine === false ? 'Sem conexão. Seus registros continuam salvos neste aparelho.' : 'Atualizando o aplicativo com segurança…');
    try {
      if (navigator.onLine === false || !('serviceWorker' in navigator)) { scheduleRetry(); return; }
      var response = await fetch('/version.json?repair=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) { scheduleRetry(); return; }
      var release = await response.json();
      var build = release && release.version;
      if (version(build) === null || version(LOCAL_BUILD) === null || version(build) <= version(LOCAL_BUILD) || downgrade(release.appVersion, LOCAL_APP)) {
        show('O aplicativo está aguardando uma versão válida. Seus dados locais foram preservados.');
        scheduleRetry();
        return;
      }
      if (wasAttempted(build)) {
        show('A atualização ainda não foi concluída. Tentaremos novamente quando houver uma nova versão.');
        scheduleRetry();
        return;
      }
      var serviceWorker = navigator.serviceWorker;
      if (matchesWorker(serviceWorker.controller, build)) {
        reloadVerified(build);
        return;
      }
      var registration = await serviceWorker.register('/sw.js?v=' + build, { updateViaCache: 'none' });
      try { await registration.update(); } catch (_e) { /* A worker might already be waiting. */ }
      var worker = await waitForWaiting(registration, build);
      if (!failed || (mode === 'boot' && started)) return;
      if (!worker) { scheduleRetry(); return; }
      if (matchesWorker(serviceWorker.controller, build)) {
        reloadVerified(build);
        return;
      }
      if (!matchesWorker(registration.waiting, build)) { scheduleRetry(); return; }
      safeWhenIdle(function () {
        if (!failed) return;
        var controllerReady = waitForController(build);
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        controllerReady.then(function (ok) {
          if (ok) reloadVerified(build);
          else scheduleRetry();
        });
      });
    } catch (_error) {
      scheduleRetry();
    } finally {
      checking = false;
    }
  }
  function trigger(reason) {
    if (reason === 'boot' && started) return;
    if (reason === 'chunk') mode = 'chunk';
    failed = true;
    void recover();
  }
  function assetFailure(event) {
    var target = event && event.target;
    if (!target || (target.tagName !== 'SCRIPT' && target.tagName !== 'LINK')) return;
    var src = target.src || target.href;
    try {
      var url = new URL(src, location.href);
      if (url.origin === location.origin && /^\/assets\/.+\.(?:js|css)$/i.test(url.pathname)) trigger('boot');
    } catch (_e) {}
  }
  window.addEventListener('error', assetFailure, true);
  window.addEventListener('online', function () { if (failed) void recover(); });
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (!started && document.visibilityState !== 'hidden') trigger('boot');
    }, 15000);
  });
  window.__consubovBootRepair = {
    markStarted: function () { started = true; if (mode === 'boot') { failed = false; hide(); } },
    recover: function () { trigger('chunk'); },
    setGuards: function (next) {
      if (next && typeof next.isCritical === 'function' && typeof next.whenIdle === 'function' && typeof next.whenAuthIdle === 'function') guards = next;
    }
  };
})();
