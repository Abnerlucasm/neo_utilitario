// Service Worker para cache e funcionalidades offline
const CACHE_NAME = 'neo-utilitario-v1';

// Arquivos para cache inicial
const urlsToCache = [
    '/',
    '/pages/index.html',
    '/pages/glassfish.html',
    '/pages/utilitarios.html',
    '/pages/user-settings.html',
    '/js/index.js',
    '/js/glassfish.js',
    '/js/auth.js',
    '/js/theme-manager.js',
    '/js/apply-theme-immediate.js',
    '/js/utilitarios.js',
    '/js/user-settings.js',
    '/components/navbar/navbar.js',
    '/components/footer/footer.js',
    '/components/theme-selector/theme-selector.js',
    '/css/neohub-core.css',
    '/css/pages/index.css',
    '/assets/neo-logo-small.png',
    '/assets/favicon.ico',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-512x512.png',
    '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    // Ignorar requisições problemáticas ou de API
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension') ||
        event.request.url.includes('/api/') ||
        event.request.url.includes('/admin/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;

                return fetch(event.request.clone()).then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    try {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    } catch (error) {
                        console.warn('Erro ao cachear:', error);
                    }

                    return response;
                });
            })
    );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
}); 