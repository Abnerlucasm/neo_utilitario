document.addEventListener('DOMContentLoaded', () => {
    console.log('Script de registro carregado');

    const form = document.getElementById('registerForm');
    
    if (!form) {
        console.error('Formulário não encontrado');
        return;
    }

    // Validar senha antes de enviar
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const password = formData.get('password');
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Verificar se as senhas coincidem
        if (password !== confirmPassword) {
            showError('As senhas não coincidem');
            return;
        }

        const data = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: password
        };

        // Validar campos obrigatórios
        if (!data.username || !data.email || !data.password) {
            showError('Todos os campos são obrigatórios');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showSuccess('Registro realizado! Verifique seu email para confirmar a conta.');
                setTimeout(() => {
                    window.location.href = '/verify-email.html';
                }, 2000);
            } else {
                throw new Error(result.error || result.details || 'Erro no registro');
            }
        } catch (error) {
            showError(error.message);
        }
    });
});

function showError(message) {
    removeNotifications();
    const notification = document.createElement('div');
    notification.className = 'notification is-danger';
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    document.querySelector('.box').insertBefore(notification, document.querySelector('form'));
    setupNotificationClose(notification);
}

function showSuccess(message) {
    removeNotifications();
    const notification = document.createElement('div');
    notification.className = 'notification is-success';
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    document.querySelector('.box').insertBefore(notification, document.querySelector('form'));
    setupNotificationClose(notification);
}

function removeNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => notification.remove());
}

function setupNotificationClose(notification) {
    const deleteButton = notification.querySelector('.delete');
    deleteButton.addEventListener('click', () => {
        notification.remove();
    });
} 