class LearningCenter {
    constructor() {
        this.modulesContainer = document.getElementById('learning-modules');
        this.progressContainer = document.getElementById('user-progress');
        this.achievementsContainer = document.getElementById('achievements');
        
        if (!this.modulesContainer || !this.progressContainer || !this.achievementsContainer) {
            console.error('Elementos necessários não encontrados');
            return;
        }

        this.init();
    }

    async init() {
        try {
            // Carregar módulos primeiro
            await this.loadModules();
            
            // Carregar dados do usuário em paralelo
            await Promise.all([
                this.loadProgress(),
                this.loadAchievements()
            ]);
        } catch (error) {
            console.error('Erro ao inicializar central de aprendizado:', error);
            this.showError('Erro ao carregar dados da central de aprendizado');
        }
    }

    async loadModules() {
        try {
            const response = await fetch('/api/learning/modules', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const modules = await response.json();

            if (!Array.isArray(modules)) {
                throw new Error('Dados de módulos inválidos');
            }

            if (modules.length === 0) {
                this.modulesContainer.innerHTML = `
                    <div class="column is-12">
                        <div class="notification is-info">
                            Nenhum módulo disponível no momento.
                        </div>
                    </div>
                `;
                return;
            }

            this.modulesContainer.innerHTML = modules.map(module => `
                <div class="column is-4">
                    <div class="card">
                        <div class="card-content">
                            <p class="title is-4">${module.title || 'Sem título'}</p>
                            <p class="subtitle is-6">${module.description || 'Sem descrição'}</p>
                            
                            <div class="content">
                                ${module.estimatedTime ? `
                                    <p><strong>Duração estimada:</strong> ${module.estimatedTime} minutos</p>
                                ` : ''}
                                ${module.level ? `
                                    <p><strong>Nível:</strong> ${module.level}</p>
                                ` : ''}
                            </div>
                        </div>
                        <footer class="card-footer">
                            <a href="/learn/${module.id}" class="card-footer-item">
                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas fa-book-reader"></i>
                                    </span>
                                    <span>Acessar</span>
                                </span>
                            </a>
                        </footer>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            this.modulesContainer.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-danger">
                        <p>Erro ao carregar módulos de aprendizado</p>
                        <p class="is-size-7">${error.message}</p>
                    </div>
                </div>
            `;
        }
    }

    async loadProgress() {
        try {
            const response = await fetch('/api/learning/progress', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Progresso ainda não iniciado
                    this.progressContainer.innerHTML = `
                        <div class="notification is-info is-light">
                            Você ainda não iniciou nenhum módulo.
                        </div>
                    `;
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const progress = await response.json();

            this.progressContainer.innerHTML = `
                <div class="content">
                    <p><strong>Módulos Completados:</strong> ${progress.completedModules || 0}</p>
                    <p><strong>Tempo Total de Estudo:</strong> ${progress.totalTime || 0} minutos</p>
                    <progress class="progress is-info" 
                              value="${progress.overallProgress || 0}" 
                              max="100">
                        ${progress.overallProgress || 0}%
                    </progress>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao carregar progresso:', error);
            this.progressContainer.innerHTML = `
                <div class="notification is-warning is-light">
                    Não foi possível carregar seu progresso no momento.
                </div>
            `;
        }
    }

    async loadAchievements() {
        try {
            const response = await fetch('/api/learning/achievements', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    this.achievementsContainer.innerHTML = `
                        <div class="notification is-info is-light">
                            Continue estudando para desbloquear conquistas!
                        </div>
                    `;
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const achievements = await response.json();

            if (!Array.isArray(achievements)) {
                throw new Error('Dados de conquistas inválidos');
            }

            if (achievements.length === 0) {
                this.achievementsContainer.innerHTML = `
                    <div class="notification is-info is-light">
                        Nenhuma conquista disponível no momento.
                    </div>
                `;
                return;
            }

            this.achievementsContainer.innerHTML = achievements.map(achievement => `
                <div class="achievement-item mb-3">
                    <span class="icon-text">
                        <span class="icon ${achievement.unlocked ? 'has-text-success' : 'has-text-grey'}">
                            <i class="fas ${achievement.unlocked ? 'fa-unlock' : 'fa-lock'}"></i>
                        </span>
                        <span>${achievement.name}</span>
                    </span>
                    <p class="help">${achievement.description}</p>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar conquistas:', error);
            this.achievementsContainer.innerHTML = `
                <div class="notification is-warning is-light">
                    Não foi possível carregar suas conquistas no momento.
                </div>
            `;
        }
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification is-danger';
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;
        
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });
        
        document.querySelector('.container').prepend(notification);
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('learningContent');
    
    try {
        // Verificar se o usuário está autenticado
        const response = await fetch('/api/auth/check', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });
        
        if (!response.ok) {
            window.location.href = '/pages/login.html';
            return;
        }

        const data = await response.json();

        if (!data.isAuthenticated || !data.user) {
            window.location.href = '/pages/login.html';
            return;
        }

        // Verificar se é admin de forma segura
        const isAdmin = data.user.userRoles && Array.isArray(data.user.userRoles) &&
                       data.user.userRoles.some(role => role.name === 'admin');
        
        // Carregar conteúdo apropriado
        if (isAdmin) {
            container.innerHTML = `
                <div class="columns">
                    <div class="column is-12">
                        <h1 class="title">Central de Aprendizado - Administração</h1>
                        <div class="buttons">
                            <a href="/admin/learning/modules" class="button is-primary">
                                <span class="icon">
                                    <i class="fas fa-cog"></i>
                                </span>
                                <span>Gerenciar Módulos</span>
                            </a>
                            <a href="/admin/learning/stats" class="button is-info">
                                <span class="icon">
                                    <i class="fas fa-chart-bar"></i>
                                </span>
                                <span>Estatísticas</span>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Inicializar a central de aprendizado para usuários normais
            new LearningCenter();
        }
    } catch (error) {
        console.error('Erro:', error);
        container.innerHTML = `
            <div class="notification is-danger">
                <p>Erro ao carregar conteúdo</p>
                <p class="is-size-7">${error.message}</p>
            </div>
        `;
    }
}); 