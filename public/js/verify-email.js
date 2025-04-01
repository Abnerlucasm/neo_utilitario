document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verifyForm');
    const resendLink = document.getElementById('resendCode');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const code = formData.get('code');

            try {
                const response = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code })
                });

                const result = await response.json();

                if (response.ok) {
                    showSuccess('Email verificado com sucesso! Redirecionando...');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Código inválido');
                }
            } catch (error) {
                showError(error.message);
            }
        });
    }

    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                const response = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                if (response.ok) {
                    showSuccess('Novo código enviado! Verifique seu email.');
                } else {
                    throw new Error(result.error || 'Erro ao reenviar código');
                }
            } catch (error) {
                showError(error.message);
            }
        });
    }
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