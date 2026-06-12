// Service worker mínimo — solo para habilitar el prompt de instalación PWA
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', () => {});
