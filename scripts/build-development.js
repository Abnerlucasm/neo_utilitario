#!/usr/bin/env node

/**
 * Script de Build para Desenvolvimento
 * Copia arquivos sem minificação, mantém logs
 */

const fs = require('fs');
const path = require('path');

class DevelopmentBuilder {
    constructor() {
        this.buildDir = 'dist-dev';
    }

    async build() {
        console.log('🔧 Iniciando build para desenvolvimento...');
        
        try {
            // Criar diretório de build
            this.createBuildDirectory();
            
            // Copiar todos os arquivos sem processamento
            await this.copyAllFiles();
            
            console.log('✅ Build para desenvolvimento concluído!');
            console.log(`📁 Arquivos copiados em: ${this.buildDir}/`);
            
        } catch (error) {
            console.error('❌ Erro durante o build:', error);
            process.exit(1);
        }
    }

    createBuildDirectory() {
        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true });
        }
        fs.mkdirSync(this.buildDir, { recursive: true });
        console.log('📁 Diretório de desenvolvimento criado');
    }

    async copyAllFiles() {
        console.log('📋 Copiando arquivos para desenvolvimento...');
        
        // Copiar diretório public inteiro
        this.copyDirectory('public', this.buildDir);
        
        console.log('✅ Todos os arquivos copiados');
    }

    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const files = fs.readdirSync(src);
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            
            if (fs.statSync(srcPath).isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

// Executar build se chamado diretamente
if (require.main === module) {
    const builder = new DevelopmentBuilder();
    builder.build();
}

module.exports = DevelopmentBuilder;
