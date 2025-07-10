document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verifyForm');
    const resendLink = document.getElementById('resendCode');
    const codeInputs = document.querySelectorAll('.code-input');
    const fullCodeInput = document.getElementById('fullCode');
    
    // Configurar os inputs de código
    setupCodeInputs();
    
    // Verificar se há parâmetros na URL (para quando o usuário clica no link no email)
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    const emailFromUrl = urlParams.get('email');
    
    // Obter o email do localStorage ou da URL
    let email = localStorage.getItem('verificationEmail');
    
    // Se o email veio da URL, use-o e guarde-o no localStorage
    if (emailFromUrl) {
        email = emailFromUrl;
        localStorage.setItem('verificationEmail', email);
    }
    
    // Mostrar o email na página, se estiver disponível
    const emailDisplay = document.getElementById('userEmail');
    if (emailDisplay && email) {
        emailDisplay.textContent = email;
    }
    
    // Se temos o código da URL, preenchê-lo nos inputs
    if (codeFromUrl && codeFromUrl.length === 6) {
        Array.from(codeFromUrl).forEach((char, index) => {
            if (index < codeInputs.length) {
                codeInputs[index].value = char;
                codeInputs[index].classList.add('filled');
            }
        });
        
        // Se temos o código e o email, verificar automaticamente
        if (email) {
            setTimeout(() => {
                if (form) form.dispatchEvent(new Event('submit'));
            }, 500);
        }
    }
    
    if (!email) {
        showWarning('Email não encontrado. Por favor, registre-se novamente ou faça login.');
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!email) {
                showError('Email não encontrado. Por favor, registre-se novamente.');
                return;
            }
            
            // Combinar o código dos inputs separados
            const code = Array.from(codeInputs).map(input => input.value).join('');
            fullCodeInput.value = code;
            
            if (code.length !== 6) {
                showError('Por favor, preencha todos os dígitos do código.');
                return;
            }

            try {
                showInfo('Verificando código...');
                
                const response = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, code })
                });

                const result = await response.json();

                if (response.ok) {
                    showSuccess('Email verificado com sucesso! Redirecionando...');
                    
                    // Limpar o email do localStorage, não é mais necessário
                    localStorage.removeItem('verificationEmail');
                    
                    setTimeout(() => {
                        window.location.href = '/pages/login.html';
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
            
            if (!email) {
                showError('Email não encontrado. Por favor, registre-se novamente.');
                return;
            }
            
            try {
                showInfo('Enviando novo código...');
                
                const response = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();

                if (response.ok) {
                    showSuccess('Novo código enviado! Verifique seu email.');
                    
                    // Limpar os inputs de código para o novo código
                    codeInputs.forEach(input => input.value = '');
                    codeInputs[0].focus();
                } else {
                    throw new Error(result.error || 'Erro ao reenviar código');
                }
            } catch (error) {
                showError(error.message);
            }
        });
    }
    
    function setupCodeInputs() {
        codeInputs.forEach((input, index) => {
            // Ao digitar, avançar para o próximo input automaticamente
            input.addEventListener('input', (e) => {
                // Garantir que apenas letras e números sejam digitados
                const validInput = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
                e.target.value = validInput;
                
                if (validInput) {
                    input.classList.add('filled');
                    
                    // Move para o próximo input se houver input disponível
                    if (index < codeInputs.length - 1) {
                        codeInputs[index + 1].focus();
                    }
                } else {
                    input.classList.remove('filled');
                }
            });
            
            // Permitir navegação com teclado entre os inputs
            input.addEventListener('keydown', (e) => {
                // Se pressionar Backspace em um input vazio, voltar para o anterior
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    codeInputs[index - 1].focus();
                    codeInputs[index - 1].value = '';
                    codeInputs[index - 1].classList.remove('filled');
                    e.preventDefault();
                }
                
                // Se pressionar a seta esquerda, mover para o input anterior
                if (e.key === 'ArrowLeft' && index > 0) {
                    codeInputs[index - 1].focus();
                    e.preventDefault();
                }
                
                // Se pressionar a seta direita, mover para o próximo input
                if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                    e.preventDefault();
                }
            });
            
            // Quando o input receber foco, selecionar todo o texto
            input.addEventListener('focus', () => {
                input.select();
            });
        });
        
        // Permitir colar o código completo no primeiro input
        codeInputs[0].addEventListener('paste', (e) => {
            e.preventDefault();
            
            // Obter o texto colado
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            
            // Verificar se o texto colado tem o tamanho esperado
            if (pastedText.length <= codeInputs.length) {
                // Distribuir os caracteres pelos inputs
                Array.from(pastedText).forEach((char, index) => {
                    if (index < codeInputs.length) {
                        codeInputs[index].value = char;
                        codeInputs[index].classList.add('filled');
                    }
                });
                
                // Mover o foco para o próximo input vazio ou para o último
                const nextEmptyIndex = Array.from(codeInputs).findIndex(input => !input.value);
                if (nextEmptyIndex !== -1) {
                    codeInputs[nextEmptyIndex].focus();
                } else {
                    codeInputs[codeInputs.length - 1].focus();
                }
            }
        });
    }
});

function showInfo(message) {
    removeNotifications();
    // Criar notificação inline para info
    const notification = document.createElement('div');
    notification.className = 'alert alert-info mb-4';
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>${message}</span>
    `;
    
    const form = document.getElementById('verifyForm');
    if (form && form.parentNode) {
        form.parentNode.insertBefore(notification, form);
    }
}

function showWarning(message) {
    removeNotifications();
    // Criar notificação inline para warning
    const notification = document.createElement('div');
    notification.className = 'alert alert-warning mb-4';
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        <span>${message}</span>
    `;
    
    const form = document.getElementById('verifyForm');
    if (form && form.parentNode) {
        form.parentNode.insertBefore(notification, form);
    }
}

function showError(message) {
    removeNotifications();
    // Criar notificação inline para erro
    const notification = document.createElement('div');
    notification.className = 'alert alert-error mb-4';
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>${message}</span>
    `;
    
    const form = document.getElementById('verifyForm');
    if (form && form.parentNode) {
        form.parentNode.insertBefore(notification, form);
    }
}

function showSuccess(message) {
    removeNotifications();
    // Criar notificação inline para sucesso
    const notification = document.createElement('div');
    notification.className = 'alert alert-success mb-4';
    notification.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>${message}</span>
    `;
    
    const form = document.getElementById('verifyForm');
    if (form && form.parentNode) {
        form.parentNode.insertBefore(notification, form);
    }
}

function removeNotifications() {
    const notifications = document.querySelectorAll('.alert');
    notifications.forEach(notification => notification.remove());
} 