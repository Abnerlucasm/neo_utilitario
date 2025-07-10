class LoginManager {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.passwordInput = document.getElementById('password');
        this.togglePassword = document.getElementById('togglePassword');
        
        if (!this.form) {
            console.error('Formulário de login não encontrado');
            return;
        }
        
        this.setupEventListeners();
        this.setupPasswordToggle();
    }

    setupPasswordToggle() {
        if (this.togglePassword && this.passwordInput) {
            this.togglePassword.addEventListener('click', () => {
                // Alternar tipo do input
                const type = this.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                this.passwordInput.setAttribute('type', type);
                
                // Alternar ícone
                const icon = this.togglePassword.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        }
    }

    setupEventListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                email: formData.get('email'),
                password: formData.get('password')
            };

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data),
                    credentials: 'include'
                });

                const result = await response.json();

                if (response.ok) {
                    if (result.token) {
                        localStorage.setItem('auth_token', result.token);
                        this.showSuccess('Login realizado com sucesso!');
                        setTimeout(() => {
                            window.location.replace('/');
                        }, 500);
                    }
                } else {
                    throw new Error(result.error || 'Falha no login');
                }
            } catch (error) {
                console.error('Erro no login:', error);
                this.showError(error.message);
            }
        });
    }

    showError(message) {
        this.removeNotifications();
        const notification = document.createElement('div');
        notification.className = 'alert alert-error mb-4';
        notification.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>${message}</span>
        `;
        this.form.parentNode.insertBefore(notification, this.form);
    }

    showSuccess(message) {
        this.removeNotifications();
        const notification = document.createElement('div');
        notification.className = 'alert alert-success mb-4';
        notification.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>${message}</span>
        `;
        this.form.parentNode.insertBefore(notification, this.form);
    }

    removeNotifications() {
        const notifications = this.form.parentNode.querySelectorAll('.alert');
        notifications.forEach(notification => notification.remove());
    }
}

// Inicializar o gerenciador de login quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Toggle olho da senha
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePassword.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    // Inicializar o gerenciador de login
    if (typeof LoginManager === 'function') {
        new LoginManager();
    }
}); 