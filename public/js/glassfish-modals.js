// Variáveis globais
let currentServiceIndex = null;
let currentMaintenanceIndex = null;
let currentDomainConfigIndex = null;
let logViewerActive = false;
let currentWebSocket = null;

// Função para fechar qualquer modal
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('is-active');
        
        // Se for o modal de logs, parar o live log
        if (modalId === 'log-viewer-modal') {
            stopLiveLog();
        }
        
        // Limpar o índice atual se for o modal de serviço
        if (modalId === 'add-modal') {
            currentServiceIndex = null;
        }
    }
}

// Função para abrir o modal de detalhes do serviço
export async function handleCardClick(index, services) {
    const service = services[index];
    if (!service) return;

    // Preencher o formulário com os dados do serviço
    const form = document.getElementById('service-form');
    if (!form) return;

    const nameInput = form.querySelector('#service-name');
    const hostInput = form.querySelector('#service-host');
    const portInput = form.querySelector('#service-port');
    const domainInput = form.querySelector('#service-domain');
    const usernameInput = form.querySelector('#service-username');
    const passwordInput = form.querySelector('#service-password');
    const setorInput = form.querySelector('#service-setor');

    if (nameInput) nameInput.value = service.name;
    if (hostInput) hostInput.value = service.host;
    if (portInput) portInput.value = service.port;
    if (domainInput) domainInput.value = service.domain;
    if (usernameInput) usernameInput.value = service.username;
    if (passwordInput) passwordInput.value = service.password;
    if (setorInput) setorInput.value = service.setor;

    // Armazenar o índice do serviço sendo editado
    currentServiceIndex = index;

    // Abrir o modal
    const modal = document.getElementById('add-modal');
    if (modal) {
        modal.classList.add('is-active');
    }
}

// Função para alternar a visualização de logs
export function toggleLogViewer() {
    const logsContent = document.getElementById('logs-content');
    logViewerActive = !logViewerActive;
    
    if (logViewerActive) {
        logsContent.classList.add('is-active');
        startLiveLog();
    } else {
        logsContent.classList.remove('is-active');
        stopLiveLog();
    }
}

// Função para abrir o modal de nome do usuário
export function openUserNameModal(index) {
    currentServiceIndex = index;
    document.getElementById('userNameModal').classList.add('is-active');
}

// Função para salvar o nome do usuário
export async function saveUserName(services, fetchServices) {
    try {
        const currentUser = AuthManager.getCurrentUser();
        if (!currentUser) {
            showToast('Usuário não está logado', 'danger');
            return;
        }

        const service = services[currentServiceIndex];
        if (!service || !service._id) {
            showToast('Serviço não encontrado', 'danger');
            return;
        }

        const response = await fetch(`/api/glassfish/servicos/${service._id}/in-use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ user: currentUser.username })
        });

        if (!response.ok) {
            throw new Error('Erro ao marcar serviço como em uso');
        }

        showToast('Serviço marcado como em uso', 'success');
        closeModal('userNameModal');
        await fetchServices();
    } catch (error) {
        console.error('Erro ao marcar serviço como em uso:', error);
        showToast(error.message, 'danger');
    }
}

// Função para marcar serviço como disponível
export async function markServiceAvailable(index, services, fetchServices) {
    try {
        const service = services[index];
        if (!service || !service._id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const response = await fetch(`/api/glassfish/servicos/${service._id}/disponivel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao marcar serviço como disponível');
        }

        showToast('Serviço marcado como disponível com sucesso!', 'success');
        await fetchServices();
    } catch (error) {
        console.error('Erro ao marcar serviço como disponível:', error);
        showToast(error.message, 'danger');
    }
}

// Função para visualizar logs
export async function viewLogs(index, services) {
    try {
        const service = services[index];
        if (!service || !service.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const response = await fetch(`/api/glassfish/servicos/${service.id}/logs`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao obter logs');
        }

        const data = await response.json();
        const logsContent = document.getElementById('logs-content');
        if (logsContent) {
            logsContent.textContent = data.logs;
        }

        const logsModal = document.getElementById('logs-modal');
        if (logsModal) {
            logsModal.classList.add('is-active');
        }
    } catch (error) {
        console.error('Erro ao obter logs:', error);
        showToast('Erro ao obter logs', 'error');
    }
}

// Função para iniciar live log
function startLiveLog(services) {
    if (currentWebSocket) {
        currentWebSocket.close();
    }

    const service = services[currentServiceIndex];
    if (!service || !service._id) {
        showToast('Serviço não encontrado', 'error');
        return;
    }

    currentWebSocket = new WebSocket(`ws://${window.location.host}/api/glassfish/servicos/${service._id}/logs/live`);
    
    currentWebSocket.onmessage = (event) => {
        const logsContent = document.getElementById('logs-content');
        logsContent.textContent += event.data + '\n';
        logsContent.scrollTop = logsContent.scrollHeight;
    };

    currentWebSocket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        showToast('Erro na conexão com o servidor de logs', 'danger');
    };

    currentWebSocket.onclose = () => {
        if (logViewerActive) {
            setTimeout(() => startLiveLog(services), 5000);
        }
    };
}

// Função para parar live log
function stopLiveLog() {
    if (currentWebSocket) {
        currentWebSocket.close();
        currentWebSocket = null;
    }
}

// Função para executar manutenção
export async function executeMaintenance(services, fetchServices) {
    try {
        const service = services[currentMaintenanceIndex];
        if (!service || !service._id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const options = {
            cleanApplications: document.getElementById('clean-applications').checked,
            cleanLogs: document.getElementById('clean-logs').checked,
            cleanGenerated: document.getElementById('clean-generated').checked,
            cleanAutodeploy: document.getElementById('clean-autodeploy').checked
        };

        const response = await fetch(`/api/glassfish/servicos/${service._id}/manutencao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(options)
        });

        if (!response.ok) {
            throw new Error('Erro ao executar manutenção');
        }

        showToast('Manutenção executada com sucesso!', 'success');
        closeModal('maintenance-modal');
        await fetchServices();
    } catch (error) {
        console.error('Erro ao executar manutenção:', error);
        showToast(error.message, 'danger');
    }
}

// Função para abrir modal de manutenção
export function openMaintenanceModal(index) {
    currentMaintenanceIndex = index;
    document.getElementById('maintenance-modal').classList.add('is-active');
}

// Função para abrir modal de configuração do domínio
export async function openDomainConfigModal(index, services) {
    try {
        const service = services[index];
        if (!service || !service.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        currentDomainConfigIndex = index;

        const response = await fetch(`/api/glassfish/servicos/${service.id}/domain-config`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao obter configurações do domínio');
        }

        const config = await response.json();

        const dbServer = document.getElementById('db-server');
        const dbUser = document.getElementById('db-user');
        const dbPassword = document.getElementById('db-password');
        const dbName = document.getElementById('db-name');

        if (dbServer) dbServer.value = config.serverName || '';
        if (dbUser) dbUser.value = config.user || '';
        if (dbPassword) dbPassword.value = config.password || '';
        if (dbName) dbName.value = config.databaseName || '';

        const modal = document.getElementById('domain-config-modal');
        if (modal) {
            modal.classList.add('is-active');
        }

        await loadApplications(service.id);
    } catch (error) {
        console.error('Erro ao abrir modal de configuração:', error);
        showToast('Erro ao abrir configurações do domínio', 'error');
    }
}

// Função para carregar aplicações
async function loadApplications(serviceId) {
    try {
        const response = await fetch(`/api/glassfish/servicos/${serviceId}/applications`);
        if (!response.ok) {
            throw new Error('Erro ao obter lista de aplicações');
        }

        const applications = await response.json();
        const applicationsContent = document.getElementById('applications-content');
        
        if (applications.length === 0) {
            applicationsContent.innerHTML = '<p class="has-text-centered">Nenhuma aplicação instalada</p>';
        } else {
            applicationsContent.innerHTML = applications.map(app => `
                <div class="application-item">
                    <span class="icon"><i class="fas fa-cube"></i></span>
                    <span class="name">${app.name}</span>
                    <span class="status ${app.status}">${app.status}</span>
                </div>
            `).join('');
        }

        document.getElementById('applications-loading').classList.add('is-hidden');
        applicationsContent.classList.remove('is-hidden');
    } catch (error) {
        console.error('Erro ao carregar aplicações:', error);
        showToast(error.message, 'danger');
    }
}

// Função para salvar configurações do domínio
export async function saveDomainConfig(services) {
    try {
        const service = services[currentDomainConfigIndex];
        if (!service || !service._id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const config = {
            server: document.getElementById('db-server').value,
            user: document.getElementById('db-user').value,
            password: document.getElementById('db-password').value,
            database: document.getElementById('db-name').value
        };

        const response = await fetch(`/api/glassfish/servicos/${service._id}/domain-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar configurações do domínio');
        }

        showToast('Configurações salvas com sucesso!', 'success');
        closeModal('domain-config-modal');
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showToast(error.message, 'danger');
    }
}

// Função para fazer upload de aplicação
export async function uploadApplication(services) {
    const fileInput = document.getElementById('application-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Por favor, selecione um arquivo', 'warning');
        return;
    }

    try {
        const service = services[currentDomainConfigIndex];
        if (!service || !service._id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/glassfish/servicos/${service._id}/applications/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro ao fazer upload da aplicação');
        }

        showToast('Aplicação enviada com sucesso!', 'success');
        fileInput.value = '';
        document.getElementById('file-name').textContent = 'Nenhum arquivo selecionado';
        document.getElementById('upload-button').disabled = true;
        
        // Recarregar lista de aplicações
        await loadApplications(service._id);
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        showToast(error.message, 'danger');
    }
}

// Função auxiliar para mostrar toast
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification is-${type} toast`;
    toast.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
} 