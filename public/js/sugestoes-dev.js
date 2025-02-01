let currentSuggestionId = null;
let allSuggestions = []; // Variável global para armazenar todas as sugestões

// Função para mostrar mensagens toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `notification is-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '1000';
    toast.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Função para obter a classe CSS da categoria
function getCategoryClass(category) {
    const classes = {
        'correcao': 'danger',
        'melhoria': 'warning',
        'novo': 'info'
    };
    return classes[category] || 'light';
}

// Função para obter a classe CSS do status
function getStatusClass(status) {
    const classes = {
        'pending': 'warning',
        'in_progress': 'info',
        'implemented': 'success'
    };
    return classes[status] || 'light';
}

// Função para carregar as sugestões iniciais
async function loadSuggestions() {
    try {
        const response = await fetch('/api/suggestions');
        if (!response.ok) throw new Error('Erro ao buscar sugestões');
        
        allSuggestions = await response.json();
        updateSuggestionsList(allSuggestions);
        updateStats();
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao carregar sugestões', 'danger');
    }
}

// Função para abrir o modal de status
function openStatusModal(suggestionId) {
    currentSuggestionId = suggestionId;
    const modal = document.getElementById('statusModal');
    modal.classList.add('is-active');
}

// Função para fechar o modal de status
function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('is-active');
}

// Confirmar a alteração de status
document.getElementById('confirmStatusChange').addEventListener('click', async () => {
    const newStatus = document.getElementById('newStatus').value;
    await updateSuggestionStatus(currentSuggestionId, newStatus);
    closeStatusModal();
});

async function updateSuggestionStatus(id, status) {
    try {
        const response = await fetch(`/api/suggestions/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error('Erro ao atualizar status');

        updateStats(); // Recarregar as estatísticas
        showToast('Status atualizado com sucesso', 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao atualizar status', 'danger');
    }
}

// Filtro por status
document.querySelectorAll('.status-tag').forEach(tag => {
    tag.addEventListener('click', function() {
        const selectedStatus = this.getAttribute('data-value');
        // Alternar classe ativa
        this.classList.toggle('is-active');
        
        // Pegar todos os status selecionados
        const selectedStatuses = Array.from(document.querySelectorAll('.status-tag.is-active'))
            .map(tag => tag.getAttribute('data-value'));
        
        // Filtrar sugestões
        updateSuggestionsList(allSuggestions, selectedStatuses);
    });
});

// Filtro por categoria
document.querySelectorAll('.category-tag').forEach(tag => {
    tag.addEventListener('click', function() {
        const selectedCategory = this.getAttribute('data-value');
        // Alternar classe ativa
        this.classList.toggle('is-active');
        
        // Pegar todas as categorias selecionadas
        const selectedCategories = Array.from(document.querySelectorAll('.category-tag.is-active'))
            .map(tag => tag.getAttribute('data-value'));
        
        // Filtrar sugestões
        updateSuggestionsList(allSuggestions, null, selectedCategories);
    });
});

function updateSuggestionsList(suggestions, filterStatus = null, filterCategories = null) {
    const suggestionList = document.getElementById('suggestionList');
    suggestionList.innerHTML = '';

    let filteredSuggestions = suggestions;

    // Filtrar por status
    if (filterStatus && filterStatus.length > 0) {
        filteredSuggestions = filteredSuggestions.filter(s => filterStatus.includes(s.status));
    }

    // Filtrar por categoria
    if (filterCategories && filterCategories.length > 0) {
        filteredSuggestions = filteredSuggestions.filter(s => filterCategories.includes(s.category));
    }

    filteredSuggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'box suggestion-item';
        item.innerHTML = `
            <div class="columns is-vcentered">
                <div class="column" onclick="openStatusModal('${suggestion._id}')">
                    <p class="is-size-5">#${suggestion.sequentialNumber} - ${suggestion.description}</p>
                    <p class="is-size-7">
                        <span class="tag is-${getCategoryClass(suggestion.category)}">${suggestion.category}</span>
                        <span class="tag is-${getStatusClass(suggestion.status)}">${getStatusText(suggestion.status)}</span>
                        <span>Solicitante: ${suggestion.createdBy}</span>
                        <span>Criado em: ${new Date(suggestion.createdAt).toLocaleDateString()}</span>
                    </p>
                </div>
                <div class="column is-narrow">
                    <button class="button is-small is-warning" onclick="openStatusModal('${suggestion._id}')">
                        <span class="icon"><i class="fas fa-edit"></i></span>
                    </button>
                </div>
            </div>
        `;
        suggestionList.appendChild(item);
    });
}

// Função para converter status para texto
function getStatusText(status) {
    const statusMap = {
        'pending': 'Em Análise',
        'in_progress': 'Em Progresso',
        'implemented': 'Implementado'
    };
    return statusMap[status] || status;
}

// Função para atualizar as estatísticas
function updateStats() {
    if (!allSuggestions) return;

    document.getElementById('totalSuggestions').textContent = allSuggestions.length;
    document.getElementById('implementedSuggestions').textContent = 
        allSuggestions.filter(s => s.status === 'implemented').length;
    document.getElementById('pendingSuggestions').textContent = 
        allSuggestions.filter(s => s.status === 'pending').length;
}

// Inicializar a página
document.addEventListener('DOMContentLoaded', () => {
    loadSuggestions();
});

document.getElementById('suggestionForm').addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede o envio padrão do formulário

    try {
        const formData = new FormData();
        formData.append('description', document.getElementById('description').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('createdBy', document.getElementById('createdBy').value);
        
        const imageFile = document.getElementById('imageUpload').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const response = await fetch('/api/suggestions', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar sugestão');
        }

        const result = await response.json();
        showToast('Sugestão enviada com sucesso!', 'success');
        
        // Limpar formulário
        event.target.reset();
        
        // Atualizar lista de sugestões
        updateStats();
    } catch (error) {
        console.error('Erro:', error);
        showToast(error.message, 'danger');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Carregar e aplicar tema salvo
    const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
    if (userSettings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
    }
});