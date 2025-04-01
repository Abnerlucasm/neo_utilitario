/**
 * Script para diagnóstico do editor de conteúdo
 * Ajuda a identificar problemas com o editor e os elementos do DOM
 */
(function() {
    window.diagnosticarEditor = function() {
        console.group('=== Diagnóstico do Editor de Conteúdo ===');
        
        // Verificar disponibilidade do EasyMDE
        console.log('EasyMDE disponível:', typeof EasyMDE !== 'undefined');
        console.log('Marked disponível:', typeof marked !== 'undefined');
        
        // Verificar elementos do DOM necessários
        const elementos = [
            'editorArea', 
            'previewArea', 
            'sectionsTree', 
            'saveBtn', 
            'previewBtn'
        ];
        
        elementos.forEach(id => {
            const elemento = document.getElementById(id);
            console.log(`Elemento ${id}:`, elemento ? 'Encontrado' : 'NÃO ENCONTRADO');
        });
        
        // Verificar a instância do editor
        if (window.moduleContentEditor) {
            const editor = window.moduleContentEditor;
            console.log('Editor inicializado:', editor !== null);
            console.log('Editor.currentPage:', editor.currentPage);
            console.log('Editor.isEditing:', editor.isEditing);
            console.log('Editor.editor:', editor.editor);
            
            if (editor.editor) {
                console.log('Editor codemirror:', editor.editor.codemirror ? 'Disponível' : 'Indisponível');
            }
            
            console.log('Número de seções:', editor.sections ? editor.sections.length : 0);
            
            // Tentar corrigir o editor se estiver com problemas
            if (!editor.editor || !editor.editor.codemirror) {
                console.warn('Editor com problemas, tentando reinicializar...');
                try {
                    editor.initMarkdownEditor();
                    console.log('Reinicialização do editor solicitada');
                } catch (error) {
                    console.error('Erro ao tentar reinicializar o editor:', error);
                }
            }
        } else {
            console.warn('Instância do editor não encontrada na janela global');
        }
        
        console.log('localStorage auth_token:', localStorage.getItem('auth_token') ? 'Presente' : 'Ausente');
        
        console.groupEnd();
        
        return 'Diagnóstico concluído. Verifique o console para mais detalhes.';
    };
    
    // Adiciona um botão de diagnóstico na interface
    document.addEventListener('DOMContentLoaded', function() {
        const toolbar = document.querySelector('.editor-toolbar');
        
        if (toolbar) {
            const diagnosticBtn = document.createElement('button');
            diagnosticBtn.className = 'button is-small is-light ml-2';
            diagnosticBtn.innerHTML = '<span class="icon"><i class="fas fa-stethoscope"></i></span><span>Diagnosticar</span>';
            diagnosticBtn.addEventListener('click', function() {
                window.diagnosticarEditor();
                alert('Diagnóstico concluído. Verifique o console para detalhes.');
            });
            
            toolbar.appendChild(diagnosticBtn);
        }
    });
})(); 