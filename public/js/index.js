document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Escutar evento de recursos carregados
    document.addEventListener('userResourcesLoaded', (event) => {
        const { resources } = event.detail;
        filterCards(resources);
    });

    // Carregar recursos imediatamente se disponíveis
    loadAndFilterResources();

    // Carregar configurações salvas
    const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
    
    // Aplicar tema inicial
    if (userSettings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
    }

    // PWA Installation
    const installContainer = document.getElementById('install-container');
    const installButton = document.getElementById('install-button');

    if (installContainer && installButton) {
        installButton.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('Usuário aceitou a instalação do PWA');
                    }
                    deferredPrompt = null;
                });
            }
        });
    }

    // Atualizar saudação
    updateGreeting();
});

async function loadAndFilterResources() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        // Verificar se o usuário é admin através do token
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const isAdmin = decodedToken.roles && decodedToken.roles.includes('admin');
        
        console.log('Verificando permissões - Usuário é admin?', isAdmin);

        if (isAdmin) {
            console.log('Usuário é admin - mostrando todos os cards');
            
            // Para admin, mostrar todos os cards
            const cards = document.querySelectorAll('.column[data-resource]');
            cards.forEach(card => {
                card.style.display = '';
            });
            
            return;
        }

        // Para usuários não-admin, buscar recursos dos papéis
        const response = await fetch('/api/auth/user-resources', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar recursos');
        
        const resources = await response.json();
        console.log('Recursos carregados (detalhado):', JSON.stringify(resources, null, 2));
        
        // Disparar evento com os recursos
        const event = new CustomEvent('userResourcesLoaded', { 
            detail: { resources }
        });
        document.dispatchEvent(event);
        
        filterCards(resources);
    } catch (error) {
        console.error('Erro ao carregar recursos:', error);
    }
}

async function updateGreeting() {
    try {
        const greeting = document.getElementById('greeting');
        if (!greeting) return;

        const response = await fetch('/api/user/settings');
        if (!response.ok) throw new Error('Erro ao buscar dados do usuário');

        const userData = await response.json();
        
        if (userData.name) {
            const hour = new Date().getHours();
            const timeGreeting = hour < 12 ? 'Bom dia' : 
                               hour < 18 ? 'Boa tarde' : 
                               'Boa noite';
            
            greeting.textContent = `${timeGreeting}, ${userData.name}!`;
        }
    } catch (error) {
        console.error('Erro ao atualizar saudação:', error);
    }
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevenir que o mini-infobar apareça no navegador
    deferredPrompt = e; // Armazenar o evento para que possamos chamar `prompt()` depois
    const installContainer = document.getElementById('install-container');
    installContainer.style.display = 'block'; // Exibir o botão de instalação

    const installButton = document.getElementById('install-button');
    installButton.addEventListener('click', () => {
        installContainer.style.display = 'none'; // Esconder o botão de instalação
        deferredPrompt.prompt(); // Mostrar o prompt de instalação
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Usuário aceitou a instalação do PWA');
            } else {
                console.log('Usuário rejeitou a instalação do PWA');
            }
            deferredPrompt = null; // Limpar o evento
        });
    });
});

// Verificar se o aplicativo já está instalado
if (window.matchMedia('(display-mode: standalone)').matches) {
    const installContainer = document.getElementById('install-container');
    installContainer.style.display = 'none'; // Ocultar o botão se já estiver instalado
}

function filterCards(userResources) {
    console.log('Filtrando cards com recursos:', JSON.stringify(userResources, null, 2));
    const cards = document.querySelectorAll('.column[data-resource]');
    
    cards.forEach(card => {
        const resourcePath = card.querySelector('.card-footer-item')?.getAttribute('href');
        console.log('Verificando card:', resourcePath);
        
        if (resourcePath) {
            // Normalizar o caminho do recurso para comparação
            const normalizedPath = resourcePath.startsWith('/pages/') ? 
                resourcePath : 
                `/pages${resourcePath}`;
            
            const hasAccess = userResources.some(r => {
                const resourceNormalizedPath = r.path.startsWith('/pages/') ? 
                    r.path : 
                    `/pages${r.path}`;
                    
                const matches = resourceNormalizedPath === normalizedPath;
                console.log(`Comparando: ${resourceNormalizedPath} com ${normalizedPath} = ${matches}`);
                return matches;
            });
            
            console.log(`Acesso ao card ${normalizedPath}: ${hasAccess}`);
            card.style.display = hasAccess ? '' : 'none';
        }
    });
}