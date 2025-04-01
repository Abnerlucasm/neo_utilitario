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
        notification.className = 'notification is-danger';
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;
        this.form.parentNode.insertBefore(notification, this.form);
        this.setupNotificationClose(notification);
    }

    showSuccess(message) {
        this.removeNotifications();
        const notification = document.createElement('div');
        notification.className = 'notification is-success';
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;
        this.form.parentNode.insertBefore(notification, this.form);
        this.setupNotificationClose(notification);
    }

    removeNotifications() {
        const notifications = this.form.parentNode.querySelectorAll('.notification');
        notifications.forEach(notification => notification.remove());
    }

    setupNotificationClose(notification) {
        const deleteButton = notification.querySelector('.delete');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                notification.remove();
            });
        }
    }
}

// Inicializar o gerenciador de login quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
}); 