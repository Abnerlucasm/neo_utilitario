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
                    !window.location.pathname.includes('/pages/register.html') &&
                    !window.location.pathname.includes('/pages/verify-email.html') &&
                    !window.location.pathname.includes('/pages/forgot-password.html')) {
                    window.location.href = '/pages/login.html';
                }
                return null;
            }

            console.log('Token encontrado, verificando autenticação...');
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
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
                localStorage.removeItem('user');
                console.log('Token removido do localStorage');
                
                if (!window.location.pathname.includes('/pages/login.html')) {
                    window.location.href = '/pages/login.html';
                }
                
                return null;
            }

            const data = await response.json();
            console.log('Dados do usuário recebidos:', data);
            
            // Atualizar informações do usuário na navbar usando um evento customizado
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
            localStorage.removeItem('user');
            console.log('Token removido após erro');
            
            if (!window.location.pathname.includes('/pages/login.html')) {
                window.location.href = '/pages/login.html';
            }
            
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
            
            console.log(`Tentando login com email: ${email} e senha fornecida de tamanho ${password ? password.length : 0}`);
            
            if (!email || !password) {
                this.showError('Email e senha são obrigatórios');
                return;
            }
            
            console.log('Enviando requisição para /api/auth/login...');
            const response = await fetch(`${this.apiUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include' // Para permitir que o servidor defina cookies
            });
            
            console.log(`Resposta recebida: status ${response.status}`);
            
            let data;
            try {
                data = await response.json();
                console.log('Dados recebidos:', data);
            } catch (parseError) {
                console.error('Erro ao processar resposta JSON:', parseError);
                throw new Error('Erro ao processar resposta do servidor');
            }
            
            if (!response.ok) {
                console.error('Resposta de erro:', data);
                
                // Verificar se o erro é de email não verificado
                if (response.status === 403 && data.need_verification && data.email) {
                    // Armazenar o email para a página de verificação
                    localStorage.setItem('verificationEmail', data.email);
                    
                    this.showError('Email não verificado. Redirecionando para a página de verificação...');
                    
                    setTimeout(() => {
                        window.location.href = '/pages/verify-email.html';
                    }, 2000);
                    
                    return;
                }
                
                throw new Error(data.error || data.message || 'Erro no login');
            }
            
            console.log('Login bem-sucedido, salvando token...');
            // Armazenar o token no localStorage
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                
                // Se houver dados do usuário, armazená-los também
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
                
                console.log('Token e dados do usuário salvos no localStorage');
            } else {
                console.error('Token não recebido na resposta de login');
                throw new Error('Token de autenticação não recebido');
            }
            
            console.log('Redirecionando para home...');
            window.location.href = '/';
            
        } catch (error) {
            console.error('Erro completo no login:', error);
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
            
            // Mostrar indicador de carregamento
            this.showSuccess('Processando registro, aguarde...');
            
            // Armazenar os dados do usuário antes de enviar, para caso seja necessário tentar o login
            const userData = { username, email, password, name };
            
            let response;
            try {
                response = await fetch(`${this.apiUrl}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });
            } catch (fetchError) {
                console.error('Erro na requisição fetch:', fetchError);
                // Tentando registro, mas houve erro de rede
                this.showError('Erro de conexão com o servidor. Redirecionando para o login...');
                // Redirecionar para login após pequeno atraso
                setTimeout(() => {
                    window.location.href = '/pages/login.html';
                }, 3000);
                return;
            }
            
            let data;
            try {
                data = await response.json();
                console.log('Resposta do servidor:', data);
            } catch (e) {
                console.error('Erro ao processar resposta JSON:', e);
                data = { error: 'Erro ao processar resposta do servidor' };
            }
            
            if (!response.ok) {
                // Erros 400 são validações e não devem redirecionar
                if (response.status === 400) {
                    const errorMsg = data.error || data.details || 'Erro de validação no registro';
                    throw new Error(errorMsg);
                }
                
                // Erros 500 podem significar que o usuário foi criado mas houve algum erro posterior
                if (response.status === 500) {
                    this.showError(`${data.error || 'Erro interno do servidor'}. Redirecionando para login...`);
                    
                    // Redirecionar para login após pequeno atraso
                    setTimeout(() => {
                        window.location.href = '/pages/login.html';
                    }, 3000);
                    return;
                }
                
                const errorMsg = data.error || data.details || 'Erro no registro';
                throw new Error(errorMsg);
            }
            
            // Armazenar o email para ser usado na página de verificação
            localStorage.setItem('verificationEmail', email);
            
            this.showSuccess('Registro realizado com sucesso! Redirecionando para verificação de email...');
            
            setTimeout(() => {
                window.location.href = '/pages/verify-email.html';
            }, 2000);
            
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showError(error.message || 'Falha no registro. Tente novamente.');
            
            // Mesmo com erro, redirecionar para login após 5 segundos se o erro não for de validação
            if (!error.message.includes('já existe') && 
                !error.message.includes('obrigatórios') && 
                !error.message.includes('não coincidem')) {
                setTimeout(() => {
                    console.log('Redirecionando para login após erro não relacionado à validação');
                    window.location.href = '/pages/login.html';
                }, 5000);
            }
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

    /**
     * Configura a interceptação de todas as requisições fetch para adicionar token de autenticação
     * quando disponível
     */
    static setupAuthHeaders() {
        console.log('Configurando interceptação de requisições para adicionar token de autenticação');
        
        // Guarda a referência original do método fetch
        const originalFetch = window.fetch;
        
        // Sobreescreve o método fetch
        window.fetch = async function(url, options = {}) {
            // Obtém o token do localStorage
            const token = localStorage.getItem('auth_token');
            
            if (token) {
                // Cria ou atualiza as headers com o token de autenticação
                options.headers = options.headers || {};
                
                // Se já for um objeto Headers, cria uma cópia
                if (options.headers instanceof Headers) {
                    const originalHeaders = options.headers;
                    options.headers = {};
                    
                    // Converter do objeto Headers para um objeto simples
                    for (const [key, value] of originalHeaders.entries()) {
                        options.headers[key] = value;
                    }
                }
                
                if (typeof options.headers === 'object') {
                    // Certifica-se de que o token não seja sobrescrito se já estiver nas opções
                    if (!options.headers.Authorization) {
                        options.headers.Authorization = `Bearer ${token}`;
                    }
                }
            }
            
            // Chama o método fetch original com as opções atualizadas
            return originalFetch.call(this, url, options);
        };
        
        console.log('Interceptação de requisições configurada');
    }
}

// Inicializar o AuthManager e definir globalmente
window.AuthManager = AuthManager;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Configurar interceptação de requisições
    AuthManager.setupAuthHeaders();
    
    // Inicializar o gerenciador de autenticação
    const authManager = new AuthManager();
    
    // Verificar autenticação se não estiver na página de login ou registro
    if (!window.location.pathname.includes('/pages/login.html') && 
        !window.location.pathname.includes('/pages/register.html') &&
        !window.location.pathname.includes('/pages/verify-email.html') &&
        !window.location.pathname.includes('/pages/forgot-password.html')) {
        AuthManager.checkAuth();
    }
    
    // Verificar parâmetros na URL para mensagens após verificação de email
    const urlParams = new URLSearchParams(window.location.search);
    
    // Verificar se a verificação de email foi bem-sucedida
    if (urlParams.get('verified') === 'true') {
        authManager.showSuccess('Email verificado com sucesso! Você já pode fazer login.');
        
        // Limpar parâmetros da URL sem recarregar a página
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Verificar se houve erro na verificação
    if (urlParams.get('error') === 'verification_failed') {
        authManager.showError('Houve um problema na verificação do email. Tente novamente.');
        
        // Limpar parâmetros da URL sem recarregar a página
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});