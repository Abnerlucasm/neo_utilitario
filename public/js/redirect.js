document.addEventListener('DOMContentLoaded', async () => {
    // Se estiver na raiz do site
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const token = localStorage.getItem('auth_token');
        
        try {
            if (token) {
                // Verificar se o token é válido
                const response = await fetch('/api/auth/check', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // Token válido, redirecionar para index.html
                    window.location.replace('/pages/index.html');
                } else {
                    // Token inválido, limpar e redirecionar para login
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_data');
                    window.location.replace('/pages/login.html');
                }
            } else {
                // Sem token, redirecionar para login
                window.location.replace('/pages/login.html');
            }
        } catch (error) {
            console.error('Erro na verificação de autenticação:', error);
            // Em caso de erro, redirecionar para login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.replace('/pages/login.html');
        }
    }
}); 