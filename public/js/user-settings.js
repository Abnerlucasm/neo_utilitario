document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/login.html';
        return;
    }
    document.getElementById('logoutButton').addEventListener('click', clearTokenAndRedirect);

    // Aguardar inicialização do módulo de personalização
    if (window.personalization) {
        await window.personalization.waitForInitialization();
    }

    // Carregar configurações do usuário
    await loadUserSettings();
    
    // Verificar permissões do usuário
    await checkUserPermissions();
    
    // Configurar event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Alternar tema - usar módulo de personalização
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (event) => {
            const selectedTheme = event.target.value;
            if (window.personalization) {
                window.personalization.setTheme(selectedTheme);
                showNotification(`Tema alterado para: ${selectedTheme}`, 'success');
            }
        });
    }
    
    // Salvar configurações - corrigir para usar o formulário
    const userSettingsForm = document.getElementById('userSettingsForm');
    if (userSettingsForm) {
        userSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveUserSettings();
        });
    }
    
    // Botão Editar
    const toggleEditBtn = document.getElementById('toggleEdit');
    if (toggleEditBtn) {
        toggleEditBtn.addEventListener('click', toggleEditMode);
    }
    
    // Alternar visibilidade da senha
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    }
    
    // Formulário de alteração de senha
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }

    // Listener para mudanças de tema do módulo de personalização
    document.addEventListener('themeChanged', (event) => {
        const { theme } = event.detail;
        console.log('Tema alterado globalmente:', theme);
    });
}

function toggleEditMode() {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const toggleEditBtn = document.getElementById('toggleEdit');
    
    if (userName.readOnly) {
        // Habilitar edição
        userName.readOnly = false;
        userEmail.readOnly = false;
        userEmail.disabled = false;
        toggleEditBtn.innerHTML = '<i class="fas fa-eye"></i> Visualizar';
        toggleEditBtn.classList.remove('btn-info');
        toggleEditBtn.classList.add('btn-warning');
    } else {
        // Desabilitar edição
        userName.readOnly = true;
        userEmail.readOnly = true;
        userEmail.disabled = true;
        toggleEditBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
        toggleEditBtn.classList.remove('btn-warning');
        toggleEditBtn.classList.add('btn-info');
    }
}

async function loadUserSettings() {
    try {
        const token = localStorage.getItem('auth_token');
        
        console.log('Carregando configurações do usuário...');
        
        const response = await fetch('/api/auth/user/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            console.warn(`Erro ao carregar configurações: ${response.status} ${response.statusText}`);
            applyDefaultSettings();
            return;
        }
        
        // Verificar se a resposta é JSON válido
        const contentType = response.headers.get('content-type');
        console.log('Tipo de conteúdo da resposta:', contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
            console.warn('Resposta não é JSON, usando configurações padrão');
            applyDefaultSettings();
            return;
        }
        
        // Tentar fazer o parse do JSON com tratamento de erro
        let settings;
        try {
            const text = await response.text();
            console.log('Texto da resposta:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            
            if (!text || text.trim() === '') {
                console.warn('Resposta vazia, usando configurações padrão');
                applyDefaultSettings();
                return;
            }
            
            settings = JSON.parse(text);
        } catch (parseError) {
            console.error('Erro ao fazer parse da resposta JSON:', parseError);
            applyDefaultSettings();
            return;
        }
        
        console.log('Configurações carregadas:', settings);
        
        // Preencher campos do formulário
        document.getElementById('userName').value = settings.name || '';
        document.getElementById('userEmail').value = settings.email || '';
        
        // Configurar tema usando módulo de personalização
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect && window.personalization) {
            const theme = settings.theme || 'light';
            themeSelect.value = theme;
            
            // Aplicar tema via módulo de personalização
            window.personalization.setTheme(theme);
        }
        
        // Salvar configurações no localStorage
        localStorage.setItem('userSettings', JSON.stringify({
            theme: settings.theme || 'light'
        }));
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        // Em caso de erro, usar configurações padrão
        applyDefaultSettings();
    }
}

function applyDefaultSettings() {
    console.log('Aplicando configurações padrão');
    
    // Aplicar configurações padrão
    const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || { theme: 'light' };
    
    // Configurar tema usando módulo de personalização
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect && window.personalization) {
        const theme = savedSettings.theme || 'light';
        themeSelect.value = theme;
        
        // Aplicar tema via módulo de personalização
        window.personalization.setTheme(theme);
    }
    
    // Preencher campos do formulário com valores padrão ou vazios
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    
    if (userName) {
        userName.value = localStorage.getItem('userName') || '';
    }
    
    if (userEmail) {
        userEmail.value = localStorage.getItem('userEmail') || '';
    }
}

async function checkUserPermissions() {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Decodificar token para verificar se o usuário é admin
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const isAdmin = tokenData.roles && tokenData.roles.includes('admin');
        
        console.log('Verificando permissões - Usuário é admin?', isAdmin);
        
        // Mostrar ou ocultar seção de administração
        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            adminSection.classList.toggle('hidden', !isAdmin);
        }
        
    } catch (error) {
        console.error('Erro ao verificar permissões:', error);
    }
}

async function saveUserSettings() {
    try {
        const token = localStorage.getItem('auth_token');
        const name = document.getElementById('userName').value;
        const email = document.getElementById('userEmail').value;
        const theme = document.getElementById('themeSelect').value;
        
        // Salvar valores no localStorage como backup
        localStorage.setItem('userName', name);
        localStorage.setItem('userEmail', email);
        
        const response = await fetch('/api/auth/user/settings', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                email,
                theme
            })
        });

            if (!response.ok) {
            throw new Error('Erro ao salvar configurações');
        }
        
        // Salvar configurações no localStorage
        localStorage.setItem('userSettings', JSON.stringify({
            theme
        }));
        
        // Aplicar tema via módulo de personalização
        if (window.personalization) {
            window.personalization.setTheme(theme);
        }
        
        showNotification('Configurações salvas com sucesso', 'success');
        } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showNotification('Erro ao salvar configurações', 'danger');
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toggleIcon = document.getElementById('togglePasswordIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (confirmPasswordInput) confirmPasswordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
                } else {
        passwordInput.type = 'password';
        if (confirmPasswordInput) confirmPasswordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validar senhas
    if (newPassword !== confirmPassword) {
        showNotification('As senhas não coincidem', 'danger');
        return;
    }
    
    try {
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch('/api/auth/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Erro ao alterar senha');
        }
        
        // Limpar formulário
        document.getElementById('changePasswordForm').reset();
        
        showNotification('Senha alterada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showNotification(error.message || 'Erro ao alterar senha', 'danger');
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'danger' ? 'error' : type} mb-4`;
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />' : 
              type === 'danger' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />' :
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'}
        </svg>
        <span>${message}</span>
    `;
    
    // Adicionar notificação à página
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(notification, container.firstChild);
    } else {
        // Se não houver container, adicionar ao body
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
    }
    
    // Remover notificação após 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
} 

// Limpar token e redirecionar para login
function clearTokenAndRedirect() {
    const logoutButton = document.getElementById('logoutButton');
    const originalText = logoutButton.innerHTML;
    
    // Adicionar loading
    logoutButton.innerHTML = `
        <span class="loading loading-spinner loading-sm"></span>
        Saindo...
    `;
    logoutButton.disabled = true;
    
    localStorage.removeItem('auth_token');
    
    // console.log('Token removido. Redirecionando para login...');
    
    setTimeout(() => {
        window.location.href = '/pages/login.html';
    }, 2000);
}