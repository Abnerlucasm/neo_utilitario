document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    const path = window.location.pathname;

    // 1. Bloqueio imediato se não houver token
    if (!token) {
        window.location.replace('/pages/login.html');
        return;
    }

    try {
        // 2. Validação do Token com o Servidor
        const response = await fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // Se o token é válido, decidimos para onde ir:
            
            // Caso A: Se ele está na raiz ou na própria página de redirect, manda para a Dashboard
            if (path === '/' || path === '/index.html' || path.endsWith('redirect.html')) {
                window.location.replace('/pages/index.html');
            } 
            else {
                /**
                 * Caso B: Ele tentou acessar uma página específica (ex: teste.html).
                 * Como você caiu nesta tela de "Redirecionando", significa que o servidor 
                 * não achou o arquivo teste.html e usou esta página como fallback.
                 * Portanto, se chegamos aqui e NÃO é a index, a página digitada NÃO EXISTE.
                 */
                window.location.replace('/pages/404.html');
            }
        } else {
            throw new Error('Sessão expirada');
        }

    } catch (error) {
        console.error('Erro no fluxo de navegação:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.replace('/pages/login.html');
    }
});