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
        let services = [];
        let currentWebSocket = null;
        let currentServiceId = null;
        let statusCheckInterval = null;
        let currentMaintenanceIndex = null;
        let currentDomainConfigIndex = null;
        let logViewerActive = false;

        // Função para obter os dados do MongoDB
        async function fetchServices() {
            try {
                const response = await fetch('/api/servicos');
                if (!response.ok) {
                    throw new Error('Erro ao obter serviços');
                }
                services = await response.json();
                renderCards(services);
                await checkAllServicesStatus(); // Verificar status inicial
            } catch (error) {
                console.error('Erro ao carregar serviços:', error);
                showToast('Erro ao carregar serviços. Por favor, recarregue a página.', 'danger');
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
            editingIndex = editIndex;
            if (editIndex !== null) {
                const service = services[editIndex];
                document.getElementById('service-name').value = service.name;
                document.getElementById('service-ip').value = service.ip;
                document.getElementById('service-port').value = service.port;
                document.getElementById('service-domain').value = service.domain;
                document.getElementById('service-ssh-username').value = service.sshUsername;
                document.getElementById('service-ssh-password').value = service.sshPassword;
                document.getElementById('service-install-path').value = service.installPath;
                document.getElementById('service-category').value = service.setor || 'Cliente';
                document.getElementById('service-access-type').value = service.accessType || 'local';
                document.getElementById('production-port').value = service.productionPort || '8081';
                modalTitle.textContent = 'Editar Glassfish';
            } else {
                document.getElementById('service-name').value = '';
                document.getElementById('service-ip').value = '';
                document.getElementById('service-port').value = 8080;
                document.getElementById('service-domain').value = '';
                document.getElementById('service-ssh-username').value = '';
                document.getElementById('service-ssh-password').value = '';
                document.getElementById('service-install-path').value = '/glassfish6.2.5';
                document.getElementById('service-category').value = 'Cliente';
                document.getElementById('service-access-type').value = 'local';
                document.getElementById('production-port').value = '8081';
                modalTitle.textContent = 'Adicionar Glassfish';
            }
            document.getElementById('add-modal').classList.add('is-active');
        }

        function closeAddModal() {
            document.getElementById('add-modal').classList.remove('is-active');
            editingIndex = null;
        }

        // Função para salvar ou editar serviço no MongoDB
        async function saveGlassfish() {
                const service = {
                    name: document.getElementById('service-name').value,
                    ip: document.getElementById('service-ip').value,
                    port: parseInt(document.getElementById('service-port').value),
                    domain: document.getElementById('service-domain').value,
                    password: document.getElementById('service-password').value || 'admin',
                    sshUsername: document.getElementById('service-ssh-username').value,
                    sshPassword: document.getElementById('service-ssh-password').value,
                    installPath: document.getElementById('service-install-path').value || '/srv/glassfish6.2.5',
                    productionPort: parseInt(document.getElementById('production-port').value),
                    setor: document.getElementById('service-category').value,
                    accessType: document.getElementById('service-access-type').value
                };

                if (!service.name || !service.ip || !service.domain || !service.sshUsername || !service.sshPassword) {
                    showToast('Por favor, preencha todos os campos obrigatórios', 'danger');
                    return;
                }

                const url = editingIndex !== null ? 
                    `/api/servicos/${services[editingIndex]._id}` : 
                    '/api/servicos';

                const method = editingIndex !== null ? 'PUT' : 'POST';

                console.log('Enviando dados do serviço:', { ...service, sshPassword: '***' });

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(service)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao salvar serviço');
                }

                showToast('Serviço salvo com sucesso!', 'success');
                closeAddModal();
                await fetchServices(); // Recarrega a lista de serviços
        }

        async function renderCards(servicesData) {
            console.log('Renderizando cards com dados:', servicesData);
            cardsContainer.innerHTML = '';
            servicesData.forEach((service, index) => {
                console.log('Renderizando serviço:', service);
                const card = document.createElement('div');
                card.className = 'column is-one-third';
                
                // Garantir que a categoria tenha um valor padrão se não estiver definida
                const categoria = service.setor || 'Cliente';
                
                card.innerHTML = `
                    <div class="card ${service.inUse ? 'is-warning' : ''}" onclick="handleCardClick(event, ${index})">
                        <div class="card-content has-text-centered">
                            <span id="status-${service._id}" class="status-indicator ${service.status === 'active' ? 'status-active' : 'status-inactive'}"></span>
                            <div class="category-badge is-info">
                                <img src="/assets/neo-logo-small.png" alt="Neo" style="height: 20px;">
                            </div>
                            <span class="card-icon"><i class="fas fa-server"></i></span>
                            <p class="title is-4">${service.name}</p>
                            <p class="subtitle is-6">
                                IP: ${service.ip}
                            </p>
                            <p class="subtitle is-6">
                                Usuário Atual: ${service.currentUser || 'Nenhum'}
                            </p>
                            <div class="card-actions">
                                <button class="button is-small is-success" onclick="startService(${index})" title="Iniciar Serviço"
                                    id="start-btn-${service._id}">
                                    <span class="icon"><i class="fas fa-play"></i></span>
                                </button>
                                <button class="button is-small is-danger" onclick="stopService(${index})" title="Parar Serviço"
                                    id="stop-btn-${service._id}">
                                    <span class="icon"><i class="fas fa-stop"></i></span>
                                </button>
                                <button class="button is-small is-info" onclick="restartService(${index})" title="Reiniciar Serviço">
                                    <span class="icon"><i class="fas fa-sync"></i></span>
                                </button>
                                <button class="button is-small" onclick="viewLogs(${index})" title="Ver Logs">
                                    <span class="icon"><i class="fas fa-file-alt"></i></span>
                                </button>
                                <button class="button is-small is-warning" onclick="openMaintenanceModal(${index})" title="Manutenção">
                                    <span class="icon"><i class="fas fa-tools"></i></span>
                                </button>
                                <button class="button is-small is-danger" onclick="removeService(${index})" title="Excluir Serviço">
                                    <span class="icon"><i class="fas fa-trash"></i></span>
                                </button>
                                <button class="button is-small is-info" onclick="openDomainConfigModal(${index})" title="Configurar Domain">
                                    <span class="icon"><i class="fas fa-cog"></i></span>
                                </button>
                            </div>
                            <div class="user-buttons">
                                <button class="button is-small is-info" onclick="openUserNameModal(${index})" title="Marcar como em uso">
                                    <span class="icon"><i class="fas fa-user-check"></i></span>
                                </button>
                                <button class="button is-small is-success" onclick="markServiceAvailable(${index})" title="Marcar como disponível">
                                    <span class="icon"><i class="fas fa-user-times"></i></span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                cardsContainer.appendChild(card);
            });

            emptyMessage.style.display = servicesData.length > 0 ? 'none' : 'block';
            resultsCount.textContent = `Exibindo ${servicesData.length} serviços`;
        }

        // Funções de manipulação de status
        async function startService(index) {
            const service = services[index];
            try {
                const response = await fetch(`/api/servicos/${service._id}/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao iniciar serviço');
                }

                const data = await response.json();
                showToast(data.message, 'success');
                await checkServiceStatus(service);
            } catch (error) {
                showToast(error.message, 'danger');
            }
        }

        async function stopService(index) {
            const service = services[index];
            try {
                const response = await fetch(`/api/servicos/${service._id}/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao parar serviço');
                }

                const data = await response.json();
                showToast(data.message, 'success');
                await checkServiceStatus(service);
            } catch (error) {
                showToast(error.message, 'danger');
            }
        }

        // Atualizar a função restart
        async function restartService(index) {
            const service = services[index];
            
            // Obter referência aos botões
            const restartButton = document.querySelector(`button[onclick="restartService(${index})"]`);
            const startButton = document.getElementById(`start-btn-${service._id}`);
            const stopButton = document.getElementById(`stop-btn-${service._id}`);
            
            try {
                // Desabilitar todos os botões e mostrar loading
                restartButton.classList.add('is-loading');
                startButton.disabled = true;
                stopButton.disabled = true;
                restartButton.disabled = true;

                // Usar a rota de restart
                const response = await fetch(`/api/servicos/${service._id}/restart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erro ao reiniciar serviço');
                }
                
                const data = await response.json();
                showToast('Serviço reiniciado com sucesso!', 'success');
                
                // Atualizar status após alguns segundos
                setTimeout(() => {
                    checkServiceStatus(service);
                }, 5000);
            } catch (error) {
                console.error('Erro ao reiniciar serviço:', error);
                showToast('Erro ao reiniciar serviço: ' + error.message, 'danger');
            } finally {
                // Reabilitar todos os botões e remover loading
                restartButton.classList.remove('is-loading');
                startButton.disabled = false;
                stopButton.disabled = false;
                restartButton.disabled = false;
            }
        }

        async function removeService(index) {
            const service = services[index];
            
            if (!confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
                return;
            }
            
                try {
                    const response = await fetch(`/api/servicos/${service._id}`, { 
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                    });
                    
                    if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.details || data.error || 'Erro ao excluir serviço');
                    }
                    
                services.splice(index, 1);
                renderCards(services);
                showToast(`Serviço "${service.name}" removido com sucesso`, 'success');
                } catch (error) {
                    console.error('Erro ao excluir serviço:', error);
                showToast(`Erro ao excluir serviço: ${error.message}`, 'danger');
            }
        }

        function filterCards() {
            const statusFilter = document.getElementById('filter-status').value;
            const filteredServices = statusFilter === 'all' ? services :
                services.filter(service => service.status === statusFilter);
            renderCards(filteredServices);
        }

        // Ordenação
        function sortCards(criteria) {
            const sortedServices = [...services].sort((a, b) => {
                if (criteria === 'name') {
                    return a.name.localeCompare(b.name);
                } else if (criteria === 'status') {
                    return a.status.localeCompare(b.status);
                } else if (criteria === 'setor') {
                    return a.setor.localeCompare(b.setor);
                }
                return 0;
            });
            renderCards(sortedServices);
        }

        function toggleLiveLog() {
            const statusElement = document.getElementById('live-log-status');
            
            if (currentWebSocket) {
                currentWebSocket.close();
                currentWebSocket = null;
                statusElement.textContent = 'Iniciar Live Log';
                return;
            }

            const service = services[currentServiceId];
            const ws = new WebSocket(`ws://${window.location.host}/api/servicos/${service._id}/logs/live`);
            
            ws.onmessage = (event) => {
                const logsContent = document.getElementById('logs-content');
                logsContent.textContent += event.data;
                logsContent.scrollTop = logsContent.scrollHeight;
            };

            ws.onclose = () => {
                statusElement.textContent = 'Iniciar Live Log';
                currentWebSocket = null;
            };

            currentWebSocket = ws;
            statusElement.textContent = 'Parar Live Log';
        }

        async function viewLogs(index) {
            currentServiceId = index;
            try {
                const service = services[index];
                const response = await fetch(`/api/servicos/${service._id}/logs`);
                const data = await response.json();
                if (data.error) {
                    alert(data.error);
                    return;
                }
                document.getElementById('logs-content').textContent = data.logs;
                document.getElementById('logs-modal').classList.add('is-active');
            } catch (error) {
                console.error('Erro ao obter logs:', error);
                alert('Erro ao obter logs');
            }
        }

        function closeLogsModal() {
            if (currentWebSocket) {
                currentWebSocket.close();
                currentWebSocket = null;
            }
            document.getElementById('logs-modal').classList.remove('is-active');
        }

        function toggleSSHPasswordVisibility() {
            const passwordInput = document.getElementById('service-ssh-password');
            const eyeIcon = document.getElementById('ssh-eye-icon');
            
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

        async function testSSHConnection() {
            const ip = document.getElementById('service-ip').value;
            const username = document.getElementById('service-ssh-username').value;
            const password = document.getElementById('service-ssh-password').value;

            // Validar se todos os campos estão preenchidos
            if (!ip || !username || !password) {
                showToast('Por favor, preencha todos os campos SSH', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/test-ssh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ip: ip,
                        username: username,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showToast('Conexão SSH testada com sucesso', 'success');
                } else {
                    showToast(data.error || 'Erro ao testar conexão SSH', 'danger');
                }
            } catch (error) {
                showToast('Erro ao testar conexão SSH: ' + error.message, 'danger');
            }
        }

        function showToast(message, type) {
            if (type === 'success' || type === 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = `toast is-${type} show`;
            
            setTimeout(() => {
                    toast.className = toast.className.replace('show', '');
            }, 3000);
            }

            // Adicionar ao log para todos os tipos de mensagem
            addLogEntry(message, type);
        }

        function addLogEntry(message, type) {
            if (!logViewerActive) return; // Não adicionar logs se o visualizador estiver desativado

            const logViewer = document.getElementById('log-viewer');
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${type.toUpperCase()}: ${message}`;
            logViewer.appendChild(logEntry);

            // Manter o scroll no final
            logViewer.scrollTop = logViewer.scrollHeight;
        }

        function openAdminPanel() {
            const ip = document.getElementById('service-ip').value;
            const port = document.getElementById('service-port').value;
            const url = `https://${ip}:${port}`;
            window.open(url, '_blank');
        }

        // Atualizar a função updateDashboardStats para refletir as sugestões
        async function updateDashboardStats() {
            try {
                const response = await fetch('/api/servicos/stats/overview');
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                const overview = await response.json();

                // Atualizar contadores
                document.getElementById('total-servers').textContent = overview.totalServers;
                document.getElementById('active-servers').textContent = overview.activeServers;
                
                // Atualizar médias e barras de progresso
                document.getElementById('avg-ram-usage').textContent = `${overview.averageMemory}%`;
                document.getElementById('avg-cpu-usage').textContent = `${overview.averageCpu}%`;
                
                const ramProgress = document.getElementById('ram-progress');
                const cpuProgress = document.getElementById('cpu-progress');
                
                if (ramProgress && cpuProgress) {
                    ramProgress.value = overview.averageMemory || 0;
                    cpuProgress.value = overview.averageCpu || 0;
                updateProgressColor(ramProgress, overview.averageMemory);
                updateProgressColor(cpuProgress, overview.averageCpu);
                }

                // Atualizar detalhes dos servidores
                const detailsContainer = document.getElementById('server-details');
                if (detailsContainer) {
                    if (overview.serverDetails && Array.isArray(overview.serverDetails)) {
                        const detailsHtml = overview.serverDetails.map(server => `
                            <div class="box server-detail">
                                <div class="columns is-vcentered">
                                    <div class="column is-3">
                                        <strong>${server.name}</strong>
                                    </div>
                                    <div class="column is-2">
                                        <span class="tag ${server.status === 'active' ? 'is-success' : 'is-danger'}">
                                            ${server.status}
                                        </span>
                                    </div>
                                    <div class="column is-3">
                                        <div class="level is-mobile">
                                            <div class="level-item">
                                                <div>
                                                    <p class="heading">RAM</p>
                                                    <p class="title is-6">${server.memory}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="column is-3">
                                        <div class="level is-mobile">
                                            <div class="level-item">
                                                <div>
                                                    <p class="heading">CPU</p>
                                                    <p class="title is-6">${server.cpu}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                        detailsContainer.innerHTML = detailsHtml;
                    } else {
                        detailsContainer.innerHTML = `
                            <div class="notification is-info is-light">
                                <p>Nenhum detalhe disponível</p>
                            </div>
                        `;
                    }
                }

            } catch (error) {
                console.error('Erro ao atualizar estatísticas:', error);
                showToast('Erro ao atualizar estatísticas: ' + error.message, 'danger');
            }
        }

        // Função para atualizar cores das barras de progresso
        function updateProgressColor(progressBar, value) {
            progressBar.classList.remove('is-success', 'is-warning', 'is-danger');
            if (value < 60) {
                progressBar.classList.add('is-success');
            } else if (value < 80) {
                progressBar.classList.add('is-warning');
            } else {
                progressBar.classList.add('is-danger');
            }
        }

        // Iniciar monitoramento
        function startMonitoring() {
            // Primeira verificação imediata
            updateDashboardStats();
            checkAllServicesStatus();
            
            // Reduzir frequência das verificações
            const statsInterval = setInterval(updateDashboardStats, 60000);  // 1 minuto
            const statusInterval = setInterval(checkAllServicesStatus, 30000); // 30 segundos
            
            // Limpar intervalos quando a página for fechada
            window.addEventListener('beforeunload', () => {
                clearInterval(statsInterval);
                clearInterval(statusInterval);
            });
        }

        function handleAccessTypeChange() {
            const accessType = document.getElementById('service-access-type').value;
            const ipInput = document.getElementById('service-ip');
            const portInput = document.getElementById('service-port');
            
            if (accessType === 'external') {
                ipInput.placeholder = "IP externo ou hostname";
                // Você pode adicionar validações específicas para IPs externos
            } else {
                ipInput.placeholder = "IP local (192.168.x.x)";
            }
        }

        function openMaintenanceModal(index) {
            event.stopPropagation(); // Evita que o modal de edição abra
            currentMaintenanceIndex = index;
            const service = services[index];
            if (!service) {
                showToast('Serviço não encontrado', 'danger');
                return;
            }
            // Armazenar o ID do serviço no botão de execução
            const executeButton = document.querySelector('#maintenance-modal .button.is-danger');
            executeButton.setAttribute('data-service-id', service._id);
            // Limpa os checkboxes
            document.getElementById('clean-applications').checked = false;
            document.getElementById('clean-logs').checked = false;
            document.getElementById('clean-generated').checked = false;
            document.getElementById('clean-autodeploy').checked = false;
            // Abre o modal
            document.getElementById('maintenance-modal').classList.add('is-active');
        }

        function closeMaintenanceModal() {
            document.getElementById('maintenance-modal').classList.remove('is-active');
            currentMaintenanceIndex = null;
        }

        async function executeMaintenanceFromModal(button) {
            const serviceId = button.getAttribute('data-service-id');
            if (!serviceId) {
                showToast('ID do serviço não encontrado', 'danger');
                return;
            }

            // Coletar todas as tarefas selecionadas
            const tasks = [];
            if (document.getElementById('clean-applications').checked) {
                tasks.push('cleanApplications');
            }
            if (document.getElementById('clean-logs').checked) {
                tasks.push('cleanLogs');
            }
            if (document.getElementById('clean-generated').checked) {
                tasks.push('cleanGenerated');
            }
            if (document.getElementById('clean-autodeploy').checked) {
                tasks.push('cleanAutodeploy');
            }

            // Verificar se pelo menos uma tarefa foi selecionada
            if (tasks.length === 0) {
                showToast('Selecione pelo menos uma opção de limpeza', 'warning');
                return;
            }

            // Adicionar loading state
            button.classList.add('is-loading');
            button.disabled = true;
            
            try {
                await executeMaintenanceTasks(serviceId, tasks);
                closeMaintenanceModal();
            } catch (error) {
                showToast(error.message, 'danger');
            } finally {
                button.classList.remove('is-loading');
                button.disabled = false;
            }
        }

        async function executeMaintenanceTasks(serviceId, tasks) {
            try {
                // Primeiro, obter o serviço
                const service = services.find(s => s._id === serviceId);
                if (!service) {
                    throw new Error('Serviço não encontrado');
                }

                // Executar a manutenção
                const response = await fetch(`/api/servicos/${serviceId}/maintenance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tasks })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Resposta da manutenção:', data);
                
                // Mostrar resultados detalhados
                let message = 'Tarefas executadas:\n';
                data.results.forEach(result => {
                    message += `\n${result.task}: ${result.success ? '✓' : '✗'} ${result.message}`;
                });
                showToast(message, 'success');
                
                // Atualizar o status do serviço
                await fetchServices();
                
            } catch (error) {
                console.error('Erro na manutenção:', error);
                showToast('Erro ao executar a manutenção: ' + error.message, 'danger');
            }
        }

        function openDomainConfigModal(index) {
            event.stopPropagation();
            currentDomainConfigIndex = index;
            const service = services[index];
            
            // Limpar campos e mostrar loading
            setLoadingState(true);
            
            // Resetar campos
            document.getElementById('db-server').value = '';
            document.getElementById('db-user').value = '';
            document.getElementById('db-password').value = '';
            document.getElementById('db-name').value = '';
            
            // Resetar aplicações
            const loadingEl = document.getElementById('applications-loading');
            const contentEl = document.getElementById('applications-content');
            contentEl.innerHTML = '';
            loadingEl.classList.remove('is-hidden');
            contentEl.classList.add('is-hidden');
            
            // Abrir modal
            document.getElementById('domain-config-modal').classList.add('is-active');
            
            // Carregar configurações
            loadDomainConfig(service);
            loadApplicationsList(service);
        }

        function closeDomainConfigModal() {
            document.getElementById('domain-config-modal').classList.remove('is-active');
            currentDomainConfigIndex = null;
        }

        async function loadDomainConfig(service) {
            setLoadingState(true);
            
            try {
                const response = await fetch(`/api/servicos/${service._id}/domain-config`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao carregar configurações');
                }
                
                // Atualizar os campos com os valores
                document.getElementById('db-server').value = data.serverName || '';
                document.getElementById('db-user').value = data.user || '';
                document.getElementById('db-password').value = data.password || '';
                document.getElementById('db-name').value = data.databaseName || '';
                
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
                showToast(`Erro ao carregar configurações: ${error.message}`, 'danger');
            } finally {
                setLoadingState(false);
            }
        }

        function setLoadingState(isLoading) {
            const fields = ['server', 'user', 'password', 'name'];
            fields.forEach(field => {
                const input = document.getElementById(`db-${field}`);
                const loadingIcon = document.getElementById(`db-${field}-loading`);
                
                input.disabled = isLoading;
                input.placeholder = isLoading ? 'Carregando...' : '';
                
                if (loadingIcon) {
                    loadingIcon.style.display = isLoading ? 'block' : 'none';
                }
            });
        }

        function getDefaultPlaceholder(field) {
            switch (field) {
                case 'server': return '192.168.1.103';
                case 'user': return 'postgres';
                case 'name': return 'neocorp';
                default: return '';
            }
        }

        function updateDatabaseFields(config) {
            document.getElementById('db-server').value = config.serverName || '';
            document.getElementById('db-user').value = config.user || '';
            document.getElementById('db-password').value = config.password || '';
            document.getElementById('db-name').value = config.databaseName || '';
        }

        async function loadApplicationsList(service) {
            const loadingEl = document.getElementById('applications-loading');
            const contentEl = document.getElementById('applications-content');
            
            try {
            loadingEl.classList.remove('is-hidden');
            contentEl.classList.add('is-hidden');

                const response = await fetch(`/api/servicos/${service._id}/applications`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.details || data.error || 'Erro ao listar aplicações');
                }
                
                let content = '';
                if (data.error) {
                    content = `
                        <div class="notification is-warning">
                            <p>${data.message || 'Erro ao carregar aplicações'}</p>
                        </div>
                    `;
                } else if (!data.applications || data.applications.length === 0) {
                    content = `
                        <div class="notification is-info">
                            <p>Nenhuma aplicação instalada</p>
                        </div>
                    `;
                } else {
                    content = data.applications.map(app => `
                            <div class="box">
                                <strong>${app.name}</strong>
                            <p class="help">Status: ${app.status}</p>
                            <p class="help">Engine: ${app.engine}</p>
                                <p class="help">Localização: ${app.location}</p>
                            </div>
                    `).join('');
                }
                
                contentEl.innerHTML = content;
            } catch (error) {
                console.error('Erro ao carregar aplicações:', error);
                contentEl.innerHTML = `
                    <div class="notification is-danger">
                        <p>Erro ao carregar aplicações: ${error.message}</p>
                    </div>
                `;
            } finally {
                loadingEl.classList.add('is-hidden');
                contentEl.classList.remove('is-hidden');
            }
        }

        async function saveDomainConfig() {
            try {
            const service = services[currentDomainConfigIndex];
                if (!service) {
                    throw new Error('Serviço não encontrado');
                }

                // Coletar os valores dos campos
            const config = {
                    serverName: document.getElementById('db-server').value.trim(),
                    user: document.getElementById('db-user').value.trim(),
                    password: document.getElementById('db-password').value.trim(),
                    databaseName: document.getElementById('db-name').value.trim()
                };

                // Validar se todos os campos estão preenchidos
                if (!config.serverName || !config.user || !config.password || !config.databaseName) {
                    showToast('Por favor, preencha todos os campos', 'warning');
                    return;
                }

                // Adicionar loading state
                const saveButton = document.querySelector('#domain-config-modal .button.is-success');
                saveButton.classList.add('is-loading');
                saveButton.disabled = true;

            try {
                const response = await fetch(`/api/servicos/${service._id}/domain-config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });

                if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || errorData.details || 'Erro ao salvar configurações');
                }

                    const data = await response.json();
                showToast('Configurações salvas com sucesso!', 'success');
                closeDomainConfigModal();
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                    showToast(error.message, 'danger');
                    throw error;
                } finally {
                    // Remover loading state
                    saveButton.classList.remove('is-loading');
                    saveButton.disabled = false;
                }
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                showToast(error.message, 'danger');
            }
        }

        function switchTab(tab) {
            const tabs = document.querySelectorAll('.tabs li');
            const contents = document.querySelectorAll('.tab-content');
            
            // Remover classe ativa de todas as tabs
            tabs.forEach(t => t.classList.remove('is-active'));
            
            // Esconder todos os conteúdos
            contents.forEach(c => {
                c.style.display = 'none';
                // Garantir que o conteúdo está oculto usando classes também
                c.classList.remove('is-active');
            });
            
            // Ativar a tab selecionada
            const activeTab = document.querySelector(`.tabs li a[onclick="switchTab('${tab}')"]`).parentElement;
            activeTab.classList.add('is-active');
            
            // Mostrar o conteúdo da tab selecionada
            const activeContent = document.getElementById(`${tab}-tab`);
            activeContent.style.display = 'block';
            activeContent.classList.add('is-active');
        }

        document.getElementById('application-file').addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'Nenhum arquivo selecionado';
            document.getElementById('file-name').textContent = fileName;
            document.getElementById('upload-button').disabled = !e.target.files[0];
        });

        async function uploadApplication() {
            const fileInput = document.getElementById('application-file');
            const uploadButton = document.getElementById('upload-button');
            const file = fileInput.files[0];
            if (!file) {
                showToast('Selecione um arquivo para upload', 'warning');
                return;
            }

            const service = services[currentDomainConfigIndex];
            const formData = new FormData();
            formData.append('file', file);

            try {
                uploadButton.classList.add('is-loading');
                uploadButton.disabled = true;
                
                // Corrigir a URL para usar o ID correto do serviço
                const response = await fetch(`/api/servicos/${service._id}/upload-application`, {
                    method: 'POST',
                    body: formData
                });

                // Verificar se a resposta não é OK antes de tentar parsear JSON
                if (!response.ok) {
                    const contentType = response.headers.get('content-type');
                    let errorMessage;
                    
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.error || 'Erro ao fazer upload da aplicação';
                    } else {
                        errorMessage = `Erro ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                showToast('Upload realizado com sucesso!', 'success');
                fileInput.value = '';
                document.getElementById('file-name').textContent = 'Nenhum arquivo selecionado';
                uploadButton.disabled = true;
                
                // Recarregar lista de aplicações
                await loadApplicationsList(service);
            } catch (error) {
                console.error('Erro no upload:', error);
                let errorMessage = error.message;
                if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Erro de conexão. Verifique o tamanho do arquivo e tente novamente.';
                }
                showToast('Erro ao fazer upload: ' + errorMessage, 'danger');
            } finally {
                uploadButton.classList.remove('is-loading');
                uploadButton.disabled = false;
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            fetchServices();
            startMonitoring();

            const copyLogButton = document.getElementById('copy-log-button');
            const logContent = document.getElementById('logs-content');

            copyLogButton.addEventListener('click', () => {
                const range = document.createRange();
                range.selectNode(logContent);
                window.getSelection().removeAllRanges(); // Limpar seleções anteriores
                window.getSelection().addRange(range);

                try {
                    const successful = document.execCommand('copy');
                    const msg = successful ? 'Logs copiados com sucesso!' : 'Falha ao copiar logs';
                    showToast(msg, successful ? 'success' : 'danger');
                } catch (err) {
                    showToast('Erro ao copiar logs', 'danger');
                }

                window.getSelection().removeAllRanges(); // Limpar seleção após copiar
            });
        });

        async function checkServiceStatus(service) {
            try {
                const response = await fetch(`/api/servicos/${service._id}/status`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.details || data.error || 'Erro ao verificar status');
                }

                // Se houver erro de instalação, mostrar mensagem específica
                if (data.status === 'error' && data.details?.error === 'installation_not_found') {
                    showToast(`Erro no servidor ${service.name}: ${data.details.message}`, 'warning');
                    return data;
                }

                const statusIndicator = document.querySelector(`#status-${service._id}`);
                if (statusIndicator) {
                    statusIndicator.className = `status-indicator ${data.status === 'active' ? 'status-active' : 'status-inactive'}`;
                    service.status = data.status;
                    service.pid = data.pid;
                }

                return data;
            } catch (error) {
                console.error(`Erro ao verificar status de ${service.name}:`, error);
                return { 
                    status: 'error', 
                    pid: null,
                    error: error.message
                };
            }
        }

        async function markServiceInUse(index, userName) {
            const service = services[index];
            try {
                const response = await fetch(`/api/servicos/${service._id}/in-use`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: userName })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao marcar serviço como em uso');
                }

                const data = await response.json();
                showToast(`${data.message} por ${data.currentUser}`, 'success');
                service.inUse = true;
                service.currentUser = data.currentUser;
                renderCards(services);
            } catch (error) {
                showToast(error.message, 'danger');
            }
        }

        async function markServiceAvailable(index) {
            const service = services[index];
            try {
                const response = await fetch(`/api/servicos/${service._id}/available`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao marcar serviço como disponível');
                }

                const data = await response.json();
                showToast(data.message, 'success');
                service.inUse = false;
                service.currentUser = '';
                renderCards(services);
            } catch (error) {
                showToast(error.message, 'danger');
            }
        }

        function openUserNameModal(index) {
            const modal = document.getElementById('user-name-modal');
            modal.classList.add('is-active');

            // Tentar buscar o nome do usuário do localStorage
            const storedUserName = localStorage.getItem('userName');
            if (storedUserName) {
                document.getElementById('modal-user-name').value = storedUserName;
            }

            // Armazenar o índice do serviço atual para uso posterior
            modal.dataset.serviceIndex = index;
        }

        function closeUserNameModal() {
            const modal = document.getElementById('user-name-modal');
            modal.classList.remove('is-active');
        }

        function confirmUserName() {
            const modal = document.getElementById('user-name-modal');
            const userName = document.getElementById('modal-user-name').value.trim();

            if (userName) {
                // Salvar o nome do usuário no localStorage
                localStorage.setItem('userName', userName);

                // Obter o índice do serviço e marcar como em uso
                const serviceIndex = modal.dataset.serviceIndex;
                markServiceInUse(serviceIndex, userName);

                closeUserNameModal();
                    } else {
                showToast('Por favor, insira seu nome', 'warning');
            }
        }

        function handleCardClick(event, index) {
            // Verificar se o clique foi em um botão
            if (event.target.closest('button')) {
                return; // Não fazer nada se o clique foi em um botão
            }
            openAddModal(index); // Abrir o modal se o clique não foi em um botão
        }

        function toggleLogViewer() {
            logViewerActive = !logViewerActive;
            const logViewer = document.getElementById('log-viewer');
            logViewer.style.display = logViewerActive ? 'block' : 'none';
        }

        function clearLogViewer() {
            const logViewer = document.getElementById('log-viewer');
            logViewer.innerHTML = '';
        }

        function accessNeoWeb() {
            const ip = document.getElementById('service-ip').value.trim();
            const productionPort = document.getElementById('production-port').value.trim();

            if (!ip || !productionPort) {
                showToast('Por favor, preencha o IP e a Porta de Produção', 'warning');
                return;
            }

            const url = `https://${ip}:${productionPort}/neocorp`;
            window.open(url, '_blank');
        }
