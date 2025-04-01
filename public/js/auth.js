class AuthManager {
    static instance = null;

    constructor() {
        if (AuthManager.instance) {
            return AuthManager.instance;
        }
        AuthManager.instance = this;
        
        this.apiUrl = '/api/auth';
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.errorContainer = document.getElementById('errorContainer');
        this.successContainer = document.getElementById('successContainer');
        this.passwordInput = document.getElementById('password');
        this.togglePassword = document.getElementById('togglePassword');
        this.twoFactorField = document.getElementById('twoFactorField');
        this.tempToken = null;
        
        this.setupEventListeners();
        this.setupPasswordToggle();
    }

    setupPasswordToggle() {
        if (this.togglePassword && this.passwordInput) {
            this.togglePassword.addEventListener('click', () => {
                const type = this.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                this.passwordInput.setAttribute('type', type);
                
                const icon = this.togglePassword.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        }
    }

    static async checkAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('Nenhum token encontrado no localStorage');
                if (!window.location.pathname.includes('/pages/login.html') && 
                    !window.location.pathname.includes('/pages/register.html')) {
                    window.location.href = '/pages/login.html';
                }
                return null;
            }

            console.log('Token encontrado, verificando autenticação...');
            const response = await fetch('/api/auth/check', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Resposta da verificação de auth:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('Falha na verificação do token:', response.status, response.statusText);
                try {
                    const errorData = await response.json();
                    console.error('Detalhes do erro:', errorData);
                } catch (e) {
                    console.error('Não foi possível obter detalhes do erro');
                }
                
                localStorage.removeItem('auth_token');
                console.log('Token removido do localStorage');
                
                // Comentamos temporariamente a redireção automática para diagnóstico
                // if (!window.location.pathname.includes('/pages/login.html')) {
                //     window.location.href = '/pages/login.html';
                // }
                
                return null;
            }

            const data = await response.json();
            console.log('Dados do usuário recebidos:', data.isAuthenticated);
            
            // Atualizar informações do usuário na navbar usando um evento customizado
            // em vez de chamar o método diretamente
            const userInfoEvent = new CustomEvent('user-info-updated', { 
                detail: { userData: data.user },
                bubbles: true,
                composed: true
            });
            document.dispatchEvent(userInfoEvent);

            return data;
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            localStorage.removeItem('auth_token');
            console.log('Token removido após erro');
            
            // Comentamos temporariamente a redireção automática para diagnóstico
            // if (!window.location.pathname.includes('/pages/login.html')) {
            //     window.location.href = '/pages/login.html';
            // }
            
            return null;
        }
    }

    setupEventListeners() {
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }
        
        if (this.registerForm) {
            this.registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleRegister();
            });
        }
        
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleLogout();
            });
        }
    }

    showError(message) {
        if (this.errorContainer) {
            this.errorContainer.textContent = message;
            this.errorContainer.classList.remove('d-none');
            setTimeout(() => {
                this.errorContainer.classList.add('d-none');
            }, 5000);
        } else {
            console.error('Erro:', message);
            alert(`Erro: ${message}`);
        }
    }
    
    showSuccess(message) {
        if (this.successContainer) {
            this.successContainer.textContent = message;
            this.successContainer.classList.remove('d-none');
            setTimeout(() => {
                this.successContainer.classList.add('d-none');
            }, 5000);
        } else {
            console.log('Sucesso:', message);
            alert(`Sucesso: ${message}`);
        }
    }

    async handleLogin() {
        try {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                this.showError('Email e senha são obrigatórios');
                return;
            }
            
            const response = await fetch(`${this.apiUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro no login');
            }
            
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            window.location.href = '/';
            
        } catch (error) {
            console.error('Erro no login:', error);
            this.showError(error.message || 'Falha na autenticação. Verifique suas credenciais.');
        }
    }
    
    async handleRegister() {
        try {
            const usernameInput = document.getElementById('username');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const confirmPasswordInput = document.getElementById('confirmPassword');
            const nameInput = document.getElementById('name');
            
            // Verificar se todos os elementos necessários existem
            if (!usernameInput || !emailInput || !passwordInput) {
                this.showError('Formulário incompleto ou campos ausentes');
                return;
            }
            
            const username = usernameInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            
            // Para confirmPassword e name, verificar se o elemento existe antes de acessar .value
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : password;
            const name = nameInput && nameInput.value ? nameInput.value : username;
            
            if (!username || !email || !password) {
                this.showError('Todos os campos são obrigatórios');
                return;
            }
            
            if (confirmPasswordInput && password !== confirmPassword) {
                this.showError('As senhas não coincidem');
                return;
            }
            
            const response = await fetch(`${this.apiUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, name })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro no registro');
            }
            
            this.showSuccess('Registro realizado com sucesso! Redirecionando para o login...');
            
            setTimeout(() => {
                window.location.href = '/pages/login.html';
            }, 2000);
            
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showError(error.message || 'Falha no registro. Tente novamente.');
        }
    }
    
    async handleLogout() {
        try {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            
            await fetch(`${this.apiUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            window.location.href = '/pages/login.html';
            
        } catch (error) {
            console.error('Erro no logout:', error);
            window.location.href = '/pages/login.html';
        }
    }

    static setupAuthCheck() {
        setInterval(() => AuthManager.checkAuth(), 5 * 60 * 1000);
        
        if (!window.location.pathname.includes('/pages/login.html') && 
            !window.location.pathname.includes('/pages/register.html')) {
            AuthManager.checkAuth();
        }
    }
}

// Inicializar o AuthManager e definir globalmente
window.AuthManager = AuthManager;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
    AuthManager.setupAuthCheck();
});

// Interceptor para requisições fetch
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const token = localStorage.getItem('auth_token');
    
    if (!args[0].includes('/api/auth/login') && !args[0].includes('/api/auth/register')) {
        if (token) {
            if (!args[1]) args[1] = {};
            if (!args[1].headers) args[1].headers = {};
            args[1].headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return originalFetch.apply(this, args);
};