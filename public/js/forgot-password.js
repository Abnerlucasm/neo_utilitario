document.addEventListener('DOMContentLoaded', () => {
    // Elementos dos passos
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    
    // Elementos dos indicadores de passos
    const step1Item = document.getElementById('step1Item');
    const step2Item = document.getElementById('step2Item');
    const step3Item = document.getElementById('step3Item');
    
    // Formulários
    const requestCodeForm = document.getElementById('requestCodeForm');
    const verifyCodeForm = document.getElementById('verifyCodeForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    // Outros elementos importantes
    const emailInput = document.getElementById('email');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const resendCodeBtn = document.getElementById('resendCode');
    const codeInputs = document.querySelectorAll('.code-input');
    const fullCodeInput = document.getElementById('fullCode');
    
    // Estado da aplicação
    let currentEmail = '';
    let resetToken = '';
    
    // Configurar inputs de código (similar à página de verificação de email)
    setupCodeInputs();
    
    // ===== PASSO 1: SOLICITAR CÓDIGO =====
    requestCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        
        if (!email) {
            showError('Por favor, informe seu email', 1);
            return;
        }
        
        try {
            showInfo('Enviando código de recuperação...', 1);
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Armazenar email para uso nos próximos passos
                currentEmail = email;
                
                // Exibir o email na próxima etapa
                userEmailDisplay.textContent = email;
                
                // Avançar para o passo 2
                showSuccess('Código enviado com sucesso! Verifique seu email.', 1);
                setTimeout(() => {
                    goToStep(2);
                }, 1500);
            } else {
                throw new Error(data.error || 'Erro ao enviar código de recuperação');
            }
        } catch (error) {
            showError(error.message, 1);
        }
    });
    
    // ===== PASSO 2: VERIFICAR CÓDIGO =====
    verifyCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Combinar os dígitos do código
        const code = Array.from(codeInputs).map(input => input.value).join('');
        fullCodeInput.value = code;
        
        if (code.length !== 6) {
            showError('Por favor, digite o código completo', 2);
            return;
        }
        
        try {
            showInfo('Verificando código...', 2);
            
            const response = await fetch('/api/auth/verify-reset-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: currentEmail,
                    code: code
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Guardar o token para redefinição de senha
                resetToken = data.token;
                
                // Avançar para o passo 3
                showSuccess('Código verificado com sucesso!', 2);
                setTimeout(() => {
                    goToStep(3);
                }, 1500);
            } else {
                throw new Error(data.error || 'Código inválido');
            }
        } catch (error) {
            showError(error.message, 2);
        }
    });
    
    // ===== PASSO 3: REDEFINIR SENHA =====
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validações básicas
        if (newPassword.length < 6) {
            showError('A senha deve ter pelo menos 6 caracteres', 3);
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showError('As senhas não coincidem', 3);
            return;
        }
        
        try {
            showInfo('Atualizando sua senha...', 3);
            
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: resetToken,
                    password: newPassword
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccess('Senha atualizada com sucesso! Redirecionando para a página de login...', 3);
                setTimeout(() => {
                    window.location.href = '/pages/login.html?reset=success';
                }, 2000);
            } else {
                throw new Error(data.error || 'Erro ao redefinir senha');
            }
        } catch (error) {
            showError(error.message, 3);
        }
    });
    
    // Reenviar código
    resendCodeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!currentEmail) {
            showError('Email não identificado. Por favor, volte à etapa anterior.', 2);
            return;
        }
        
        try {
            showInfo('Reenviando código...', 2);
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: currentEmail })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Limpar inputs de código
                codeInputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('filled');
                });
                
                // Focar no primeiro input
                codeInputs[0].focus();
                
                showSuccess('Novo código enviado! Verifique seu email.', 2);
            } else {
                throw new Error(data.error || 'Erro ao reenviar código');
            }
        } catch (error) {
            showError(error.message, 2);
        }
    });
    
    // ===== FUNÇÕES AUXILIARES =====
    
    // Configurar inputs de código
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
    
    // Navegar entre passos
    function goToStep(stepNumber) {
        // Esconder todos os passos
        [step1, step2, step3].forEach(step => step.classList.add('d-none'));
        
        // Remover classes ativas e concluídas de todos os indicadores
        [step1Item, step2Item, step3Item].forEach(item => {
            item.classList.remove('is-active', 'is-completed');
        });
        
        // Atualizar UI com base no passo atual
        if (stepNumber === 1) {
            step1.classList.remove('d-none');
            step1Item.classList.add('is-active');
        } else if (stepNumber === 2) {
            step2.classList.remove('d-none');
            step1Item.classList.add('is-completed');
            step2Item.classList.add('is-active');
        } else if (stepNumber === 3) {
            step3.classList.remove('d-none');
            step1Item.classList.add('is-completed');
            step2Item.classList.add('is-completed');
            step3Item.classList.add('is-active');
        }
        
        // Limpar todas as notificações ao mudar de passo
        clearNotifications();
    }
    
    // Funções para mostrar mensagens
    function showError(message, step) {
        clearNotifications(step);
        const container = document.getElementById(`errorContainer${step}`);
        if (container) {
            container.className = 'alert alert-error';
            container.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>${message}</span>
            `;
        }
    }
    
    function showSuccess(message, step) {
        clearNotifications(step);
        const container = document.getElementById(`successContainer${step}`);
        if (container) {
            container.className = 'alert alert-success';
            container.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>${message}</span>
            `;
        }
    }
    
    function showInfo(message, step) {
        clearNotifications(step);
        // Criar notificação de informação se não existir
        let container = document.getElementById(`infoContainer${step}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `infoContainer${step}`;
            container.className = 'alert alert-info';
            
            // Inserir antes do primeiro campo em cada formulário
            const targetForm = document.getElementById(`step${step}`).querySelector('form');
            if (targetForm) {
                targetForm.insertBefore(container, targetForm.firstChild);
            }
        }
        
        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${message}</span>
        `;
    }
    
    function clearNotifications(step) {
        if (step) {
            // Limpar apenas as notificações do passo específico
            const errorContainer = document.getElementById(`errorContainer${step}`);
            const successContainer = document.getElementById(`successContainer${step}`);
            const infoContainer = document.getElementById(`infoContainer${step}`);
            
            if (errorContainer) {
                errorContainer.className = 'hidden';
                errorContainer.innerHTML = '';
            }
            if (successContainer) {
                successContainer.className = 'hidden';
                successContainer.innerHTML = '';
            }
            if (infoContainer) {
                infoContainer.className = 'hidden';
                infoContainer.innerHTML = '';
            }
        } else {
            // Limpar todas as notificações
            document.querySelectorAll('.alert').forEach(notification => {
                notification.className = 'hidden';
                notification.innerHTML = '';
            });
        }
    }
}); 