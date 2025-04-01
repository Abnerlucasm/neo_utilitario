// Script de diagnóstico para verificar URLs e caminhos
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Diagnóstico de URLs e Caminhos ===');
    console.log('URL atual:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    console.log('Search params:', window.location.search);
    console.log('Hash:', window.location.hash);
    
    const urlParts = window.location.pathname.split('/');
    console.log('Partes da URL:', urlParts);
    console.log('Último componente (possível ID):', urlParts[urlParts.length - 1]);
    
    // Verificar scripts carregados
    const scripts = document.querySelectorAll('script');
    console.log('\n=== Scripts carregados ===');
    scripts.forEach(script => {
        console.log(script.src || 'Script inline');
    });
    
    // Verificar elementos importantes
    console.log('\n=== Elementos importantes ===');
    [
        'moduleName', 'sectionsTree', 'editorArea', 'previewArea', 
        'saveBtn', 'previewBtn', 'backBtn', 'viewModuleBtn', 'addSectionBtn',
        'sectionModal', 'sectionTitle', 'saveSectionBtn', 'cancelSectionBtn',
        'pageModal', 'pageTitle', 'savePageBtn', 'cancelPageBtn'
    ].forEach(id => {
        const element = document.getElementById(id);
        console.log(`${id}: ${element ? 'Encontrado' : 'NÃO ENCONTRADO'}`);
    });
    
    // Verificar localStorage
    console.log('\n=== LocalStorage ===');
    console.log('Token:', localStorage.getItem('auth_token') ? 'Presente' : 'Ausente');
    
    // Verificar se o editor Markdown existe
    console.log('\n=== Editor Markdown ===');
    const hasEasyMDE = typeof EasyMDE !== 'undefined';
    console.log('EasyMDE:', hasEasyMDE ? 'Disponível' : 'NÃO DISPONÍVEL');
}); 