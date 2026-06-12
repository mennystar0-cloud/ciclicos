// Service worker mínimo — habilita instalación PWA sin interceptar peticiones Firebase
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
