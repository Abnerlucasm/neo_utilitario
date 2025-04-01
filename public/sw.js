// Service Worker para cache e funcionalidades offline
const CACHE_NAME = 'neo-utilitario-v1';

// Arquivos para cache inicial
const urlsToCache = [
    '/',
    '/pages/glassfish.html',
    '/js/glassfish.js',
    '/js/auth.js',
    '/components/navbar/navbar.js',
    '/components/footer/footer.js',
    '/assets/neo-logo-small.png',
    '/assets/favicon.ico'
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