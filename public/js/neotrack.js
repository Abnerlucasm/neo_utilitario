// Drag and Drop
function initDragAndDrop() {
    const draggables = document.querySelectorAll('.service-card');
    const containers = document.querySelectorAll('.service-list');

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', async () => {
            draggable.classList.remove('dragging');
            const newStatus = draggable.closest('.service-list').id.replace('-list', '');
            const serviceId = draggable.dataset.id;
            
            try {
                await fetch(`/api/services/${serviceId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
            } catch (error) {
                console.error('Erro ao atualizar status:', error);
                showToast('Erro ao atualizar status', 'error');
            }
        });
    });

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            container.appendChild(draggable);
        });
    });
}

// Timer Control
function toggleTimer(serviceId) {
    const card = document.querySelector(`[data-id="${serviceId}"]`);
    if (!card) return;

    const timerDisplay = card.querySelector('.timer-display');
    const timerButton = card.querySelector('.timer-controls button');
    const timerIcon = timerButton.querySelector('i');

    if (!card.timer) {
        card.timer = new Timer(timerDisplay, serviceId);
    }

    if (card.timer.running) {
        card.timer.stop();
        timerIcon.classList.replace('fa-pause', 'fa-play');
    } else {
        card.timer.start();
        timerIcon.classList.replace('fa-play', 'fa-pause');
    }
}

class Timer {
    constructor(display, serviceId) {
        this.display = display;
        this.serviceId = serviceId;
        this.running = false;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.interval = null;
        this.totalTimeSpent = 0;
        this.loadSavedTime();
    }

    async loadSavedTime() {
        try {
            const response = await fetch(`/api/kanban/services/${this.serviceId}`);
            if (response.ok) {
                const service = await response.json();
                this.totalTimeSpent = service.totalTimeSpent || 0;
                this.display.textContent = formatTime(this.totalTimeSpent);
            }
        } catch (error) {
            console.error('Erro ao carregar tempo:', error);
        }
    }

    async start() {
        if (!this.running) {
            this.running = true;
            this.startTime = Date.now();
            this.interval = setInterval(() => this.updateDisplay(), 1000);
            await this.updateServer('start', this.totalTimeSpent);
        }
    }

    async stop() {
        if (this.running) {
            this.running = false;
            clearInterval(this.interval);
            const currentTime = Date.now();
            const timeElapsed = Math.floor((currentTime - this.startTime) / 1000);
            this.totalTimeSpent += timeElapsed;
            await this.updateServer('stop', this.totalTimeSpent);
            this.display.textContent = formatTime(this.totalTimeSpent);
            updateStatistics();
        }
    }

    async finish() {
        if (this.running) {
            await this.stop();
        }
        try {
            const response = await fetch(`/api/kanban/services/${this.serviceId}/timer/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    finalTime: this.totalTimeSpent,
                    status: 'finished'
                })
            });

            if (!response.ok) throw new Error('Erro ao finalizar timer');
            
            this.totalTimeSpent = 0;
            this.elapsedTime = 0;
            this.display.textContent = formatTime(0);
            updateStatistics();
            showToast('Timer finalizado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao finalizar timer:', error);
            showToast('Erro ao finalizar timer', 'error');
        }
    }

    updateDisplay() {
        if (this.running) {
            const currentTime = Date.now();
            const timeElapsed = Math.floor((currentTime - this.startTime) / 1000);
            const totalTime = this.totalTimeSpent + timeElapsed;
            this.display.textContent = formatTime(totalTime);
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async updateServer(action, currentTime) {
        try {
            const response = await fetch(`/api/kanban/services/${this.serviceId}/timer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action,
                    timeSpent: Math.floor(currentTime),
                    elapsedTime: action === 'stop' ? 
                        Math.floor((Date.now() - this.startTime) / 1000) : 0
                })
            });

            if (!response.ok) throw new Error('Erro ao atualizar timer');
            
            const data = await response.json();
            if (action === 'stop') {
                document.getElementById('total-time').textContent = formatTime(data.totalTime);
                this.display.textContent = formatTime(data.service.totalTimeSpent);
            }
        } catch (error) {
            console.error('Erro ao atualizar timer:', error);
            showToast('Erro ao atualizar timer', 'error');
        }
    }
}

async function updateStepStatus(serviceId, stepId, newStatus) {
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}/steps/${stepId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar status da etapa');
        }

        // Atualizar a interface
        await loadServices();
        showToast('Status da etapa atualizado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao atualizar status da etapa:', error);
        showToast(error.message, 'error');
    }
}

// Atualizar a função que cria o campo de etapa para incluir o evento de mudança de status
function addStepField(step = null) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item box';
    if (step && step._id) {
        stepDiv.dataset.stepId = step._id;
    }
    
    stepDiv.innerHTML = `
        <div class="field">
            <label class="label">Título da Etapa</label>
            <div class="control">
                <input class="input step-title" type="text" value="${step?.name || ''}" placeholder="Ex: Análise Inicial">
            </div>
        </div>
        <div class="columns">
            <div class="column">
                <div class="field">
                    <label class="label">Responsável</label>
                    <div class="control">
                        <input class="input step-responsible" type="text" value="${step?.responsible || ''}" placeholder="Nome do responsável">
                    </div>
                </div>
            </div>
            <div class="column">
                <div class="field">
                    <label class="label">Equipe</label>
                    <div class="control">
                        <input class="input step-assigned" type="text" value="${step?.assignedTo || ''}" placeholder="Equipe responsável">
                    </div>
                </div>
            </div>
            <div class="column">
                <div class="field">
                    <label class="label">Status</label>
                    <div class="control">
                        <div class="select">
                            <select class="step-status" onchange="updateStepStatus('${step?._id || ''}', '${step?.serviceId || ''}', this.value)">
                                <option value="pending" ${step?.status === 'pending' ? 'selected' : ''}>Pendente</option>
                                <option value="in_progress" ${step?.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
                                <option value="completed" ${step?.status === 'completed' ? 'selected' : ''}>Concluído</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return stepDiv;
}

// Função para coletar as etapas
function collectSteps() {
    const steps = [];
    document.querySelectorAll('.step-item').forEach((stepDiv, index) => {
        const step = {
            name: stepDiv.querySelector('.step-title').value,
            responsible: stepDiv.querySelector('.step-responsible').value,
            assignedTo: stepDiv.querySelector('.step-assigned').value,
            status: stepDiv.querySelector('.step-status').value,
            order: index
        };
        
        // Manter o _id se existir
        const stepId = stepDiv.dataset.stepId;
        if (stepId) {
            step._id = stepId;
        }

        if (step.name.trim()) {
            steps.push(step);
        }
    });
    return steps;
}

function initKanban() {
    const columns = document.querySelectorAll('.kanban-column');
    if (!columns.length) return;
    
    columns.forEach(column => {
        const list = column.querySelector('.service-list');
        if (list) {
            new Sortable(list, {
                group: 'services',
                animation: 150,
                ghostClass: 'service-ghost',
                dragClass: 'service-drag',
                chosenClass: 'service-chosen',
                onEnd: async function(evt) {
                    const serviceId = evt.item.dataset.id;
                    const newStatus = evt.to.id.replace('-list', '');
                    
                    // Mapear o status do quadro para o status do serviço
                    let serviceStatus;
                    switch (newStatus) {
                        case 'todo':
                            serviceStatus = 'planejamento';
                            break;
                        case 'in-progress':
                            serviceStatus = 'em_andamento';
                            break;
                        case 'completed':
                            serviceStatus = 'concluido';
                            break;
                        default:
                            serviceStatus = 'em_andamento'; // Status padrão para quadros customizados
                    }

                    try {
                        const response = await fetch(`/api/kanban/services/${serviceId}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                status: newStatus,
                                serviceStatus: serviceStatus
                            })
                        });

                        if (!response.ok) throw new Error('Erro ao atualizar status');

                        const data = await response.json();
                        
                        // Atualizar o card com os novos dados
                        const card = evt.item;
                        if (card) {
                            // Atualizar dados do card
                            card.dataset.service = JSON.stringify(data.service);
                            
                            // Atualizar a tag de status no card
                            const statusTag = card.querySelector('.tag:first-child');
                            if (statusTag) {
                                statusTag.className = `tag ${getStatusClass(serviceStatus)}`;
                                statusTag.textContent = serviceStatus;
                            }

                            // Atualizar estatísticas se movido para concluído
                            if (newStatus === 'completed') {
                                updateStatistics();
                            }
                        }
                    } catch (error) {
                        console.error('Erro:', error);
                        showToast('Erro ao mover o card', 'error');
                        evt.from.appendChild(evt.item); // Reverter movimento em caso de erro
                    }
                }
            });
        }
    });
}

function showNewServiceModal(columnId = 'todo') {
    const modal = document.getElementById('new-service-modal');
    
    // Limpar todos os campos do formulário
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
    }

    // Limpar campos específicos que podem não ser limpos pelo reset
    document.getElementById('service-name').value = '';
    document.getElementById('service-ticket').value = '';
    document.getElementById('service-category').value = '';
    document.getElementById('service-description').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('service-status').value = 'planejamento';

    // Limpar container de etapas
    const stepsContainer = document.getElementById('steps-container');
    if (stepsContainer) {
        stepsContainer.innerHTML = '';
    }

    // Remover ID do serviço do dataset do modal
    modal.dataset.serviceId = '';
    modal.dataset.columnId = columnId;

    // Adicionar uma etapa vazia
    addStepField();

    modal.classList.add('is-active');
}

function openTicketUrl() {
    const ticketUrl = document.getElementById('service-ticket').value;
    if (ticketUrl) {
        window.open(ticketUrl, '_blank');
    }
}

// Função para reordenar etapas
function updateStepsOrder() {
    const steps = [];
    document.querySelectorAll('.step-item').forEach((stepDiv, index) => {
        const titleInput = stepDiv.querySelector('.step-title');
        const responsibleInput = stepDiv.querySelector('.step-responsible');
        const statusSelect = stepDiv.querySelector('.step-status');

        if (titleInput && titleInput.value.trim()) {
            steps.push({
                name: titleInput.value.trim(),
                responsible: responsibleInput?.value?.trim() || '',
                status: statusSelect?.value || 'pending',
                order: index
            });
        }
    });

    // Se estiver editando um serviço existente, atualizar no backend
    const modal = document.getElementById('new-service-modal');
    const serviceId = modal.dataset.serviceId;
    if (serviceId) {
        fetch(`/api/kanban/services/${serviceId}/steps`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps })
        }).catch(error => {
            console.error('Erro ao atualizar ordem das etapas:', error);
            showToast('Erro ao atualizar ordem das etapas', 'error');
        });
    }
}


function applyFilters() {
    const filters = {
        status: document.getElementById('filter-status').value,
        category: document.getElementById('filter-category').value,
        dateRange: {
            start: document.getElementById('filter-start-date').value,
            end: document.getElementById('filter-end-date').value
        }
    };

    // Implementar lógica de filtro
    loadServices(filters);
}

// Atualizar função saveService
async function saveService(event) {
    if (event) event.preventDefault();
    
    try {
        const modal = document.getElementById('new-service-modal');
        const serviceId = modal.dataset.serviceId;
        const method = serviceId ? 'PATCH' : 'POST';
        const url = serviceId ? `/api/kanban/services/${serviceId}/update` : '/api/kanban/services';

        const formData = {
            name: document.getElementById('service-name').value.trim(),
            ticketUrl: document.getElementById('service-ticket').value.trim(),
            category: document.getElementById('service-category').value,
            description: document.getElementById('service-description').value.trim(),
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            serviceStatus: document.getElementById('service-status').value,
            status: modal.dataset.columnId || 'todo',
            steps: collectSteps()
        };

        // Validar campos obrigatórios
        if (!formData.name) {
            throw new Error('Nome do serviço é obrigatório');
        }

        const response = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar serviço');
            } else {
                throw new Error('Erro ao salvar serviço');
            }
        }

        const savedService = await response.json();
        
        // Limpar formulário e fechar modal
        closeModal('new-service-modal');
        
        // Recarregar serviços
        await loadServices();
        
        showToast('Serviço salvo com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        showToast(error.message, 'error');
    }
}

// Adicionar no início do arquivo
document.addEventListener('DOMContentLoaded', function() {
    // Limpar cache de formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.reset());

    // Forçar recarregamento dos dados
    loadServices();
});

// Atualizar função loadServices para evitar cache
async function loadServices() {
    try {
        const response = await fetch('/api/kanban/services', {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao carregar serviços');
            } else {
                throw new Error('Erro ao carregar serviços');
            }
        }

        const services = await response.json();
        
        // Limpar todas as listas
        document.querySelectorAll('.service-list').forEach(list => list.innerHTML = '');
        
        // Distribuir os serviços
        services.forEach(service => {
            const card = createServiceCard(service);
            const targetList = document.getElementById(`${service.status}-list`);
            if (targetList) {
                targetList.appendChild(card);
            }
        });

        updateStatistics();
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showToast(error.message, 'error');
    }
}

function createServiceCard(service) {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.draggable = true;
    card.dataset.id = service._id;
    card.dataset.service = JSON.stringify(service);
    
    // Adicionar classe archived se o serviço estiver arquivado
    if (service.archived) {
        card.classList.add('archived');
    }

    const timerControls = `
        <div class="timer-controls">
            <button class="button is-small" onclick="event.stopPropagation(); toggleTimer('${service._id}')">
                <span class="icon">
                    <i class="fas ${service.timerActive ? 'fa-pause' : 'fa-play'}"></i>
                </span>
            </button>
            <button class="button is-small is-danger" onclick="event.stopPropagation(); finishTimer('${service._id}')" ${service.timerFinished ? 'disabled' : ''}>
                <span class="icon">
                    <i class="fas fa-stop"></i>
                </span>
            </button>
        </div>
    `;

    const dateInfo = `
        <div class="date-info mt-2">
            ${service.startDate ? `
                <span class="tag is-info is-light">
                    <i class="fas fa-calendar-alt mr-1"></i>
                    ${new Date(service.startDate).toLocaleDateString()}
                </span>
            ` : ''}
            ${service.endDate ? `
                <span class="tag is-danger is-light ml-2">
                    <i class="fas fa-calendar-check mr-1"></i>
                    ${new Date(service.endDate).toLocaleDateString()}
                </span>
            ` : ''}
        </div>
    `;

    card.innerHTML = `
        <div class="card-controls">
            <button class="button is-small is-danger" onclick="event.stopPropagation(); deleteService('${service._id}')">
                <span class="icon"><i class="fas fa-trash"></i></span>
            </button>
            <div class="drag-handle">
                <i class="fas fa-grip-vertical"></i>
            </div>
        </div>
        <div class="service-header" onclick="openServiceModal('${service._id}')">
            <h4 class="title is-6">${service.name}</h4>
            <div class="tags">
                <span class="tag ${getStatusClass(service.serviceStatus)}">${service.serviceStatus}</span>
                <span class="tag is-info is-light">${getCategoryLabel(service.category)}</span>
            </div>
            ${dateInfo}
        </div>
        <div class="service-info" onclick="openServiceModal('${service._id}')">
            <p class="subtitle is-7 description-preview">
                ${service.description ? truncateText(service.description, 40) : ''}
            </p>
            <div class="timer-section">
                <div class="timer-display ${service.timerFinished ? 'is-finished' : ''}">${formatTime(service.totalTimeSpent || 0)}</div>
                ${service.timerFinished ? 
                    '<span class="tag is-success">Finalizado</span>' : 
                    timerControls}
            </div>
            <div class="steps-progress">
                <progress class="progress is-info" 
                    value="${getCompletedSteps(service.steps)}" 
                    max="${service.steps.length}">
                </progress>
                <span class="is-size-7">${getCompletedSteps(service.steps)}/${service.steps.length} etapas</span>
            </div>
        </div>
    `;
    
    // Adicionar botão de arquivar/desarquivar apenas no modal
    if (service.archived) {
        card.querySelector('.card-controls').innerHTML += `
            <button class="button is-small is-warning" onclick="event.stopPropagation(); unarchiveService('${service._id}')">
                <span class="icon"><i class="fas fa-box-open"></i></span>
            </button>
        `;
    }

    return card;
}

// Funções auxiliares
function getStatusClass(status) {
    const classes = {
        'planejamento': 'is-info',
        'aguardando': 'is-warning',
        'em_andamento': 'is-primary',
        'pausado': 'is-danger',
        'concluido': 'is-success'
    };
    return classes[status] || 'is-light';
}

function getCompletedSteps(steps) {
    return steps.filter(step => step.status === 'completed').length;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function finishService(serviceId) {
    // Implementação da finalização
}

async function updateStatistics() {
    try {
        const response = await fetch('/api/kanban/statistics');
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        
        const stats = await response.json();
        
        // Atualizar os elementos na UI
        document.getElementById('active-services-count').textContent = stats.activeServices || 0;
        document.getElementById('completed-today').textContent = stats.completedToday || 0;
        document.getElementById('total-time').textContent = formatTime(stats.totalTime || 0);
        document.getElementById('efficiency').textContent = `${stats.efficiency || 0}%`;

        console.log('Estatísticas atualizadas:', stats);
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    initKanban();
    initSortableSteps();
    updateStatistics();
    // Atualizar estatísticas a cada minuto
    setInterval(updateStatistics, 60000);
    initEditableKanbanTitles();
    loadKanbanTitles();
    loadKanbanColumns();
    addFilters();
});

// Adicionar função para fechar o modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('is-active');
    }
}

// Adicionar função para mostrar toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification is-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    
    toast.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function openServiceModal(serviceId) {
    const card = document.querySelector(`[data-id="${serviceId}"]`);
    if (!card) return;

    const service = JSON.parse(card.dataset.service);
    const modal = document.getElementById('new-service-modal');
    modal.dataset.serviceId = serviceId;

    // Atualizar botão de acordo com o estado do serviço
    const archiveButton = `
        <button class="button is-warning archive-button" onclick="${service.archived ? 'unarchiveService' : 'archiveService'}('${serviceId}')">
            <span class="icon">
                <i class="fas fa-${service.archived ? 'box-open' : 'archive'}"></i>
            </span>
            <span>${service.archived ? 'Desarquivar' : 'Arquivar'}</span>
        </button>
    `;

    // Preencher os campos do modal
    document.getElementById('service-name').value = service.name;
    document.getElementById('service-ticket').value = service.ticketUrl || '';
    document.getElementById('service-category').value = service.category;
    document.getElementById('service-description').value = service.description;
    document.getElementById('start-date').value = service.startDate ? new Date(service.startDate).toISOString().split('T')[0] : '';
    document.getElementById('end-date').value = service.endDate ? new Date(service.endDate).toISOString().split('T')[0] : '';
    document.getElementById('service-status').value = service.serviceStatus;

    // Limpar e preencher as etapas
    const stepsContainer = document.getElementById('steps-container');
    stepsContainer.innerHTML = '';
    service.steps.forEach(step => addStepField(step));

    // Adicionar botão de arquivar
    const footer = modal.querySelector('.modal-card-foot');
    footer.innerHTML = archiveButton;

    modal.dataset.columnId = service.status;
    modal.classList.add('is-active');
}

function toggleArchivedSection() {
    const content = document.getElementById('archived-content');
    const icon = document.getElementById('archived-toggle-icon');
    
    content.classList.toggle('is-visible');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

async function archiveService(serviceId) {
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}/archive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Erro ao arquivar serviço');

        const service = await response.json();
        
        // Atualizar o card e mover para arquivados
        const card = document.querySelector(`[data-id="${serviceId}"]`);
        if (card) {
            // Atualizar dados do card
            card.dataset.service = JSON.stringify(service);
            
            // Mover para seção de arquivados
            const archivedList = document.getElementById('archived-list');
            if (archivedList) {
                archivedList.appendChild(card);
                card.classList.add('archived');
                
                // Atualizar o botão no modal
                const archiveButton = document.querySelector('.archive-button');
                if (archiveButton) {
                    archiveButton.innerHTML = `
                        <span class="icon"><i class="fas fa-box-open"></i></span>
                        <span>Desarquivar</span>
                    `;
                    archiveButton.onclick = () => unarchiveService(serviceId);
                }
                
                // Mostrar seção de arquivados
                const archivedContent = document.getElementById('archived-content');
                if (!archivedContent.classList.contains('is-visible')) {
                    toggleArchivedSection();
                }
            }
        }

        closeModal('new-service-modal');
        showToast('Serviço arquivado com sucesso', 'success');
        updateStatistics();
    } catch (error) {
        console.error('Erro ao arquivar serviço:', error);
        showToast('Erro ao arquivar serviço', 'error');
    }
}

async function unarchiveService(serviceId) {
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}/unarchive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Erro ao desarquivar serviço');

        const service = await response.json();
        
        // Remover o card da seção de arquivados
        const card = document.querySelector(`[data-id="${serviceId}"]`);
        if (card) {
            // Atualizar dados do card
            card.dataset.service = JSON.stringify(service);
            card.classList.remove('archived');
            
            // Mover para a lista "A Fazer"
            const todoList = document.getElementById('todo-list');
            if (todoList) {
                todoList.appendChild(card);
            }
        }

        // Recarregar todos os serviços para garantir consistência
        await loadServices();
        
        closeModal('new-service-modal');
        showToast('Serviço desarquivado com sucesso', 'success');
        updateStatistics();
    } catch (error) {
        console.error('Erro ao desarquivar serviço:', error);
        showToast('Erro ao desarquivar serviço', 'error');
    }
}

function initEditableKanbanTitles() {
    document.querySelectorAll('.kanban-title h3').forEach(title => {
        title.addEventListener('dblclick', function() {
            const currentText = this.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input is-small';
            input.value = currentText;
            
            input.addEventListener('blur', function() {
                title.textContent = this.value;
                saveKanbanTitles();
            });
            
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    title.textContent = this.value;
                    saveKanbanTitles();
                }
            });
            
            this.textContent = '';
            this.appendChild(input);
            input.focus();
        });
    });
}

function saveKanbanTitles() {
    const titles = {};
    document.querySelectorAll('.kanban-title h3').forEach(title => {
        const columnId = title.closest('.kanban-column').id;
        titles[columnId] = title.textContent;
    });
    localStorage.setItem('kanbanTitles', JSON.stringify(titles));
}

function loadKanbanTitles() {
    const titles = JSON.parse(localStorage.getItem('kanbanTitles')) || {};
    Object.entries(titles).forEach(([columnId, title]) => {
        const titleElement = document.querySelector(`#${columnId} .kanban-title h3`);
        if (titleElement) {
            titleElement.textContent = title;
        }
    });
}

function renameColumn(button) {
    const titleElement = button.previousElementSibling;
    const currentText = titleElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input is-small';
    input.value = currentText;
    
    input.addEventListener('blur', function() {
        titleElement.textContent = this.value;
        saveKanbanTitles();
    });
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            titleElement.textContent = this.value;
            saveKanbanTitles();
            input.blur();
        }
    });
    
    titleElement.textContent = '';
    titleElement.appendChild(input);
    input.focus();
}

async function deleteService(serviceId) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Erro ao excluir serviço');

        const card = document.querySelector(`[data-id="${serviceId}"]`);
        if (card) card.remove();
        
        showToast('Serviço excluído com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        showToast('Erro ao excluir serviço', 'error');
    }
}

function showNewColumnModal() {
    document.getElementById('new-column-modal').classList.add('is-active');
}

function createNewColumn() {
    const name = document.getElementById('new-column-name').value;
    if (!name) {
        showToast('Nome do quadro é obrigatório', 'warning');
        return;
    }
    
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const board = document.querySelector('.kanban-board');
    if (!board) {
        console.error('Elemento .kanban-board não encontrado');
        return;
    }

    const newColumn = document.createElement('div');
    newColumn.className = 'kanban-column';
    newColumn.id = id;
    newColumn.innerHTML = `
        <div class="kanban-header">
            <div class="kanban-title">
                <i class="fas fa-list-ul"></i>
                <div class="title-controls">
                    <h3 class="title is-5" title="Clique duas vezes para renomear">${name}</h3>
                </div>
            </div>
            <div class="column-controls">
                <button class="add-task-button" onclick="showNewServiceModal('${id}')">
                    <i class="fas fa-plus-circle fa-lg"></i>
                </button>
                <button class="button is-small is-danger" onclick="deleteColumn('${id}')">
                    <span class="icon is-small">
                        <i class="fas fa-trash"></i>
                    </span>
                </button>
            </div>
        </div>
        <div class="service-list" id="${id}-list"></div>
    `;
    
    // Inserir antes do botão de adicionar coluna
    const addColumnButton = document.querySelector('.add-column');
    if (addColumnButton) {
        board.insertBefore(newColumn, addColumnButton);
    } else {
        board.appendChild(newColumn);
    }
    
    // Inicializar Sortable na nova lista
    initKanban();
    
    closeModal('new-column-modal');
    document.getElementById('new-column-name').value = '';
    saveKanbanColumns();
}

function saveKanbanColumns() {
    const columns = Array.from(document.querySelectorAll('.kanban-column:not(.add-column)')).map(column => ({
        id: column.id,
        name: column.querySelector('.kanban-title h3').textContent
    }));
    
    localStorage.setItem('kanbanColumns', JSON.stringify(columns));
}

function loadKanbanColumns() {
    const columns = JSON.parse(localStorage.getItem('kanbanColumns')) || [];
    columns.forEach(column => {
        if (!document.getElementById(column.id)) {
            createNewColumn(column.name);
        }
    });
}

async function deleteColumn(columnId) {
    // Não permitir excluir colunas padrão
    if (['todo', 'in-progress', 'completed'].includes(columnId)) {
        showToast('Não é possível excluir quadros padrão', 'warning');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este quadro? Os serviços serão movidos para "A Fazer"')) {
        return;
    }

    try {
        // Mover todos os serviços deste quadro para "A Fazer"
        const cards = document.querySelectorAll(`#${columnId}-list .service-card`);
        const todoList = document.getElementById('todo-list');
        
        cards.forEach(async (card) => {
            const serviceId = card.dataset.id;
            try {
                await fetch(`/api/kanban/services/${serviceId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'todo' })
                });
                todoList.appendChild(card);
            } catch (error) {
                console.error('Erro ao mover serviço:', error);
            }
        });

        // Remover o quadro
        const column = document.getElementById(columnId);
        column.remove();

        // Remover do select de quadros
        const option = document.querySelector(`#service-board option[value="${columnId}"]`);
        if (option) option.remove();

        // Atualizar configuração dos quadros
        saveKanbanColumns();
        
        showToast('Quadro excluído com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao excluir quadro:', error);
        showToast('Erro ao excluir quadro', 'error');
    }
}

async function moveCardToBoard(serviceId, newStatus) {
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                serviceStatus: newStatus === 'completed' ? 'concluido' : 'em_andamento'
            })
        });

        if (!response.ok) throw new Error('Erro ao mover card');

        const data = await response.json();
        const card = document.querySelector(`[data-id="${serviceId}"]`);
        
        if (card) {
            // Atualizar dados do card
            card.dataset.service = JSON.stringify(data.service);
            
            const targetList = document.getElementById(`${newStatus}-list`);
            if (targetList) {
                targetList.appendChild(card);
                
                // Atualizar contador de concluídos hoje
                if (newStatus === 'completed') {
                    document.getElementById('completed-today').textContent = data.completedToday;
                    updateStatistics();
                }
            }
        }
    } catch (error) {
        console.error('Erro ao mover card:', error);
        showToast('Erro ao mover o card', 'error');
    }
}

// Atualizar initSortableSteps
function initSortableSteps() {
    const container = document.getElementById('steps-container');
    if (!container) return;

    new Sortable(container, {
        animation: 150,
        handle: '.step-handle',
        ghostClass: 'step-ghost',
        onEnd: function() {
            updateStepsOrder();
        }
    });
}

async function finishTimer(serviceId) {
    const card = document.querySelector(`[data-id="${serviceId}"]`);
    if (!card || !card.timer) return;

    if (confirm('Tem certeza que deseja finalizar o timer? Esta ação não pode ser desfeita.')) {
        await card.timer.finish();
        // Recarregar o card para atualizar a interface
        await loadServices();
    }
}

// Adicionar função para obter o label da categoria
function getCategoryLabel(category) {
    const labels = {
        'implantacao': 'Implantação',
        'correcao': 'Correção',
        'melhoria': 'Melhoria',
        'suporte': 'Suporte',
        'outros': 'Outros'
    };
    return labels[category] || category;
}

// Adicionar função para truncar texto
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Adicionar função de filtros
function addFilters() {
    const filterSection = document.createElement('div');
    filterSection.className = 'filters-section mb-4';
    filterSection.innerHTML = `
        <div class="columns is-multiline">
            <div class="column is-one-quarter">
                <div class="field">
                    <label class="label">Categoria</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="filter-category">
                                <option value="">Todas</option>
                                <option value="implantacao">Implantação</option>
                                <option value="correcao">Correção</option>
                                <option value="melhoria">Melhoria</option>
                                <option value="suporte">Suporte</option>
                                <option value="outros">Outros</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="field">
                    <label class="label">Status</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="filter-status">
                                <option value="">Todos</option>
                                <option value="planejamento">Planejamento</option>
                                <option value="em_andamento">Em Andamento</option>
                                <option value="concluido">Concluído</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="field">
                    <label class="label">Data Início</label>
                    <div class="control">
                        <input type="date" id="filter-start-date" class="input">
                    </div>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="field">
                    <label class="label">Data Fim</label>
                    <div class="control">
                        <input type="date" id="filter-end-date" class="input">
                    </div>
                </div>
            </div>
        </div>
        <div class="field is-grouped">
            <div class="control">
                <button class="button is-info" onclick="applyFilters()">
                    <span class="icon">
                        <i class="fas fa-filter"></i>
                    </span>
                    <span>Filtrar</span>
                </button>
            </div>
            <div class="control">
                <button class="button is-light" onclick="clearFilters()">
                    <span class="icon">
                        <i class="fas fa-times"></i>
                    </span>
                    <span>Limpar</span>
                </button>
            </div>
        </div>
    `;

    const kanbanBoard = document.querySelector('.kanban-board');
    kanbanBoard.parentNode.insertBefore(filterSection, kanbanBoard);
}

// Função para aplicar os filtros
async function applyFilters() {
    const category = document.getElementById('filter-category').value;
    const status = document.getElementById('filter-status').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    try {
        const response = await fetch('/api/kanban/services');
        const services = await response.json();

        const filteredServices = services.filter(service => {
            let matches = true;

            if (category && service.category !== category) matches = false;
            if (status && service.serviceStatus !== status) matches = false;
            if (startDate && new Date(service.startDate) < new Date(startDate)) matches = false;
            if (endDate && new Date(service.endDate) > new Date(endDate)) matches = false;

            return matches;
        });

        // Limpar e recarregar cards
        document.querySelectorAll('.service-list').forEach(list => list.innerHTML = '');
        
        filteredServices.forEach(service => {
            const card = createServiceCard(service);
            const targetList = document.getElementById(`${service.status}-list`);
            if (targetList) {
                targetList.appendChild(card);
            }
        });

        updateStatistics();
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        showToast('Erro ao aplicar filtros', 'error');
    }
}

// Função para limpar filtros
function clearFilters() {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    loadServices();
}

