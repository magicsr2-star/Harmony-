// Harmony service worker v1.6.2
// Para GitHub Pages en subcarpeta (usuario.github.io/harmony/).
// Para publicar una versión nueva basta con cambiar el número de CACHE.
var CACHE = 'harmony-v1.6.2';
var PREFIJO = 'harmony-';   // solo se borran cachés propios: el origen se comparte con tus otras apps
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './privacy.html'];
var FUENTES = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|cdn\.fontshare\.com)$/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // index.html es obligatorio; los demás archivos son opcionales.
    return c.add(new Request('./index.html', { cache: 'reload' })).then(function () {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.indexOf(PREFIJO) === 0 && k !== CACHE;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;

  // Fuentes: caché primero, se actualizan en segundo plano.
  // Se piden con CORS para poder guardar las hojas de estilo (llegan como "opacas").
  if (FUENTES.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreVary: true }).then(function (hit) {
        var net = fetch(req.url, { mode: 'cors', credentials: 'omit' }).catch(function () { return fetch(req); })
          .then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(function () {});
            return res;
          }).catch(function () { return hit || Response.error(); });
        if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
        return net;
      });
    }));
    return;
  }

  // Archivos de la app: red primero y sin el caché HTTP de GitHub Pages (siempre la última versión);
  // sin internet, lo guardado.
  if (url.origin === location.origin) {
    var nav = req.mode === 'navigate';
    e.respondWith(caches.open(CACHE).then(function (c) {
      return fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          e.waitUntil(c.put(nav ? new Request(url.origin + url.pathname) : req, res.clone()).catch(function () {}));
        }
        return res;
      }).catch(function () {
        return c.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          if (nav) return c.match('./index.html').then(function (r) { return r || Response.error(); });
          return Response.error();   // un recurso faltante no debe devolver HTML
        });
      });
    }));
  }
});
