document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Aguardar inicialização do módulo de personalização
    if (window.personalization) {
        await window.personalization.waitForInitialization();
        
        // Carregar configurações salvas e aplicar tema
        const currentTheme = window.personalization.getTheme();
        document.documentElement.setAttribute('data-theme', currentTheme);
        console.log('Tema aplicado:', currentTheme);
    }

    // Resto do código para carregar recursos e configurar eventos
    loadAndFilterResources();
    // ... outras funções e lógica
});

        // Aguardar o carregamento do DOM e do AuthManager
        window.addEventListener('load', async () => {
            try {
                // Verificar autenticação
                if (typeof AuthManager !== 'undefined') {
                    await AuthManager.checkAuth();
                } else {
                    console.error('AuthManager não está definido');
                }
            } catch (error) {
                console.error('Erro ao inicializar a página:', error);
            }
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