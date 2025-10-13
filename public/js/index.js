document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Aplicar tema salvo usando ThemeManager
    if (window.ThemeManager) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        window.ThemeManager.setTheme(savedTheme);
        console.log('Tema aplicado via ThemeManager:', savedTheme);
    } else {
        // Fallback: aplicar tema diretamente
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        console.log('Tema aplicado diretamente:', savedTheme);
    }

    // Resto do código para carregar recursos e configurar eventos
    loadAndFilterResources();
    updateGreeting();
    
    // Registrar Service Worker para PWA
    registerServiceWorker();
    
    // Verificar suporte a Service Worker
    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Este navegador não suporta Service Workers');
        console.warn('⚠️ PWA pode não funcionar corretamente');
    }
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

// Registrar Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        console.log('🔧 Tentando registrar Service Worker...');
        
        // Registrar imediatamente, não esperar o load
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registrado com sucesso:', registration.scope);
                console.log('📋 Service Worker state:', registration.active ? registration.active.state : 'installing');
                
                // Verificar se há atualizações
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Nova versão do Service Worker encontrada');
                });
                
                // Aguardar o Service Worker estar ativo
                if (registration.active) {
                    console.log('✅ Service Worker já está ativo');
                } else if (registration.installing) {
                    console.log('⏳ Service Worker está sendo instalado...');
                    registration.installing.addEventListener('statechange', () => {
                        if (registration.installing.state === 'activated') {
                            console.log('✅ Service Worker ativado com sucesso');
                        }
                    });
                }
            })
            .catch(error => {
                console.error('❌ Falha ao registrar Service Worker:', error);
                console.error('Detalhes do erro:', error.message);
                
                // Verificar se é erro de certificado SSL
                if (error.message.includes('SSL certificate error') || error.message.includes('SecurityError')) {
                    console.warn('⚠️ Erro de certificado SSL detectado');
                    console.warn('💡 Para resolver:');
                    console.warn('   1. Aceite o certificado SSL no navegador');
                    console.warn('   2. Ou use um certificado SSL válido');
                    console.warn('   3. Ou acesse via HTTP para desenvolvimento');
                }
            });
    } else {
        console.warn('⚠️ Service Worker não suportado neste navegador');
    }
}

let deferredPrompt = null;

// Função para mostrar botão PWA
function showPWAButton() {
    const heroInstallButton = document.getElementById('hero-install-button');
    
    if (heroInstallButton) {
        heroInstallButton.style.display = 'inline-flex';
        console.log('✅ Botão PWA mostrado');
    }
}

// Função para esconder botão PWA
function hidePWAButton() {
    const heroInstallButton = document.getElementById('hero-install-button');
    
    if (heroInstallButton) {
        heroInstallButton.style.display = 'none';
        console.log('❌ Botão PWA ocultado');
    }
}

// Função para instalar PWA
function installPWA() {
    console.log('🚀 Iniciando instalação PWA...');
    
    if (!deferredPrompt) {
        console.error('❌ deferredPrompt não está disponível');
        
        // Verificar se estamos em rede local
        if (isLocalhost) {
            if (window.location.protocol === 'http:') {
                alert('Em HTTP local, o PWA não pode ser instalado. Use HTTPS em produção.');
            } else {
                alert('Em HTTPS local, o PWA não pode ser instalado devido a problemas de certificado SSL.\n\nPara resolver:\n1. Aceite o certificado SSL no navegador\n2. Ou use um certificado SSL válido\n3. Ou acesse via HTTP para desenvolvimento');
            }
        } else {
            alert('PWA não pode ser instalado no momento. Verifique se:\n- O site está em HTTPS\n- O Service Worker está ativo\n- O manifest está correto\n- O certificado SSL é válido');
        }
        return;
    }
    
    console.log('📱 Chamando prompt() de instalação...');
    
    try {
        // Mostrar o prompt de instalação
        deferredPrompt.prompt();
        
        // Aguardar a resposta do usuário
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log('👤 Resultado da escolha do usuário:', choiceResult.outcome);
            
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ Usuário aceitou a instalação do PWA');
                hidePWAButton();
            } else {
                console.log('❌ Usuário rejeitou a instalação do PWA');
                // Manter botão visível para tentar novamente
            }
            
            // Limpar o prompt
            deferredPrompt = null;
        }).catch((error) => {
            console.error('❌ Erro ao processar escolha do usuário:', error);
            deferredPrompt = null;
        });
    } catch (error) {
        console.error('❌ Erro ao chamar prompt():', error);
        alert('Erro ao tentar instalar o PWA. Tente novamente.');
    }
}

// Event listener para beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🚀 PWA pode ser instalado - beforeinstallprompt disparado');
    
    // Prevenir que o banner padrão apareça
    e.preventDefault();
    
    // Armazenar o evento para uso posterior
    deferredPrompt = e;
    
    // Mostrar nosso botão personalizado
    showPWAButton();
});

// Event listener para o botão do hero
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 DOM carregado - configurando event listeners PWA');
    
    const heroInstallButton = document.getElementById('hero-install-button');
    if (heroInstallButton) {
        heroInstallButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🖱️ Botão PWA clicado');
            installPWA();
        });
        console.log('✅ Event listener do botão PWA configurado');
    } else {
        console.warn('⚠️ Botão PWA não encontrado');
    }
});

// Verificar se o aplicativo já está instalado
window.addEventListener('load', () => {
if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('📱 PWA já está instalado - ocultando botão');
        hidePWAButton();
    } else {
        console.log('🌐 PWA não está instalado');
    }
});

// Event listener para quando o PWA é instalado
window.addEventListener('appinstalled', () => {
    console.log('🎉 PWA foi instalado com sucesso!');
    hidePWAButton();
    deferredPrompt = null;
});

// Detectar se estamos em rede local
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' || 
                   window.location.hostname.startsWith('192.168.') ||
                   window.location.hostname.startsWith('10.') ||
                   window.location.hostname.startsWith('172.');

// Debug: verificar critérios de instalação PWA
function checkPWAInstallability() {
    console.log('🔍 Verificando critérios de instalação PWA:');
    console.log('- Service Worker suportado:', 'serviceWorker' in navigator);
    console.log('- Manifest carregado:', document.querySelector('link[rel="manifest"]') !== null);
    console.log('- HTTPS:', window.location.protocol === 'https:');
    console.log('- Hostname:', window.location.hostname);
    console.log('- Port:', window.location.port);
    console.log('- Rede local:', isLocalhost);
    console.log('- Ícones disponíveis:', document.querySelectorAll('link[rel="icon"]').length > 0);
    console.log('- deferredPrompt disponível:', deferredPrompt !== null);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            console.log('- Service Worker ativo:', registration !== null);
            if (registration) {
                console.log('- Service Worker scope:', registration.scope);
                console.log('- Service Worker state:', registration.active ? registration.active.state : 'N/A');
            }
        }).catch(error => {
            console.error('- Erro ao verificar Service Worker:', error);
        });
    } else {
        console.warn('⚠️ Service Worker não suportado neste navegador');
    }
}

// Executar verificação após carregamento
window.addEventListener('load', () => {
    setTimeout(checkPWAInstallability, 2000);
});

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