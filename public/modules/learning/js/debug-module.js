/**
 * Script de diagnóstico para módulos de aprendizado
 * 
 * Adicione este script à página para obter informações detalhadas
 * sobre a estrutura do módulo atual e possíveis problemas.
 */

class ModuleDebugger {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
    }
    
    async diagnose() {
        console.group('🔍 Diagnóstico do Módulo');
        console.log('ID do módulo:', this.moduleId);
        
        try {
            // Carregar dados do módulo
            const moduleData = await this.fetchModule();
            
            // Verificar estrutura do conteúdo
            this.checkContent(moduleData.content);
            
            // Verificar estrutura das seções
            this.checkSections(moduleData.sections, moduleData.content);
            
            // Verificar progresso
            await this.checkProgress();
            
            console.log('✅ Diagnóstico concluído');
        } catch (error) {
            console.error('❌ Erro durante diagnóstico:', error);
        }
        
        console.groupEnd();
    }
    
    async fetchModule() {
        console.log('Carregando dados do módulo...');
        
        const response = await fetch(`/api/learning/modules/${this.moduleId}`);
        if (!response.ok) {
            const error = await response.json();
            console.error('Erro ao carregar módulo:', error);
            throw new Error('Falha ao carregar módulo');
        }
        
        const data = await response.json();
        console.log('Dados do módulo:', data);
        
        return data;
    }
    
    checkContent(content) {
        console.group('📄 Verificando conteúdo');
        
        if (!content || typeof content !== 'object') {
            console.error('❌ Conteúdo inválido:', content);
            console.groupEnd();
            return;
        }
        
        console.log(`Total de páginas no conteúdo: ${Object.keys(content).length}`);
        
        // Verificar cada página
        for (const pageId in content) {
            const page = content[pageId];
            
            console.group(`Página: ${pageId}`);
            
            if (!page || typeof page !== 'object') {
                console.error('❌ Estrutura inválida:', page);
            } else {
                console.log('Título:', page.title || '(sem título)');
                console.log('Conteúdo:', page.content ? `${page.content.substring(0, 50)}...` : '(sem conteúdo)');
                
                if (!page.title) {
                    console.warn('⚠️ Página sem título');
                }
                
                if (!page.content) {
                    console.warn('⚠️ Página sem conteúdo');
                }
            }
            
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    checkSections(sections, content) {
        console.group('📑 Verificando seções');
        
        if (!sections || !Array.isArray(sections)) {
            console.error('❌ Seções inválidas:', sections);
            console.groupEnd();
            return;
        }
        
        console.log(`Total de seções: ${sections.length}`);
        
        // Verificar cada seção
        sections.forEach((section, index) => {
            console.group(`Seção ${index + 1}: ${section?.title || '(sem título)'}`);
            
            if (!section || typeof section !== 'object') {
                console.error('❌ Estrutura inválida:', section);
                console.groupEnd();
                return;
            }
            
            console.log('ID:', section.id || '(sem ID)');
            
            if (!section.id) {
                console.warn('⚠️ Seção sem ID');
            }
            
            if (!section.title) {
                console.warn('⚠️ Seção sem título');
            }
            
            // Verificar páginas da seção
            if (!section.pages || !Array.isArray(section.pages)) {
                console.error('❌ Lista de páginas inválida:', section.pages);
            } else {
                console.log(`Total de páginas na seção: ${section.pages.length}`);
                
                section.pages.forEach((pageId, pageIndex) => {
                    console.group(`Página ${pageIndex + 1}`);
                    
                    if (typeof pageId === 'object') {
                        console.error('❌ ID de página é um objeto:', pageId);
                    } else {
                        const pageIdStr = String(pageId);
                        console.log('ID:', pageIdStr);
                        
                        // Verificar se a página existe no conteúdo
                        if (content && content[pageIdStr]) {
                            console.log('Título:', content[pageIdStr].title || '(sem título)');
                        } else {
                            console.error('❌ Página não encontrada no conteúdo');
                        }
                    }
                    
                    console.groupEnd();
                });
            }
            
            console.groupEnd();
        });
        
        console.groupEnd();
    }
    
    async checkProgress() {
        console.group('📊 Verificando progresso');
        
        try {
            const response = await fetch(`/api/progress/${this.moduleId}`);
            
            if (response.ok) {
                const progress = await response.json();
                console.log('Dados de progresso:', progress);
                
                // Verificar formato dos dados
                if (progress.completed_pages && Array.isArray(progress.completed_pages)) {
                    console.log('Páginas concluídas:', progress.completed_pages.length);
                } else {
                    console.warn('⚠️ completed_pages inválido:', progress.completed_pages);
                }
                
                if (progress.total_pages === undefined || progress.total_pages === null) {
                    console.warn('⚠️ total_pages não definido');
                } else {
                    console.log('Total de páginas:', progress.total_pages);
                }
            } else {
                console.warn('⚠️ Não foi possível carregar o progresso:', response.status);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar progresso:', error);
        }
        
        console.groupEnd();
    }
}

console.log('🔧 Script de diagnóstico de módulos carregado');
console.log('Para iniciar o diagnóstico, execute: const debugger = new ModuleDebugger(); debugger.diagnose();');

// Adicionar ao objeto window para facilitar acesso pelo console
window.ModuleDebugger = ModuleDebugger; 