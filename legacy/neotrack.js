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
class Timer {
    constructor(serviceId) {
        this.serviceId = serviceId;
        this.startTime = null;
        this.totalTime = 0; // Em segundos
        this.isRunning = false;
        this.interval = null;
    }

    start(initialTime = 0) {
        if (!this.isRunning) {
            this.totalTime = initialTime; // Inicializar com o tempo salvo anteriormente
            this.startTime = Date.now();
            this.isRunning = true;
            this.interval = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
                const currentTime = this.totalTime + elapsedSeconds;
                this.updateDisplay(currentTime);
            }, 1000);
        }
    }

    stop() {
        if (this.isRunning) {
            clearInterval(this.interval);
            this.isRunning = false;
            const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.totalTime += elapsedSeconds;
            this.startTime = null;
            return this.totalTime;
        }
        return this.totalTime;
    }

    updateDisplay(seconds) {
        const card = document.querySelector(`[data-id="${this.serviceId}"]`);
        if (card) {
            const display = card.querySelector('.timer-display');
            if (display) {
                display.textContent = formatTime(seconds);
            }
        }
    }

    getCurrentTime() {
        if (this.isRunning) {
            const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            return this.totalTime + elapsedSeconds;
        }
        return this.totalTime;
    }
}

// Mapa global para armazenar instâncias de Timer
const timers = new Map();

async function toggleTimer(serviceId) {
    try {
        const card = document.querySelector(`[data-id="${serviceId}"]`);
        if (!card) throw new Error('Card não encontrado');

        const service = JSON.parse(card.dataset.service);
        const isActive = service.timerActive;

        let timer = timers.get(serviceId);
        if (!timer) {
            timer = new Timer(serviceId);
            timers.set(serviceId, timer);
        }

        let timeSpent;
        if (!isActive) {
            // Iniciar timer com o tempo salvo anteriormente
            const savedTime = Math.floor(service.totalTimeSpent || 0);
            timer.start(savedTime);
            timeSpent = savedTime;
        } else {
            timeSpent = timer.stop();
        }

        const response = await fetch(`/api/kanban/services/${serviceId}/timer`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: isActive ? 'stop' : 'start',
                timeSpent: timeSpent
            })
        });

        if (!response.ok) throw new Error('Erro ao atualizar timer');
        
        const updatedService = await response.json();
        card.dataset.service = JSON.stringify(updatedService);

        // Atualizar visual do timer
        const timerButton = card.querySelector('.timer-controls button i');
        if (timerButton) {
            timerButton.className = `fas ${!isActive ? 'fa-pause' : 'fa-play'}`;
        }

        await updateStatistics();
        showToast('Timer atualizado com sucesso', 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao atualizar timer', 'error');
    }
}

// Função para atualizar timer no modal
function updateModalTimer(service) {
    const modal = document.getElementById('service-modal');
    if (modal.classList.contains('is-active')) {
        document.querySelector('.time-spent-field input').value = formatTime(service.totalTimeSpent);
    }
}

function initKanban() {
    const columns = document.querySelectorAll('.kanban-column');
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
                    const oldStatus = evt.from.id.replace('-list', '');
                    
                    if (newStatus === oldStatus) return;
                    
                    try {
                        const response = await fetch(`/api/kanban/services/${serviceId}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                status: newStatus,
                                serviceStatus: getServiceStatus(newStatus)
                            })
                        });

                        if (!response.ok) {
                            evt.from.appendChild(evt.item);
                            throw new Error('Erro ao atualizar status');
                        }
                        
                        const { service } = await response.json();
                        
                        // Atualizar dados do card
                        evt.item.dataset.service = JSON.stringify(service);
                        
                        // Atualizar status visual usando a função atualizada
                        updateCardStatus(evt.item, newStatus);
                        
                        showToast('Status atualizado com sucesso', 'success');
                        await updateStatistics();
                    } catch (error) {
                        console.error('Erro:', error);
                        showToast('Erro ao mover o card', 'error');
                    }
                }
            });
        }
    });
}

function getServiceStatus(status) {
    // Mapear status personalizados para os status padrão mais próximos
    const statusMap = {
        'todo': 'planejamento',
        'in-progress': 'em_andamento',
        'completed': 'concluido'
    };
    
    return statusMap[status] || 'planejamento';
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
    event.preventDefault();
    
    try {
        const formData = new FormData();
        const files = document.getElementById('service-attachments').files;
        
        // Adicionar dados do serviço
        const serviceData = {
            name: document.getElementById('service-name').value,
            description: document.getElementById('service-description').value,
            // ... outros campos ...
        };
        
        formData.append('service', JSON.stringify(serviceData));
        
        // Adicionar arquivos
        Array.from(files).forEach(file => {
            formData.append('attachments', file);
        });
        
        const url = serviceId ? 
            `/api/kanban/services/${serviceId}/update` : 
            '/api/kanban/services';
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro ao salvar serviço');
        
        const result = await response.json();
        showToast('Serviço salvo com sucesso', 'success');
        closeModal('new-service-modal');
        loadServices();
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao salvar serviço', 'error');
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

// Atualizar função loadServices
async function loadServices() {
    try {
        const response = await fetch('/api/kanban/services');
        if (!response.ok) throw new Error('Erro ao carregar serviços');
        
        const services = await response.json();
        
        // Limpar todas as listas
        document.querySelectorAll('.service-list').forEach(list => list.innerHTML = '');
        
        // Distribuir serviços
        services.forEach(service => {
            const card = createServiceCard(service);
            // Verificar se é uma coluna customizada
            const targetList = document.getElementById(`${service.status}-list`) || 
                             document.querySelector(`#${service.status}-list`);
            
            if (targetList) {
                targetList.appendChild(card);
            } else {
                // Se não encontrar a lista, mover para 'todo'
                const todoList = document.getElementById('todo-list');
                if (todoList) {
                    service.status = 'todo';
                    card.dataset.service = JSON.stringify(service);
                    todoList.appendChild(card);
                }
            }
        });
        
        updateStatistics();
    } catch (error) {
        console.error('Erro:', error);
        showToast(error.message, 'error');
    }
}

// Função para truncar título
function truncateTitle(title, maxLength = 30) {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
}

// Atualizar a função que cria o card
function createServiceCard(service) {
    const card = document.createElement('div');
    
    // Verificar se está atrasado
    const now = new Date();
    const endDate = service.endDate ? new Date(service.endDate) : null;
    const isDelayed = endDate && now > endDate && service.status !== 'completed';
    
    card.className = `service-card ${isDelayed ? 'is-delayed' : ''} ${service.archived ? 'archived' : ''}`;
    card.draggable = true;
    card.dataset.id = service._id;
    card.dataset.service = JSON.stringify(service);
    
    // Adicionar badge de atraso
    const delayBadgeHtml = isDelayed ? `
        <div class="delay-badge">
            <span class="icon">
                <i class="fas fa-exclamation-circle"></i>
            </span>
            <span>Atrasado</span>
        </div>
    ` : '';

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

    const timeSpentField = `
        <div class="time-spent-field">
            <label class="label">
                <i class="fas fa-clock mr-2"></i>
                Tempo Total
            </label>
            <div class="control">
                <input class="input" type="text" value="${formatTime(service.totalTimeSpent || 0)}" readonly>
            </div>
            <div class="time-history mt-2">
                <button class="button is-small is-info" onclick="event.preventDefault(); showTimeHistory('${service._id}', event)">
                    <span class="icon"><i class="fas fa-history"></i></span>
                    <span>Ver Histórico</span>
                </button>
            </div>
        </div>
    `;

    card.innerHTML = `
        ${delayBadgeHtml}
        <div class="card-controls">
            <button class="button is-small is-danger" onclick="event.stopPropagation(); deleteService('${service._id}')">
                <span class="icon"><i class="fas fa-trash"></i></span>
            </button>
            <div class="drag-handle">
                <i class="fas fa-grip-vertical"></i>
            </div>
        </div>
        <div class="service-header" onclick="openServiceModal('${service._id}')">
            <h4 class="title is-6" title="${service.name}">${truncateTitle(service.name)}</h4>
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
        ${timeSpentField}
    `;
    
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

function formatTime(milliseconds) {
    if (!milliseconds) return '00:00:00';
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function finishService(serviceId) {
    // Implementação da finalização
}

async function updateStatistics(period = 'all') {
    try {
        const response = await fetch(`/api/kanban/statistics?period=${period}`);
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        
        const stats = await response.json();
        
        document.getElementById('active-services-count').textContent = stats.activeServices;
        document.getElementById('completed-today').textContent = stats.completedToday;
        document.getElementById('total-time').textContent = formatTime(stats.totalTime);
        document.getElementById('efficiency').textContent = `${stats.efficiency}%`;
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await loadServices();
    initKanban();
    initSortableSteps();
    updateStatistics('all');
    setInterval(updateStatistics, 60000);
    initEditableKanbanTitles();
    loadKanbanTitles();
    loadKanbanColumns();
    addFilters();
    initializeTabs();
    initializeCardLimits();
    initCharCounters();
    cleanupInvalidColumns();
    ensureDefaultColumns();
    restoreActiveTimers();
    addPeriodSelector();
});

// Adicionar função para fechar o modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('is-active');
        // Limpar campos se necessário
        if (modalId === 'new-column-modal') {
            const input = document.getElementById('new-column-name');
            if (input) input.value = '';
        }
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

    // Atualizar footer do modal
    const footer = modal.querySelector('.modal-card-foot');
    footer.innerHTML = `
        <button class="button is-success" onclick="saveService(event)">Salvar</button>
        <button class="button" onclick="closeModal('new-service-modal')">Cancelar</button>
    `;

    modal.dataset.columnId = service.status;
    modal.classList.add('is-active');

    // Atualizar tempo total
    document.getElementById('service-total-time').textContent = formatTime(service.totalTimeSpent || 0);
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
    const titles = document.querySelectorAll('.kanban-title h3');
    titles.forEach(title => {
        title.addEventListener('dblclick', function() {
            const currentText = this.textContent.trim();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentText;
            input.className = 'input is-small';
            this.replaceWith(input);
            input.focus();

            input.addEventListener('blur', function() {
                const h3 = document.createElement('h3');
                h3.textContent = this.value || currentText;
                this.replaceWith(h3);
            });
        });
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

function ensureDefaultColumns() {
    const defaultColumns = [
        { id: 'todo', name: 'A Fazer', icon: 'fa-list' },
        { id: 'in-progress', name: 'Em Andamento', icon: 'fa-tasks' },
        { id: 'completed', name: 'Concluído', icon: 'fa-check-circle' }
    ];

    const board = document.querySelector('.kanban-board');
    if (!board) return;

    defaultColumns.forEach(column => {
        if (!document.getElementById(column.id)) {
            const newColumn = document.createElement('div');
            newColumn.className = 'kanban-column';
            newColumn.id = column.id;
            newColumn.innerHTML = `
                <div class="kanban-header">
                    <div class="kanban-title">
                        <i class="fas ${column.icon}"></i>
                        <div class="title-controls">
                            <h3 class="title is-5" title="Clique duas vezes para renomear">${column.name}</h3>
                        </div>
                    </div>
                    <div class="column-controls">
                        <button class="add-task-button" onclick="showNewServiceModal('${column.id}')">
                            <i class="fas fa-plus-circle fa-lg"></i>
                        </button>
                    </div>
                </div>
                <div class="service-list" id="${column.id}-list"></div>
            `;
            board.appendChild(newColumn);
            
            const titleElement = newColumn.querySelector('.kanban-title h3');
            makeEditable(titleElement);
        }
    });

    // Adicionar botão de novo quadro se não existir
    if (!document.querySelector('.add-column')) {
        const addButton = document.createElement('div');
        addButton.className = 'add-column';
        addButton.innerHTML = `
            <button class="button is-primary" onclick="openModal('new-column-modal')">
                <span class="icon">
                    <i class="fas fa-plus"></i>
                </span>
                <span>Novo Quadro</span>
            </button>
        `;
        board.appendChild(addButton);
    }
}

// Função para tornar o título editável
function makeEditable(element) {
    element.addEventListener('dblclick', function() {
        const currentText = this.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'input is-small';
        
        input.onblur = function() {
            element.textContent = this.value;
            saveKanbanColumns();
        };
        
        input.onkeypress = function(e) {
            if (e.key === 'Enter') {
                element.textContent = this.value;
                saveKanbanColumns();
                input.blur();
            }
        };
        
        this.textContent = '';
        this.appendChild(input);
        input.focus();
    });
}

// Função para criar novo quadro usando o modal
function createNewColumn() {
    const name = document.getElementById('new-column-name')?.value;
    if (!name && document.getElementById('new-column-modal')?.classList.contains('is-active')) {
        showToast('Nome do quadro é obrigatório', 'warning');
        return;
    }
    
    // Gerar ID único para o quadro
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const id = `column-${timestamp}-${randomStr}`;
    
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
    
    // Tornar o título editável
    const titleElement = newColumn.querySelector('.kanban-title h3');
    makeEditable(titleElement);
    
    // Inicializar Sortable na nova lista
    initKanban();
    
    closeModal('new-column-modal');
    document.getElementById('new-column-name').value = '';
    
    // Salvar configuração dos quadros
    saveKanbanColumns();
    showToast('Quadro criado com sucesso', 'success');
}

// Função para salvar configuração dos quadros
function saveKanbanColumns() {
    const columns = document.querySelectorAll('.kanban-column');
    const config = Array.from(columns).map(column => {
        // Ignorar o botão de adicionar coluna
        if (column.classList.contains('add-column')) return null;
        
        return {
            id: column.id,
            name: column.querySelector('.kanban-title h3')?.textContent || '',
            order: Array.from(column.parentNode.children).indexOf(column)
        };
    }).filter(Boolean); // Remover null values
    
    localStorage.setItem('kanbanColumns', JSON.stringify(config));
}

// Função para carregar configuração dos quadros
function loadKanbanColumns() {
    try {
        const savedConfig = localStorage.getItem('kanbanColumns');
        if (!savedConfig) return;
        
        const config = JSON.parse(savedConfig);
        const board = document.querySelector('.kanban-board');
        const addColumnButton = document.querySelector('.add-column');
        
        config.forEach(column => {
            // Não recriar colunas padrão
            if (['todo', 'in-progress', 'completed'].includes(column.id)) return;
            
            // Verificar se a coluna já existe
            if (!document.getElementById(column.id)) {
                const newColumn = document.createElement('div');
                newColumn.className = 'kanban-column';
                newColumn.id = column.id;
                newColumn.innerHTML = `
                    <div class="kanban-header">
                        <div class="kanban-title">
                            <i class="fas fa-list-ul"></i>
                            <div class="title-controls">
                                <h3 class="title is-5" title="Clique duas vezes para renomear">${column.name}</h3>
                            </div>
                        </div>
                        <div class="column-controls">
                            <button class="add-task-button" onclick="showNewServiceModal('${column.id}')">
                                <i class="fas fa-plus-circle fa-lg"></i>
                            </button>
                            <button class="button is-small is-danger" onclick="deleteColumn('${column.id}')">
                                <span class="icon is-small">
                                    <i class="fas fa-trash"></i>
                                </span>
                            </button>
                        </div>
                    </div>
                    <div class="service-list" id="${column.id}-list"></div>
                `;
                
                // Inserir antes do botão de adicionar coluna
                if (addColumnButton) {
                    board.insertBefore(newColumn, addColumnButton);
                } else {
                    board.appendChild(newColumn);
                }
                
                // Tornar o título editável
                const titleElement = newColumn.querySelector('.kanban-title h3');
                makeEditable(titleElement);
            }
        });
        
        // Reinicializar Sortable nas novas listas
        initKanban();
    } catch (error) {
        console.error('Erro ao carregar configuração dos quadros:', error);
    }
}

async function deleteColumn(columnId) {
    try {
        // Não permitir excluir colunas padrão
        if (['todo', 'in-progress', 'completed'].includes(columnId)) {
            showToast('Não é possível excluir quadros padrão', 'warning');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir este quadro? Os serviços serão movidos para "A Fazer"')) {
            return;
        }

        const column = document.getElementById(columnId);
        if (!column) {
            console.error('Coluna não encontrada:', columnId);
            cleanupInvalidColumns(); // Limpar quadros inválidos
            return;
        }

        // Mover todos os serviços para "A Fazer"
        const cards = column.querySelectorAll('.service-card');
        const todoList = document.getElementById('todo-list');
        
        for (const card of cards) {
            const serviceId = card.dataset.id;
            try {
                await fetch(`/api/kanban/services/${serviceId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'todo' })
                });
                if (todoList) {
                    todoList.appendChild(card);
                }
            } catch (error) {
                console.error('Erro ao mover serviço:', error);
            }
        }

        // Remover a coluna
        column.remove();
        showToast('Quadro excluído com sucesso', 'success');
        
        // Atualizar configuração dos quadros
        saveKanbanColumns();
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
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Erro ao atualizar status');
        
        showToast('Card movido com sucesso', 'success');
        // Recarregar todos os serviços
        await loadServices();
        await updateStatistics();
    } catch (error) {
        console.error('Erro ao mover card:', error);
        showToast('Não foi possível mover o card', 'error');
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

// Adicionar função para gerenciar abas
function initializeTabs() {
    const tabs = document.querySelectorAll('.tabs li');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remover classe ativa de todas as abas
            tabs.forEach(t => t.classList.remove('is-active'));
            // Adicionar classe ativa na aba clicada
            tab.classList.add('is-active');
            
            // Esconder todos os conteúdos
            contents.forEach(content => content.style.display = 'none');
            // Mostrar conteúdo da aba selecionada
            const targetId = `tab-${tab.querySelector('a').dataset.tab}`;
            document.getElementById(targetId).style.display = 'block';
        });
    });
}

// Adicionar função para controlar visualização de cards
function addCardLimitControl(columnId) {
    const column = document.getElementById(columnId);
    if (!column) return;

    const header = column.querySelector('.kanban-header');
    const select = document.createElement('select');
    select.className = 'select is-small';
    select.innerHTML = `
        <option value="all">Todos</option>
        <option value="5">5 cards</option>
        <option value="10">10 cards</option>
        <option value="15">15 cards</option>
    `;

    select.addEventListener('change', (e) => {
        const limit = e.target.value;
        const cards = column.querySelectorAll('.service-card');
        cards.forEach((card, index) => {
            if (limit === 'all' || index < parseInt(limit)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });

    const controlDiv = document.createElement('div');
    controlDiv.className = 'column-control';
    controlDiv.appendChild(select);
    header.appendChild(controlDiv);
}

// Inicializar controles em todas as colunas
function initializeCardLimits() {
    ['todo', 'in-progress', 'completed', 'archived'].forEach(columnId => {
        addCardLimitControl(columnId);
    });
}

// Adicionar seletor de período após as estatísticas
function addPeriodSelector() {
    const statsSection = document.querySelector('.section');
    const selector = document.createElement('div');
    selector.className = 'field has-addons is-justify-content-center mb-4';
    selector.innerHTML = `
        <p class="control">
            <button class="button" data-period="day">
                <span>Hoje</span>
            </button>
        </p>
        <p class="control">
            <button class="button" data-period="week">
                <span>Esta Semana</span>
            </button>
        </p>
        <p class="control">
            <button class="button is-info is-selected" data-period="all">
                <span>Todo Período</span>
            </button>
        </p>
    `;
    
    statsSection.insertBefore(selector, statsSection.firstChild);
    
    // Adicionar eventos aos botões
    selector.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            selector.querySelectorAll('button').forEach(b => {
                b.classList.remove('is-info', 'is-selected');
            });
            button.classList.add('is-info', 'is-selected');
            updateStatistics(button.dataset.period);
        });
    });
}

function initCharCounters() {
    // Contador para descrição
    const textarea = document.getElementById('service-description');
    const descCounter = document.getElementById('char-counter');
    
    if (textarea && descCounter) {
        const descMaxLength = parseInt(textarea.getAttribute('maxlength')) || 500;
        
        function updateDescCounter() {
            const currentLength = textarea.value.length;
            descCounter.textContent = `${currentLength}/${descMaxLength}`;
            
            if (currentLength >= descMaxLength) {
                descCounter.classList.add('is-danger');
            } else if (currentLength >= descMaxLength * 0.8) {
                descCounter.classList.add('is-warning');
            } else {
                descCounter.classList.remove('is-danger', 'is-warning');
            }
        }
        
        textarea.addEventListener('input', updateDescCounter);
        updateDescCounter();
    }

    // Contador para nome
    const nameInput = document.getElementById('service-name');
    const nameCounter = document.getElementById('name-char-counter');
    
    if (nameInput && nameCounter) {
        const nameMaxLength = parseInt(nameInput.getAttribute('maxlength')) || 30;
        
        function updateNameCounter() {
            const currentLength = nameInput.value.length;
            nameCounter.textContent = `${currentLength}/${nameMaxLength}`;
            
            if (currentLength >= nameMaxLength) {
                nameCounter.classList.add('is-danger');
            } else if (currentLength >= nameMaxLength * 0.8) {
                nameCounter.classList.add('is-warning');
            } else {
                nameCounter.classList.remove('is-danger', 'is-warning');
            }
        }
        
        nameInput.addEventListener('input', updateNameCounter);
        updateNameCounter();
    }
}

function updateCardStatus(card, newStatus) {
    const statusTag = card.querySelector('.status-tag');
    if (statusTag) {
        // Primeiro, tentar mapear para um status padrão
        let mappedStatus = newStatus;
        if (newStatus.startsWith('column-')) {
            // Se for uma coluna customizada, mapear para 'in-progress'
            mappedStatus = 'in-progress';
        }

        const statusMap = {
            'todo': { text: 'A Fazer', class: 'is-info' },
            'in-progress': { text: 'Em Andamento', class: 'is-warning' },
            'completed': { text: 'Concluído', class: 'is-success' }
        };
        
        const status = statusMap[mappedStatus] || statusMap['in-progress']; // Usar 'Em Andamento' como padrão
        
        // Remover todas as classes existentes
        statusTag.className = '';
        // Adicionar classes base
        statusTag.classList.add('tag', 'status-tag');
        // Adicionar classe de status
        statusTag.classList.add(status.class);
        
        statusTag.textContent = status.text;
    }
}

// Função para limpar quadros inválidos
function cleanupInvalidColumns() {
    const defaultColumnIds = ['todo', 'in-progress', 'completed'];
    const columns = document.querySelectorAll('.kanban-column');
    
    columns.forEach(column => {
        // Não remover quadros padrão
        if (defaultColumnIds.includes(column.id)) return;
        
        // Verificar se o quadro tem ID e título válidos
        const title = column.querySelector('.kanban-title h3');
        if (!column.id || !title || !title.textContent.trim()) {
            column.remove();
        }
    });
    
    // Garantir que os quadros padrão existam
    ensureDefaultColumns();
    saveKanbanColumns();
}

// Função para abrir modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('is-active');
    }
}

// Adicionar função para restaurar timers ativos após refresh
function restoreActiveTimers() {
    const cards = document.querySelectorAll('.service-card');
    cards.forEach(card => {
        try {
            const service = JSON.parse(card.dataset.service);
            if (service.timerActive) {
                const timer = new Timer(service._id);
                timer.start(Math.floor(service.totalTimeSpent || 0));
                timers.set(service._id, timer);
            }
        } catch (error) {
            console.error('Erro ao restaurar timer:', error);
        }
    });
}

function showTimeHistory(serviceId, event) {
    // Prevenir qualquer propagação de evento
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // Criar um modal isolado
    const modalId = `time-history-${serviceId}`;
    let modal = document.getElementById(modalId);
    
    if (modal) {
        modal.remove();
    }

    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Histórico de Tempo</p>
                <button class="delete" aria-label="close"></button>
            </header>
            <section class="modal-card-body">
                <div id="time-history-content-${serviceId}">
                    <div class="is-loading">Carregando...</div>
                </div>
            </section>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar eventos isolados
    modal.querySelector('.delete').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.modal-background').addEventListener('click', () => {
        modal.remove();
    });
    
    // Prevenir propagação de eventos
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    modal.classList.add('is-active');
    loadTimeHistory(serviceId);
}

async function loadTimeHistory(serviceId) {
    try {
        const response = await fetch(`/api/kanban/services/${serviceId}/time-history`);
        if (!response.ok) throw new Error('Erro ao carregar histórico');
        
        const history = await response.json();
        const content = document.getElementById(`time-history-content-${serviceId}`);
        
        if (!history.entries || history.entries.length === 0) {
            content.innerHTML = '<p class="has-text-centered">Nenhum registro encontrado</p>';
            return;
        }

        content.innerHTML = history.entries.map(entry => `
            <div class="box">
                <div class="columns is-mobile">
                    <div class="column">
                        <p class="is-size-7">${new Date(entry.date).toLocaleString()}</p>
                        <p class="has-text-weight-bold">${formatTime(entry.duration)}</p>
                    </div>
                    <div class="column has-text-right">
                        <span class="tag ${entry.action === 'start' ? 'is-success' : 'is-warning'}">
                            ${entry.action === 'start' ? 'Início' : entry.action === 'stop' ? 'Pausa' : 'Reset'}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showToast('Erro ao carregar histórico', 'error');
    }
}

