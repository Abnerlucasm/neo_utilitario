/**
 * Script de depuração para autenticação e autorização
 * Este script adiciona um botão de depuração no canto inferior direito da tela
 * e fornece funções úteis para debugar problemas de autenticação
 */

// Definir variáveis globais
let originalFetch = null;
let authHeaderInjected = false;

// Adicionar botão de debug ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    createDebugButton();
    autoInjectAuthHeader();
});

// Injetar header de autorização automaticamente
function autoInjectAuthHeader() {
    // Verificar se já tem token
    const token = localStorage.getItem('auth_token');
    if (token && !authHeaderInjected) {
        injectAuthHeader(false);
    }
}

// Criar botão de debug
function createDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.id = 'authDebugBtn';
    debugBtn.innerHTML = '🔧 Debug Auth';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        z-index: 9999;
        padding: 8px 12px;
        background-color: #363636;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: sans-serif;
        font-size: 14px;
        opacity: 0.7;
    `;
    
    debugBtn.addEventListener('click', showDebugModal);
    document.body.appendChild(debugBtn);
}

// Mostrar modal de debug
function showDebugModal() {
    // Remover modal existente, se houver
    const existingModal = document.getElementById('authDebugModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Obter o token atual
    const token = localStorage.getItem('auth_token');
    let tokenInfo = 'Nenhum token encontrado';
    let isTokenValid = false;
    let isAdmin = false;
    
    // Verificar se há token e tentar decodificá-lo
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            isTokenValid = payload.exp && payload.exp * 1000 > Date.now();
            isAdmin = payload.roles && payload.roles.some(role => role.toLowerCase() === 'admin');
            
            tokenInfo = `
                <strong>ID:</strong> ${payload.id || 'N/A'}<br>
                <strong>Email:</strong> ${payload.email || 'N/A'}<br>
                <strong>Roles:</strong> ${payload.roles ? payload.roles.join(', ') : 'Nenhuma'}<br>
                <strong>Admin:</strong> ${isAdmin ? '✅ Sim' : '❌ Não'}<br>
                <strong>Válido:</strong> ${isTokenValid ? '✅ Sim' : '❌ Não'}<br>
                <strong>Expiração:</strong> ${payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'N/A'}<br>
                <strong>Headers Injetados:</strong> ${authHeaderInjected ? '✅ Sim' : '❌ Não'}<br>
            `;
        } catch (e) {
            tokenInfo = `Erro ao decodificar token: ${e.message}`;
        }
    }
    
    // Criar o modal
    const modal = document.createElement('div');
    modal.id = 'authDebugModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Conteúdo do modal
    modal.innerHTML = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%;">
            <h2 style="margin-top: 0; margin-bottom: 15px; font-size: 18px;">Depuração de Autenticação</h2>
            
            <div style="margin-bottom: 20px; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 14px;">
                <h3 style="margin-top: 0; font-size: 16px;">Token JWT</h3>
                <div>${tokenInfo}</div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <button id="checkAuthBtn" style="padding: 8px 12px; background-color: #3298dc; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔍 Verificar Status
                </button>
                <button id="testAdminBtn" style="padding: 8px 12px; background-color: #485fc7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    👑 Login como Admin
                </button>
                <button id="testAccessBtn" style="padding: 8px 12px; background-color: #48c774; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔍 Testar acesso
                </button>
                <button id="injectAuthBtn" style="padding: 8px 12px; background-color: #ff7f0e; color: white; border: none; border-radius: 4px; cursor: pointer; ${authHeaderInjected ? 'opacity: 0.6;' : ''}">
                    ${authHeaderInjected ? '✓ ' : ''}💉 Injetar header Auth
                </button>
                <button id="reloadBtn" style="padding: 8px 12px; background-color: #3cb043; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Recarregar Página
                </button>
                <button id="clearTokenBtn" style="padding: 8px 12px; background-color: #f14668; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🗑️ Limpar token
                </button>
                <button id="closeDebugBtn" style="padding: 8px 12px; background-color: #363636; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    ✖️ Fechar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar event listeners aos botões
    document.getElementById('checkAuthBtn').addEventListener('click', checkAuthStatus);
    document.getElementById('testAdminBtn').addEventListener('click', loginAsAdmin);
    document.getElementById('testAccessBtn').addEventListener('click', testAdminFetch);
    document.getElementById('injectAuthBtn').addEventListener('click', () => injectAuthHeader(true));
    document.getElementById('reloadBtn').addEventListener('click', () => window.location.reload());
    document.getElementById('clearTokenBtn').addEventListener('click', clearTokenAndRedirect);
    document.getElementById('closeDebugBtn').addEventListener('click', () => modal.remove());
}

// Verificar status de autenticação
async function checkAuthStatus() {
    try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
            showDebugAlert('Nenhum token encontrado no localStorage');
            return;
        }
        
        const response = await fetch('/api/user/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showDebugAlert(`Autenticado como: ${data.email || data.name} (Status: ${response.status})`);
        } else {
            showDebugAlert(`Não autenticado. Status: ${response.status}`);
        }
    } catch (error) {
        showDebugAlert(`Erro ao verificar autenticação: ${error.message}`);
    }
}

// Login como admin (usando as credenciais padrão)
async function loginAsAdmin() {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'abner.freitas@neosistemas.com.br',
                password: 'admin'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                showDebugAlert('Login como admin realizado com sucesso! Token salvo.');
                
                // Injetar o header de autorização automaticamente
                injectAuthHeader(false);
                
                // Atualizar a página após 2 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showDebugAlert('Login bem-sucedido, mas nenhum token recebido');
            }
        } else {
            let errorMessage = 'Falha no login';
            try {
                const errorData = await response.json();
                errorMessage = `Falha no login: ${errorData.error || response.statusText}`;
            } catch (e) {
                errorMessage = `Falha no login: ${response.status} ${response.statusText}`;
            }
            showDebugAlert(errorMessage);
        }
    } catch (error) {
        showDebugAlert(`Erro ao fazer login: ${error.message}`);
    }
}

// Testar fetch em rota protegida
async function testAdminFetch() {
    try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
            showDebugAlert('Nenhum token encontrado. Faça login primeiro.');
            return;
        }
        
        const response = await fetch('/api/learning/modules', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showDebugAlert(`Acesso autorizado! Recebeu ${Array.isArray(data) ? data.length : 'dados'} do servidor.`);
        } else {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Não foi possível ler a resposta';
            }
            showDebugAlert(`Acesso negado. Status: ${response.status}. ${errorText}`);
        }
    } catch (error) {
        showDebugAlert(`Erro ao testar acesso: ${error.message}`);
    }
}

// Limpar token e redirecionar para login
function clearTokenAndRedirect() {
    localStorage.removeItem('auth_token');
    
    // Restaurar o fetch original se estiver modificado
    if (originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
        authHeaderInjected = false;
    }
    
    showDebugAlert('Token removido. Redirecionando para login...');
    
    setTimeout(() => {
        window.location.href = '/pages/login.html';
    }, 2000);
}

// Injetar header de autorização em todas as requisições
function injectAuthHeader(showAlert = true) {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        if (showAlert) {
            showDebugAlert('Nenhum token encontrado para injetar');
        }
        return;
    }
    
    // Se já tiver injetado, não precisamos fazer de novo
    if (authHeaderInjected) {
        if (showAlert) {
            showDebugAlert('Header de autorização já está injetado em todas as requisições!');
        }
        return;
    }
    
    // Salvar o fetch original se ainda não tiver feito
    if (!originalFetch) {
        originalFetch = window.fetch;
    }
    
    // Monkey patch do método fetch para adicionar o header Authorization
    window.fetch = function(url, options = {}) {
        // Inicializar options se não existir
        options = options || {};
        
        // Inicializar headers se não existir
        if (!options.headers) {
            options.headers = {};
        }
        
        // Se já for um objeto Headers, clone-o
        if (options.headers instanceof Headers) {
            const originalHeaders = options.headers;
            options.headers = {};
            
            for (const [key, value] of originalHeaders.entries()) {
                options.headers[key] = value;
            }
        }
        
        // Definir o header Authorization se não estiver definido
        if (!options.headers['Authorization']) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        return originalFetch(url, options);
    };
    
    authHeaderInjected = true;
    
    if (showAlert) {
        showDebugAlert('Header de autorização injetado em todas as requisições fetch!');
    }
}

// Mostrar alert de debug
function showDebugAlert(message) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        background-color: #3298dc;
        color: white;
        border-radius: 4px;
        z-index: 10001;
        max-width: 300px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-family: sans-serif;
        font-size: 14px;
    `;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    // Remover após 5 segundos
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.5s';
        
        // Remover do DOM após a transição
        setTimeout(() => {
            alertDiv.remove();
        }, 500);
    }, 5000);
} 