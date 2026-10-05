import { CLIENT_RELEASE_STORAGE_KEY } from '@/lib/clientReleaseConstants'

export function getClientAssetRecoveryScript(releaseId: string): string {
  const safeReleaseId = JSON.stringify(releaseId)

  return `(function () {
  var RELEASE_ID = ${safeReleaseId};
  var STORAGE_KEY = ${JSON.stringify(CLIENT_RELEASE_STORAGE_KEY)};

  function isStyleBroken() {
    var marker = document.querySelector('[class*="bg-info-soft"], .rounded-card');
    if (!marker) return false;

    var root = getComputedStyle(document.documentElement);
    if (root.getPropertyValue('--color-info-soft').trim() !== '#eef4ff') return true;

    var card = document.querySelector('.rounded-card');
    if (!card) return false;

    var radius = getComputedStyle(card).borderRadius;
    return radius === '0px' || radius === '';
  }

  function ensureStylesheetsVersioned() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    var pending = 0;

    function done() {
      pending--;
    }

    for (var i = 0; i < links.length; i++) {
      (function (link) {
        if (!link.href) return;

        try {
          var url = new URL(link.href);
          if (url.searchParams.get('cupv') === RELEASE_ID) return;

          url.searchParams.set('cupv', RELEASE_ID);
          pending++;

          var fresh = document.createElement('link');
          fresh.rel = 'stylesheet';
          fresh.href = url.toString();
          fresh.onload = function () {
            if (link.parentNode) link.remove();
            done();
          };
          fresh.onerror = done;
          link.parentNode.insertBefore(fresh, link.nextSibling);
        } catch (error) {}
      })(links[i]);
    }

    if (pending === 0) return Promise.resolve();

    return new Promise(function (resolve) {
      var waited = 0;
      var timer = window.setInterval(function () {
        if (pending <= 0 || waited >= 4000) {
          window.clearInterval(timer);
          resolve();
        }
        waited += 50;
      }, 50);
    });
  }

  function hardRefresh() {
    var returnPath = window.location.pathname + window.location.search + window.location.hash;
    var refreshUrl = new URL('/api/client-release/refresh', window.location.origin);
    refreshUrl.searchParams.set('return', returnPath || '/');
    window.location.replace(refreshUrl.toString());
  }

  function run() {
    try {
      localStorage.setItem(STORAGE_KEY, RELEASE_ID);
    } catch (error) {}

    ensureStylesheetsVersioned().then(function () {
      window.requestAnimationFrame(function () {
        if (isStyleBroken()) hardRefresh();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();`
}
