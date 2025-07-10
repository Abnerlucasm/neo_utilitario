import {
    closeModal,
    handleCardClick,
    toggleLogViewer,
    openUserNameModal,
    saveUserName,
    markServiceAvailable,
    viewLogs,
    executeMaintenance,
    openMaintenanceModal,
    openDomainConfigModal,
    saveDomainConfig,
    uploadApplication,
    showToast
} from './glassfish-modals.js';

        // Registrar o Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('ServiceWorker registrado com sucesso:', registration.scope);
                    })
                    .catch((error) => {
                        console.log('Falha ao registrar o ServiceWorker:', error);
                    });
            });
        }

        const cardsContainer = document.getElementById('cards-container');
        const emptyMessage = document.getElementById('empty-message');
        const resultsCount = document.getElementById('results-count');
        const modalTitle = document.getElementById('modal-title');
        let editingIndex = null;
let currentServiceIndex = null;
        let services = [];
        let currentWebSocket = null;
        let currentServiceId = null;
        let statusCheckInterval = null;
        let currentMaintenanceIndex = null;
        let currentDomainConfigIndex = null;
        let logViewerActive = false;

// Função para atualizar a lista de serviços
function updateServicesList(servicesData) {
    services = servicesData;
    renderCards(services);
}

        // Função para obter os dados do MongoDB
        async function fetchServices() {
            try {
                const response = await fetch('/api/glassfish/servicos', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Erro ao obter serviços');
                }

        const servicesData = await response.json();
        updateServicesList(servicesData);
        
        // Atualizar contagem de resultados
        if (resultsCount) {
            resultsCount.textContent = `${servicesData.length} serviço(s) encontrado(s)`;
        }
        
        // Mostrar/esconder mensagem de vazio
        if (emptyMessage) {
            emptyMessage.style.display = servicesData.length === 0 ? 'block' : 'none';
        }
            } catch (error) {
                console.error('Erro ao carregar serviços:', error);
                showToast('Erro ao carregar serviços', 'danger');
            }
        }

        // Função para verificar o status de todos os serviços
        async function checkAllServicesStatus() {
            for (let service of services) {
                try {
                    await checkServiceStatus(service);
                } catch (error) {
                    console.error(`Erro ao verificar status do serviço ${service.name}:`, error);
                }
            }
        }

        function openAddModal(editIndex = null) {
    const modal = document.getElementById('add-modal');
    if (!modal) return;

    // Limpar o formulário
    const form = document.getElementById('service-form');
    if (form) {
        form.reset();
    }

    // Se estiver editando, preencher com os dados do serviço
    if (editIndex !== null && services[editIndex]) {
        const service = services[editIndex];
        const nameInput = document.getElementById('service-name');
        const ipInput = document.getElementById('service-ip');
        const portInput = document.getElementById('service-port');
        const domainInput = document.getElementById('service-domain');
        const sshUsernameInput = document.getElementById('service-ssh-username');
        const sshPasswordInput = document.getElementById('service-ssh-password');
        const installPathInput = document.getElementById('service-install-path');
        const productionPortInput = document.getElementById('production-port');
        const categoryInput = document.getElementById('service-category');
        const accessTypeInput = document.getElementById('service-access-type');

        if (nameInput) nameInput.value = service.name;
        if (ipInput) ipInput.value = service.ip;
        if (portInput) portInput.value = service.port;
        if (domainInput) domainInput.value = service.domain;
        if (sshUsernameInput) sshUsernameInput.value = service.sshUsername;
        if (sshPasswordInput) sshPasswordInput.value = service.sshPassword;
        if (installPathInput) installPathInput.value = service.installPath;
        if (productionPortInput) productionPortInput.value = service.productionPort;
        if (categoryInput) categoryInput.value = service.setor;
        if (accessTypeInput) accessTypeInput.value = service.accessType;

        currentServiceIndex = editIndex;
        modalTitle.textContent = 'Editar Glassfish';
    } else {
        currentServiceIndex = null;
        modalTitle.textContent = 'Adicionar Glassfish';
    }

    // Abrir o modal
    modal.classList.add('is-active');
}

function closeAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) {
        modal.classList.remove('is-active');
        currentServiceIndex = null;
    }
}

        // Função para salvar ou editar serviço no MongoDB
        async function saveGlassfish() {
            try {
        const serviceData = {
                    name: document.getElementById('service-name').value,
                    ip: document.getElementById('service-ip').value,
                    port: parseInt(document.getElementById('service-port').value),
                    domain: document.getElementById('service-domain').value,
                    sshUsername: document.getElementById('service-ssh-username').value,
                    sshPassword: document.getElementById('service-ssh-password').value,
            installPath: document.getElementById('service-install-path').value,
                    setor: document.getElementById('service-category').value,
            accessType: document.getElementById('service-access-type').value,
            productionPort: parseInt(document.getElementById('production-port').value) || 8091
        };

        // Validação dos campos obrigatórios
        if (!serviceData.name || !serviceData.ip || !serviceData.domain || 
            !serviceData.sshUsername || !serviceData.sshPassword || !serviceData.installPath) {
            throw new Error('Todos os campos obrigatórios devem ser preenchidos');
        }

        // Validação do tipo de acesso
        if (serviceData.accessType === 'external' && !serviceData.productionPort) {
            throw new Error('A porta de produção é obrigatória para acesso externo');
        }

        const url = currentServiceIndex !== null ? 
            `/api/glassfish/servicos/${services[currentServiceIndex].id}` : 
            '/api/glassfish/servicos';

        const method = currentServiceIndex !== null ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
                    headers: { 
                        'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
            body: JSON.stringify(serviceData)
                });

                if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar serviço');
                }

                await fetchServices();
        closeAddModal();
        showToast('Serviço salvo com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao salvar serviço:', error);
        showToast(error.message || 'Erro ao salvar serviço', 'error');
            }
        }

        async function renderCards(servicesData) {
    const container = document.getElementById('cards-container');
    if (!container) return;

    container.innerHTML = servicesData.map((service, index) => `
        <div class="card ${service.inUse ? 'is-warning' : ''}" data-index="${index}" data-action="editService">
            <div class="card-content">
                <div class="media">
                    <div class="media-left">
                        <span class="icon is-large has-text-info">
                            <i class="fas fa-server fa-3x"></i>
                        </span>
                            </div>
                    <div class="media-content">
                            <p class="title is-4">${service.name}</p>
                        <p class="subtitle is-6">${service.ip}:${service.port}</p>
                    </div>
                </div>
                <div class="content">
                    <div class="tags">
                        <span class="tag ${service.status === 'active' ? 'is-success' : 'is-danger'}">
                            ${service.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                        ${service.inUse ? `<span class="tag is-warning">Em uso por ${service.inUseBy}</span>` : ''}
                    </div>
                </div>
            </div>
            <footer class="card-footer">
                <button class="card-footer-item button is-info is-light" data-action="viewLogs" data-index="${index}">
                    <span class="icon"><i class="fas fa-file-alt"></i></span>
                    <span>Ver logs</span>
                </button>
                <button class="card-footer-item button is-success is-light" data-action="startService" data-index="${index}">
                                    <span class="icon"><i class="fas fa-play"></i></span>
                    <span>Iniciar</span>
                                </button>
                <button class="card-footer-item button is-danger is-light" data-action="stopService" data-index="${index}">
                                    <span class="icon"><i class="fas fa-stop"></i></span>
                    <span>Parar</span>
                                </button>
                <button class="card-footer-item button is-warning is-light" data-action="restartService" data-index="${index}">
                                    <span class="icon"><i class="fas fa-sync"></i></span>
                    <span>Reiniciar</span>
                                </button>
                <button class="card-footer-item button is-info is-light" data-action="domainConfig" data-index="${index}">
                                    <span class="icon"><i class="fas fa-cog"></i></span>
                    <span>Configurar Domain</span>
                                </button>
                ${!service.inUse ? `
                    <button class="card-footer-item button is-warning is-light" data-action="markInUse" data-index="${index}">
                        <span class="icon"><i class="fas fa-user"></i></span>
                        <span>Marcar como em uso</span>
                                </button>
                ` : `
                    <button class="card-footer-item button is-success is-light" data-action="markAvailable" data-index="${index}">
                        <span class="icon"><i class="fas fa-check"></i></span>
                        <span>Marcar como disponível</span>
                                </button>
                `}
            </footer>
                            </div>
    `).join('');
}

// Função para filtrar cards
function filterCards() {
    const statusFilter = document.getElementById('filter-status').value;
    const setorFilter = document.getElementById('filter-setor').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();

    const filteredServices = services.filter(service => {
        const matchStatus = statusFilter === 'all' || 
            (statusFilter === 'active' && service.status === 'active') ||
            (statusFilter === 'inactive' && service.status !== 'active');

        const matchSetor = setorFilter === 'all' || service.setor === setorFilter;

        const matchSearch = service.name.toLowerCase().includes(searchQuery) ||
            service.domain.toLowerCase().includes(searchQuery) ||
            service.ip.toLowerCase().includes(searchQuery);

        return matchStatus && matchSetor && matchSearch;
    });

    renderCards(filteredServices);
}

// Função para remover serviço
async function removeService(index) {
            const service = services[index];
    if (!confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/glassfish/servicos/${service._id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
                });

                if (!response.ok) {
            throw new Error('Erro ao excluir serviço');
                }

        showToast('Serviço removido com sucesso!', 'success');
        await fetchServices();
            } catch (error) {
        console.error('Erro ao excluir serviço:', error);
                showToast(error.message, 'danger');
            }
        }

// Função para iniciar serviço
async function startService(index) {
            try {
        const service = services[index];
        const response = await fetch(`/api/glassfish/servicos/${service._id}/start`, {
                    method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
                });

                if (!response.ok) {
            throw new Error('Erro ao iniciar serviço');
                }

        showToast('Serviço iniciado com sucesso!', 'success');
        await fetchServices();
            } catch (error) {
        console.error('Erro ao iniciar serviço:', error);
                showToast(error.message, 'danger');
            }
        }

// Função para parar serviço
async function stopService(index) {
    try {
            const service = services[index];
        if (!service || !service.id) {
            throw new Error('Serviço não encontrado');
        }

        const response = await fetch(`/api/glassfish/servicos/${service.id}/stop`, {
                    method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
                });
                
                if (!response.ok) {
            throw new Error('Erro ao parar serviço');
        }

        await fetchServices();
        showToast('Serviço parado com sucesso', 'success');
            } catch (error) {
        console.error('Erro ao parar serviço:', error);
        showToast('Erro ao parar serviço', 'error');
    }
}

// Função para reiniciar serviço
async function restartService(index) {
    try {
            const service = services[index];
        if (!service || !service.id) {
            throw new Error('Serviço não encontrado');
            }
            
        const response = await fetch(`/api/glassfish/servicos/${service.id}/restart`, {
            method: 'POST',
                    headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                    });
                    
                    if (!response.ok) {
            throw new Error('Erro ao reiniciar serviço');
                    }
                    
        await fetchServices();
        showToast('Serviço reiniciado com sucesso', 'success');
                } catch (error) {
        console.error('Erro ao reiniciar serviço:', error);
        showToast('Erro ao reiniciar serviço', 'error');
    }
}

// Função para verificar status do serviço
async function checkServiceStatus(service) {
    try {
        if (!service || !service._id) {
            console.error('Serviço inválido:', service);
            return;
        }

        const response = await fetch(`/api/glassfish/servicos/${service._id}/status`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao verificar status do serviço');
        }

        const status = await response.json();
        const statusIndicator = document.getElementById(`status-${service._id}`);
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status.status === 'active' ? 'status-active' : 'status-inactive'}`;
        }

        return status;
            } catch (error) {
        console.error('Erro ao verificar status:', error);
        return null;
    }
}

// Função para abrir painel admin
function openAdminPanel() {
    const service = services[editingIndex];
    if (!service) return;

    const url = `http://${service.ip}:${service.port}`;
    window.open(url, '_blank');
}

// Função para acessar NeoWeb
function accessNeoWeb() {
    const service = services[editingIndex];
    if (!service) return;

    const url = `http://${service.ip}:${service.productionPort}/neoweb`;
    window.open(url, '_blank');
}

// Função para alternar visibilidade da senha
        function togglePasswordVisibility() {
            const passwordInput = document.getElementById('service-password');
            const eyeIcon = document.getElementById('eye-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        }

// Função para testar conexão SSH
        async function testSSHConnection() {
    const host = document.getElementById('service-ip').value;
            const username = document.getElementById('service-ssh-username').value;
            const password = document.getElementById('service-ssh-password').value;
    const resultElement = document.getElementById('ssh-test-result');

    if (!host || !username || !password) {
        resultElement.textContent = 'Preencha todos os campos de conexão SSH';
        resultElement.className = 'help is-danger';
                return;
            }

            try {
                const response = await fetch('/api/glassfish/test-ssh', {
                    method: 'POST',
                    headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                ip: host,
                        username: username,
                        password: password
                    })
                });

                if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Erro ao testar conexão SSH');
        }

        const data = await response.json();
        resultElement.textContent = data.message;
        resultElement.className = 'help is-success';
            } catch (error) {
        console.error('Erro ao testar conexão SSH:', error);
        resultElement.textContent = error.message;
        resultElement.className = 'help is-danger';
    }
}

// Função para lidar com mudança no tipo de acesso
        function handleAccessTypeChange() {
            const accessType = document.getElementById('service-access-type').value;
    const productionPortField = document.getElementById('production-port').parentElement.parentElement;
            
            if (accessType === 'external') {
        productionPortField.style.display = 'block';
            } else {
        productionPortField.style.display = 'none';
    }
}

// Função para marcar serviço como em uso
async function markInUse(index) {
    try {
        const service = services[index];
        if (!service || !service.id) {
                    throw new Error('Serviço não encontrado');
                }

        const response = await fetch(`/api/glassfish/servicos/${service.id}/in-use`, {
                    method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                inUse: true,
                inUseBy: localStorage.getItem('username') || 'Usuário desconhecido'
            })
                });

                if (!response.ok) {
            throw new Error('Erro ao marcar serviço como em uso');
        }

                await fetchServices();
        showToast('Serviço marcado como em uso com sucesso', 'success');
            } catch (error) {
        console.error('Erro ao marcar serviço como em uso:', error);
        showToast(error.message || 'Erro ao marcar serviço como em uso', 'error');
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registrado com sucesso');
            } catch (error) {
            console.error('Erro ao registrar Service Worker:', error);
        }
    }

    // Inicializar variáveis
    let services = [];
    let currentServiceIndex = null;
    let currentMaintenanceIndex = null;
    let currentDomainConfigIndex = null;
    let isLogViewerOpen = false;
    let logWebSocket = null;

    // Adicionar event listeners com verificações
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }

    const applicationFile = document.getElementById('application-file');
    if (applicationFile) {
        applicationFile.addEventListener('change', (e) => {
            const fileName = e.target.files[0]?.name || 'Nenhum arquivo selecionado';
            const fileNameElement = document.getElementById('file-name');
            const uploadButton = document.getElementById('upload-button');
            
            if (fileNameElement) fileNameElement.textContent = fileName;
            if (uploadButton) uploadButton.disabled = !e.target.files[0];
        });
    }

    // Adicionar event listener para o botão de adicionar serviço
    const addButton = document.querySelector('[data-action="openAddModal"]');
    if (addButton) {
        addButton.addEventListener('click', () => {
            const modal = document.getElementById('add-modal');
            if (modal) {
                modal.classList.add('is-active');
            }
        });
    }

    // Adicionar event listener para o botão de salvar
    const saveButton = document.querySelector('[data-action="saveGlassfish"]');
    if (saveButton) {
        saveButton.addEventListener('click', saveGlassfish);
    }

    // Adicionar event listener para o botão de cancelar
    const cancelButton = document.querySelector('[data-action="closeAddModal"]');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeAddModal);
    }

    // Adicionar event listeners para elementos com data-action
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        switch (action) {
            case 'filter':
                filterCards();
                break;
            case 'openAddModal':
                openAddModal();
                break;
            case 'closeAddModal':
                closeAddModal();
                break;
            case 'testSSHConnection':
                testSSHConnection();
                break;
            case 'openAdminPanel':
                openAdminPanel();
                break;
            case 'accessNeoWeb':
                accessNeoWeb();
                break;
            case 'closeModal':
                const modalId = target.dataset.modal;
                closeModal(modalId);
                break;
            case 'saveUserName':
                saveUserName(services, fetchServices);
                break;
            case 'saveDomainConfig':
                saveDomainConfig();
                break;
            case 'uploadApplication':
                uploadApplication();
                break;
            case 'executeMaintenance':
                executeMaintenance(services, fetchServices);
                break;
            case 'viewLogs':
                const logIndex = parseInt(target.dataset.index);
                viewLogs(logIndex, services);
                break;
            case 'editService':
                const editIndex = parseInt(target.dataset.index);
                openAddModal(editIndex);
                break;
            case 'startService':
                const startIndex = parseInt(target.dataset.index);
                startService(startIndex);
                break;
            case 'stopService':
                const stopIndex = parseInt(target.dataset.index);
                stopService(stopIndex);
                break;
            case 'restartService':
                const restartIndex = parseInt(target.dataset.index);
                restartService(restartIndex);
                break;
            case 'domainConfig':
                const domainIndex = parseInt(target.dataset.index);
                openDomainConfigModal(domainIndex, services);
                break;
            case 'markInUse':
                const markIndex = parseInt(target.dataset.index);
                markInUse(markIndex);
                break;
            case 'markAvailable':
                const availableIndex = parseInt(target.dataset.index);
                markServiceAvailable(availableIndex, services, fetchServices);
                break;
            case 'toggleLogViewer':
                toggleLogViewer();
                break;
            case 'clearLogViewer':
                const logViewer = document.getElementById('log-viewer');
                if (logViewer) {
                    logViewer.innerHTML = '';
                }
                break;
        }
    });

    // Adicionar event listeners para fechar o modal
    const addModal = document.getElementById('add-modal');
    if (addModal) {
        // Fechar ao clicar no background
        const modalBackground = addModal.querySelector('.modal-background');
        if (modalBackground) {
            modalBackground.addEventListener('click', () => {
                addModal.classList.remove('is-active');
                currentServiceIndex = null;
            });
        }

        // Fechar ao clicar no botão de fechar
        const closeButton = addModal.querySelector('.delete');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                addModal.classList.remove('is-active');
                currentServiceIndex = null;
            });
        }
    }

    // Carregar serviços iniciais
    await fetchServices();
});
