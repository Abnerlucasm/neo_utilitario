/**
 * Script para corrigir a estrutura de um módulo diretamente no navegador
 */
class ModuleFixer {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
    }

    async fix() {
        try {
            console.group('🔧 Correção de Módulo');
            console.log('ID do módulo:', this.moduleId);
            
            // 1. Buscar o módulo
            const module = await this.fetchModule();
            console.log('Dados originais do módulo:', module);
            
            // 2. Corrigir a estrutura
            const fixedModule = this.fixModuleStructure(module);
            console.log('Dados corrigidos do módulo:', fixedModule);
            
            // 3. Salvar as alterações
            if (this.hasChanges(module, fixedModule)) {
                const saved = await this.saveModule(fixedModule);
                console.log('Módulo salvo com sucesso:', saved);
                alert('Módulo corrigido com sucesso! Recarregue a página para ver as alterações.');
            } else {
                console.log('Nenhuma alteração necessária.');
                alert('O módulo já está com a estrutura correta. Nenhuma alteração foi necessária.');
            }
            
            console.groupEnd();
            return true;
        } catch (error) {
            console.error('❌ Erro ao corrigir módulo:', error);
            alert(`Erro ao corrigir o módulo: ${error.message}`);
            console.groupEnd();
            return false;
        }
    }

    async fetchModule() {
        const response = await fetch(`/api/learning/modules/${this.moduleId}`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar módulo: ${response.status}`);
        }
        return await response.json();
    }

    fixModuleStructure(module) {
        // Clonar para não modificar o original
        const fixedModule = JSON.parse(JSON.stringify(module));
        let changesMade = 0;
        
        // 1. Verificar conteúdo
        if (!fixedModule.content || typeof fixedModule.content !== 'object') {
            console.warn('Conteúdo inválido, criando objeto vazio');
            fixedModule.content = {};
            changesMade++;
        }
        
        // 2. Verificar seções
        if (!Array.isArray(fixedModule.sections)) {
            console.warn('Seções inválidas, criando array vazio');
            fixedModule.sections = [];
            changesMade++;
        }
        
        // 3. Corrigir objetos como IDs de página nas seções
        if (Array.isArray(fixedModule.sections)) {
            fixedModule.sections = fixedModule.sections.map(section => {
                if (!section || typeof section !== 'object') {
                    console.warn('Seção inválida encontrada, corrigindo');
                    changesMade++;
                    return {
                        id: this.generateId(),
                        title: 'Seção corrigida',
                        pages: []
                    };
                }
                
                // Garantir que a seção tenha um ID
                if (!section.id) {
                    console.warn('Seção sem ID, adicionando ID');
                    section.id = this.generateId();
                    changesMade++;
                }
                
                // Garantir que a seção tenha um título
                if (!section.title) {
                    console.warn('Seção sem título, adicionando título padrão');
                    section.title = 'Seção sem título';
                    changesMade++;
                }
                
                // Verificar páginas da seção
                if (!Array.isArray(section.pages)) {
                    console.warn(`Seção ${section.title} sem array de páginas válido, corrigindo`);
                    section.pages = [];
                    changesMade++;
                } else {
                    // Filtrar e corrigir páginas
                    const originalLength = section.pages.length;
                    const fixedPages = section.pages.filter(pageId => {
                        // Se for um objeto
                        if (typeof pageId === 'object') {
                            // Se o objeto tiver uma propriedade id, usar essa propriedade
                            if (pageId && pageId.id && (typeof pageId.id === 'string' || typeof pageId.id === 'number')) {
                                console.warn(`Encontrado objeto como ID de página com propriedade id: ${pageId.id}`);
                                return true;
                            }
                            console.warn('Encontrado objeto inválido como ID de página, removendo');
                            return false;
                        }
                        return true;
                    }).map(pageId => {
                        // Converter objetos com id para string
                        if (typeof pageId === 'object' && pageId && pageId.id) {
                            return String(pageId.id);
                        }
                        return pageId;
                    });
                    
                    if (originalLength !== fixedPages.length) {
                        console.warn(`Removidas ${originalLength - fixedPages.length} páginas inválidas da seção ${section.title}`);
                        changesMade++;
                    }
                    
                    section.pages = fixedPages;
                }
                
                return section;
            });
        }
        
        // 4. Verificar e criar conteúdo padrão para páginas que não existem
        if (Array.isArray(fixedModule.sections) && fixedModule.content) {
            let missingPages = 0;
            
            // Para cada seção
            fixedModule.sections.forEach(section => {
                if (Array.isArray(section.pages)) {
                    // Para cada página na seção
                    section.pages.forEach(pageId => {
                        // Verificar se a página existe no conteúdo
                        if (!fixedModule.content[pageId]) {
                            console.warn(`Página ${pageId} na seção "${section.title}" não encontrada no conteúdo, criando conteúdo padrão`);
                            
                            // Criar conteúdo padrão para a página
                            fixedModule.content[pageId] = {
                                title: `Página ${missingPages + 1} - ${section.title}`,
                                content: `# Página ${missingPages + 1} - ${section.title}\n\nEste é um conteúdo padrão criado automaticamente. Você pode editar esta página para adicionar seu próprio conteúdo.`
                            };
                            
                            missingPages++;
                            changesMade++;
                        }
                    });
                }
            });
            
            console.log(`Criado conteúdo padrão para ${missingPages} páginas ausentes`);
        }
        
        // 5. Se o módulo não tem seções, criar uma seção padrão com uma página
        if (Array.isArray(fixedModule.sections) && fixedModule.sections.length === 0) {
            console.warn('Módulo sem seções, criando seção padrão com uma página');
            
            // Gerar ID para a página
            const pageId = this.generateId();
            
            // Criar seção padrão
            fixedModule.sections.push({
                id: this.generateId(),
                title: 'Introdução',
                pages: [pageId]
            });
            
            // Criar conteúdo padrão para a página
            fixedModule.content[pageId] = {
                title: 'Bem-vindo',
                content: '# Bem-vindo ao Módulo\n\nEste é um conteúdo padrão criado automaticamente. Você pode editar esta página para adicionar seu próprio conteúdo.'
            };
            
            changesMade++;
        }
        
        console.log(`Total de correções feitas: ${changesMade}`);
        return fixedModule;
    }

    hasChanges(original, fixed) {
        return JSON.stringify(original) !== JSON.stringify(fixed);
    }

    async saveModule(module) {
        const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: module.content,
                sections: module.sections
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Erro ao salvar módulo: ${error.error || response.status}`);
        }
        
        return await response.json();
    }

    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Script de correção de módulo carregado!');
    console.log('Para corrigir este módulo, execute: const fixer = new ModuleFixer(); fixer.fix();');
    
    // Adicionar botão de correção à página
    const addFixButton = () => {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) return;
        
        const button = document.createElement('button');
        button.className = 'button is-warning mt-4';
        button.style.marginRight = '10px';
        button.innerHTML = '<span class="icon"><i class="fas fa-wrench"></i></span><span>Corrigir Estrutura</span>';
        button.onclick = async () => {
            if (confirm('Deseja corrigir a estrutura deste módulo? Isso pode resolver problemas de visualização de conteúdo.')) {
                button.classList.add('is-loading');
                const fixer = new ModuleFixer();
                await fixer.fix();
                button.classList.remove('is-loading');
            }
        };
        
        // Adicionar após outros botões na área de conteúdo
        const navButtons = contentArea.querySelector('.navigation-buttons');
        if (navButtons) {
            navButtons.prepend(button);
        } else {
            contentArea.appendChild(button);
        }
    };
    
    // Tentar adicionar o botão após um pequeno delay para garantir que o DOM esteja pronto
    setTimeout(addFixButton, 1000);
    
    // Adicionar ao objeto window para acesso pelo console
    window.ModuleFixer = ModuleFixer;
}); 