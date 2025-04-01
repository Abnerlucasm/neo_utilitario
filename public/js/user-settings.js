document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/login.html';
        return;
    }
    document.getElementById('logoutButton').addEventListener('click', clearTokenAndRedirect);

    // Carregar configurações do usuário
    await loadUserSettings();
    
    // Verificar permissões do usuário
    await checkUserPermissions();
    
    // Configurar event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Alternar tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    
    // Salvar configurações
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveUserSettings);
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
        
        // Configurar tema
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = settings.theme === 'dark';
            
            // Aplicar tema
            if (settings.theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.body.classList.add('dark-theme');
            } else {
                document.documentElement.removeAttribute('data-theme');
                document.body.classList.remove('dark-theme');
            }
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
    
    // Configurar tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedSettings.theme === 'dark';
        
        // Aplicar tema
        if (savedSettings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.remove('dark-theme');
        }
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
            adminSection.style.display = isAdmin ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error('Erro ao verificar permissões:', error);
    }
}

function toggleTheme(event) {
    const isDarkTheme = event.target.checked;
    
    if (isDarkTheme) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
                } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark-theme');
    }
    
    // Salvar configuração no localStorage
    const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    settings.theme = isDarkTheme ? 'dark' : 'light';
    localStorage.setItem('userSettings', JSON.stringify(settings));
}

async function saveUserSettings() {
    try {
        const token = localStorage.getItem('auth_token');
        const name = document.getElementById('userName').value;
        const email = document.getElementById('userEmail').value;
        const theme = document.getElementById('themeToggle').checked ? 'dark' : 'light';
        
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
    notification.className = `notification is-${type}`;
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    
    // Adicionar evento para fechar notificação
    notification.querySelector('.delete').addEventListener('click', () => {
        notification.remove();
    });
    
    // Adicionar notificação à página
    const notificationsContainer = document.getElementById('notifications');
    if (notificationsContainer) {
        notificationsContainer.appendChild(notification);
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
    localStorage.removeItem('auth_token');
    
    // console.log('Token removido. Redirecionando para login...');
    
    setTimeout(() => {
        window.location.href = '/pages/login.html';
    }, 2000);
}