// Service worker de CalCUM UDB — RF-15: la app funciona sin conexión después
// de la primera carga. Estrategia stale-while-revalidate para GET same-origin:
// sirve desde caché al instante y repone en segundo plano. Solo datos locales,
// nunca se envía nada a un servidor (RF-16).

const CACHE = 'calcum-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== 'GET') return;

  const url = new URL(solicitud.url);
  // RF-16: nada fuera del propio origen.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardada = await cache.match(solicitud, { ignoreSearch: true });

      const red = fetch(solicitud)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            cache.put(solicitud, respuesta.clone());
          }
          return respuesta;
        })
        // Sin red: si había caché, se sirve; si no, falla ruidosamente.
        .catch(() => guardada);

      // Navegación sin caché previa: cae al shell.
      if (!guardada && solicitud.mode === 'navigate') {
        const shell = (await cache.match('./index.html')) || (await cache.match('./'));
        if (shell) return shell;
      }

      return guardada || red;
    })(),
  );
});
