let currentSuggestionId = null; // Variável para armazenar o ID da sugestão atual
let votedSuggestions = new Set(); // Conjunto para armazenar IDs de sugestões já votadas
let currentSort = 'date';
let dateOrder = 'desc';

// Captura o nome do usuário logado a partir do localStorage
const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
const loggedInUser = {
    name: userSettings.userName || 'Usuário Anônimo' // Use 'Usuário Anônimo' se não houver nome
};

async function loadSuggestions() {
    try {
        const response = await fetch('/api/suggestions');
        if (!response.ok) throw new Error('Erro ao buscar sugestões');
        
        const suggestions = await response.json();

        // Atualizar a lista de sugestões em análise e em progresso
        const tbody = document.getElementById('resourcesTable');
        tbody.innerHTML = '';
        
        suggestions.filter(s => s.status === 'pending' || s.status === 'in_progress').forEach((suggestion) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => showSuggestionDetails(suggestion);
            tr.innerHTML = `
                <td>${suggestion.sequentialNumber}</td>
                <td class="content">${marked.parse(suggestion.description)}</td>
                <td>${suggestion.createdBy}</td>
                <td>${new Date(suggestion.createdAt).toLocaleDateString()}</td>
                <td>${suggestion.category}</td>
                <td>
                    <span class="status-tag status-${getStatusClass(suggestion.status)}">
                        <span class="icon">
                            <i class="fas ${getStatusIcon(suggestion.status)}"></i>
                        </span>
                        ${getStatusText(suggestion.status)}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <div class="vote-buttons">
                        <button class="vote-button ${suggestion.votedBy?.find(v => v.userId === 'user123' && v.voteType === 'up') ? 'upvoted' : ''}" 
                                onclick="handleVote('${suggestion._id}', 'up')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <span class="votes-count">${(suggestion.upvotes || 0) - (suggestion.downvotes || 0)}</span>
                        <button class="vote-button ${suggestion.votedBy?.find(v => v.userId === 'user123' && v.voteType === 'down') ? 'downvoted' : ''}" 
                                onclick="handleVote('${suggestion._id}', 'down')">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Atualizar a lista de sugestões implementadas
        const implementedList = document.getElementById('implementedSuggestionList');
        implementedList.innerHTML = '';
        suggestions.filter(s => s.status === 'implemented').forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'box suggestion-item';
            item.innerHTML = `
                <div class="columns is-vcentered">
                    <div class="column">
                        <p class="is-size-5">#${suggestion.sequentialNumber}</p>
                        <div class="content">${marked.parse(suggestion.description)}</div>
                        <p class="is-size-7">
                            <span class="tag is-${getCategoryClass(suggestion.category)}">${suggestion.category}</span>
                            <span class="tag is-${getStatusClass(suggestion.status)}">${getStatusText(suggestion.status)}</span>
                            <span>Solicitante: ${suggestion.createdBy}</span>
                            <span>Criado em: ${new Date(suggestion.createdAt).toLocaleDateString()}</span>
                        </p>
                    </div>
                </div>
            `;
            implementedList.appendChild(item);
        });

        updateSortIcons();
    } catch (error) {
        console.error('Erro:', error);
    }
}

function getStatusIcon(status) {
    const icons = {
        pending: 'fa-clock',
        in_progress: 'fa-spinner fa-spin',
        implemented: 'fa-check-circle'
    };
    return icons[status] || 'fa-question-circle';
}

// Função para mostrar detalhes da sugestão
function showSuggestionDetails(suggestion) {
    currentSuggestionId = suggestion._id;
    
    // Atualizar o conteúdo do modal
    document.getElementById('suggestionDescription').innerHTML = marked.parse(suggestion.description);
    document.getElementById('suggestionCategory').textContent = suggestion.category;
    document.getElementById('suggestionStatus').textContent = getStatusText(suggestion.status);
    document.getElementById('suggestionCreatedBy').textContent = suggestion.createdBy;
    document.getElementById('suggestionDate').textContent = new Date(suggestion.createdAt).toLocaleDateString();
    
    // Configurar a imagem se existir
    const imageElement = document.getElementById('suggestionImage');
    if (suggestion.imageUrl) {
        imageElement.src = suggestion.imageUrl.startsWith('uploads/') ? `/${suggestion.imageUrl}` : `/uploads/${suggestion.imageUrl}`;
        imageElement.style.display = 'block';
    } else {
        imageElement.style.display = 'none';
    }
    
    // Abrir o modal
    const modal = document.getElementById('suggestionModal');
    modal.classList.add('is-active');
    
    // Carregar comentários
    loadComments(suggestion._id);
}

// Função para fechar o modal
function closeSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    modal.classList.remove('is-active');
}

// Função para carregar comentários
async function loadComments(suggestionId) {
    try {
        const response = await fetch(`/api/suggestions/${suggestionId}/comments`);
        if (!response.ok) {
            throw new Error('Erro ao carregar comentários');
        }
        const comments = await response.json();
        const commentsContainer = document.getElementById('commentsContainer');
        commentsContainer.innerHTML = '';

        comments.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            commentDiv.innerHTML = `
                <strong>${comment.author}</strong>: 
                <div class="content">${marked.parse(comment.text)}</div>
                <small>${new Date(comment.createdAt).toLocaleDateString()}</small>
            `;
            commentsContainer.appendChild(commentDiv);
        });
    } catch (error) {
        console.error('Erro ao carregar comentários:', error);
    }
}

// Função para adicionar um novo comentário
async function addComment() {
    const commentText = document.getElementById('newComment').value;
    const author = loggedInUser.name; // Use o nome do usuário logado

    if (!commentText) {
        alert("Por favor, digite um comentário.");
        return;
    }

    try {
        const response = await fetch(`/api/suggestions/${currentSuggestionId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: commentText, author })
        });

        if (!response.ok) {
            throw new Error('Erro ao adicionar comentário');
        }

        document.getElementById('newComment').value = ''; // Limpar o campo de comentário
        loadComments(currentSuggestionId); // Recarregar os comentários
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
    }
}

// Função para lidar com votos
async function handleVote(suggestionId, voteType) {
    try {
        const response = await fetch(`/api/suggestions/${suggestionId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId: 'user123', // Substituir pelo ID real do usuário
                voteType: voteType 
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao processar voto');
        }

        loadSuggestions(); // Recarregar sugestões para atualizar a contagem de votos
    } catch (error) {
        console.error('Erro ao processar voto:', error);
    }
}

async function sortSuggestions(sortBy) {
    if (sortBy === 'date') {
        dateOrder = dateOrder === 'desc' ? 'asc' : 'desc';
        currentSort = dateOrder === 'desc' ? 'date' : '-date';
    } else {
        currentSort = sortBy;
    }

    updateSortIcons();
    await loadSuggestions();
}

function updateSortIcons() {
    const dateSortIcon = document.getElementById('dateSortIcon');
    const votesSortIcon = document.getElementById('votesSortIcon');

    // Limpar ícones
    dateSortIcon.innerHTML = '';
    votesSortIcon.innerHTML = '';

    if (currentSort.includes('date')) {
        dateSortIcon.innerHTML = `<i class="fas fa-sort-${dateOrder === 'desc' ? 'down' : 'up'}"></i>`;
    } else if (currentSort === 'votes') {
        votesSortIcon.innerHTML = '<i class="fas fa-sort-down"></i>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Configurar eventos para fechar o modal
    const closeButtons = document.querySelectorAll('.modal .delete, .modal-background');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.classList.remove('is-active');
            }
        });
    });

    // Carregar sugestões iniciais
    loadSuggestions();
    document.getElementById('filterInput').addEventListener('input', filterTable);
    updateSortIcons();
});

function getStatusClass(status) {
    const classes = {
        pending: 'warning',
        in_progress: 'info',
        implemented: 'success'
    };
    return classes[status] || 'light';
}

function getStatusText(status) {
    const texts = {
        pending: 'Pendente',
        in_progress: 'Em Progresso',
        implemented: 'Implementado'
    };
    return texts[status] || status;
}

function filterTable() {
    const filter = document.getElementById('filterInput').value.toLowerCase();
    const rows = document.querySelectorAll('#resourcesTable tr');
    rows.forEach(row => {
        const description = row.cells[1].textContent.toLowerCase();
        const createdBy = row.cells[2].textContent.toLowerCase();
        if (description.includes(filter) || createdBy.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function getCategoryClass(category) {
    const classes = {
        correcao: 'danger',
        melhoria: 'warning',
        novo: 'info'
    };
    return classes[category] || 'light'; // Retorna 'light' se a categoria não for reconhecida
}

document.addEventListener('DOMContentLoaded', () => {
    // Usar módulo de personalização se disponível
    if (window.personalization) {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        window.personalization.setTheme(theme);
    } else {
        // Fallback para aplicação direta do DaisyUI
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }
});