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
                    window.location.href = '/pages/verify-email.html';
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
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.className = 'alert alert-error';
        errorContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>${message}</span>
        `;
    }
}

function showSuccess(message) {
    removeNotifications();
    const successContainer = document.getElementById('successContainer');
    if (successContainer) {
        successContainer.textContent = message;
        successContainer.className = 'alert alert-success';
        successContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>${message}</span>
        `;
    }
}

function removeNotifications() {
    const errorContainer = document.getElementById('errorContainer');
    const successContainer = document.getElementById('successContainer');
    
    if (errorContainer) {
        errorContainer.className = 'hidden';
        errorContainer.textContent = '';
    }
    if (successContainer) {
        successContainer.className = 'hidden';
        successContainer.textContent = '';
    }
} 